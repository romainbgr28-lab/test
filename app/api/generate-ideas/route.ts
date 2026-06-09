import { NextResponse } from "next/server";
import { callMistralWithWebSearch, extractJson } from "@/lib/mistral";
import type { Language, Platform, VideoIdea } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  youtube: "YouTube",
  reels: "Instagram Reels",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { niche, platform, language, model, apiKey } = body as {
      niche: string;
      platform: Platform;
      language: Language;
      model: string;
      apiKey?: string;
    };

    const key = apiKey || process.env.MISTRAL_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "Clé API Mistral manquante." }, { status: 400 });
    }
    if (!niche || !platform || !model) {
      return NextResponse.json({ error: "Paramètres manquants pour générer des idées." }, { status: 400 });
    }

    const platformLabel = PLATFORM_LABELS[platform] ?? platform;
    const languageLabel = language === "en" ? "anglais" : "français";

    const instructions = `Tu es un stratège de contenu court (${platformLabel}) spécialisé dans la monétisation : programme bêta TikTok (vidéos > 1 min), YouTube Partner Program (RPM Shorts), audiences à forte valeur publicitaire. Tu DOIS utiliser l'outil de recherche web pour identifier les sujets qui explosent EN CE MOMENT : ne réponds jamais de mémoire. Réponds en ${languageLabel}.`;

    const userMessage = `Niche : ${niche}
Plateforme : ${platformLabel}

Effectue plusieurs recherches web (tendances de la semaine, actualités de la niche, formats qui percent) puis propose 8 idées de vidéos d'environ 60 secondes, classées par potentiel.

Réponds UNIQUEMENT avec ce JSON (aucun texte autour) :
{
  "ideas": [
    {
      "title": "[sujet prêt à l'emploi, formulé comme un titre accrocheur]",
      "hook": "[la phrase d'ouverture choc, max 15 mots]",
      "angle": "[l'angle précis qui différencie cette vidéo]",
      "monetizationPotential": "[pourquoi ce sujet rapporte : RPM de la niche, audience qui convertit, potentiel série...]",
      "trendScore": [0-100, à quel point le sujet est chaud en ce moment]
    }
  ]
}`;

    const result = await callMistralWithWebSearch({ apiKey: key, model, instructions, userMessage });
    const parsed = extractJson<{ ideas: VideoIdea[] }>(result.text);
    if (!Array.isArray(parsed.ideas) || parsed.ideas.length === 0) {
      throw new Error("Aucune idée renvoyée par l'IA.");
    }

    const ideas = parsed.ideas
      .filter((idea) => idea && typeof idea.title === "string" && idea.title.trim())
      .map((idea) => ({
        title: idea.title.trim(),
        hook: typeof idea.hook === "string" ? idea.hook.trim() : "",
        angle: typeof idea.angle === "string" ? idea.angle.trim() : "",
        monetizationPotential: typeof idea.monetizationPotential === "string" ? idea.monetizationPotential.trim() : "",
        trendScore: Number.isFinite(idea.trendScore) ? Math.min(100, Math.max(0, Math.round(idea.trendScore))) : 50,
      }))
      .sort((a, b) => b.trendScore - a.trendScore);

    return NextResponse.json({ ideas, sources: result.sources });
  } catch (error) {
    console.error("Erreur /api/generate-ideas :", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: `Échec de la recherche d'idées : ${message}` }, { status: 500 });
  }
}
