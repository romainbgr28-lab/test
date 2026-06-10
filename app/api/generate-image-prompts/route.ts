import { NextResponse } from "next/server";
import { callMistralChat } from "@/lib/mistral";
import type { Language, Platform } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  youtube: "YouTube",
  reels: "Instagram Reels",
};

export async function POST(request: Request) {
  const body = await request.json();
  const { scriptText, imageCount, platform, language, model, apiKey, stylePrompt } = body as {
    scriptText: string;
    imageCount: number;
    platform: Platform;
    language: Language;
    model: string;
    apiKey?: string;
    stylePrompt?: string;
  };

  const key = apiKey || process.env.MISTRAL_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Clé API Mistral manquante." }, { status: 400 });
  }

  if (!scriptText || !imageCount || !platform || !language || !model) {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }

  const platformLabel = PLATFORM_LABELS[platform];
  const styleNote = stylePrompt?.trim() ? `\nStyle visuel global : ${stylePrompt.trim()}` : "";

  const systemPrompt = `Tu es un expert en direction artistique pour vidéos ${platformLabel} (format vertical 9:16).
Tu génères des prompts d'images précis, en anglais, style Midjourney / Stable Diffusion.
Chaque prompt décrit une scène distincte et visuellement percutante adaptée au passage de script correspondant.
Spécifie : sujet principal, éclairage, couleurs dominantes, style photographique ou illustratif, émotion.
Varie les types de plans : close-up, wide shot, abstract, metaphore visuelle, data visualization.${styleNote}

RÉPONDS UNIQUEMENT avec un tableau JSON : ["prompt 1", "prompt 2", ...] — aucun texte autour.`;

  const userPrompt = `Script complet :
"""
${scriptText}
"""

Génère exactement ${imageCount} prompts d'images en anglais pour illustrer ce script de façon progressive (une image toutes les 2-3 secondes).
Les prompts doivent couvrir le script du début à la fin de manière équilibrée.
Réponds uniquement avec le tableau JSON de ${imageCount} chaînes.`;

  try {
    const raw = await callMistralChat({
      apiKey: key,
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const trimmed = raw.trim();
    const start = trimmed.indexOf("[");
    const end = trimmed.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("Réponse invalide de l'IA.");
    const prompts = JSON.parse(trimmed.slice(start, end + 1)) as string[];

    return NextResponse.json({ prompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: `Échec de la génération des prompts : ${message}` }, { status: 500 });
  }
}
