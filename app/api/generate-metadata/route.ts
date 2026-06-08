import { NextResponse } from "next/server";
import { callMistralChat, extractJson } from "@/lib/mistral";
import type { Language, Platform } from "@/types";

export const runtime = "nodejs";

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  youtube: "YouTube",
  reels: "Instagram Reels",
};

const LANGUAGE_LABELS: Record<Language, string> = {
  fr: "français",
  en: "anglais",
};

interface MetadataResponse {
  caption: string;
  hashtags: string[];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subject, narration, platform, language, model, apiKey } = body as {
      subject: string;
      narration: string;
      platform: Platform;
      language: Language;
      model: string;
      apiKey?: string;
    };

    const key = apiKey || process.env.MISTRAL_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "Clé API Mistral manquante." }, { status: 400 });
    }
    if (!subject || !platform || !language || !model) {
      return NextResponse.json({ error: "Paramètres manquants pour générer les métadonnées." }, { status: 400 });
    }

    const platformLabel = PLATFORM_LABELS[platform];
    const languageLabel = LANGUAGE_LABELS[language];

    const systemPrompt = `Tu es un expert du copywriting pour ${platformLabel}. Tu écris des légendes (caption) accrocheuses et tu choisis des hashtags pertinents pour maximiser la portée. Tu réponds en ${languageLabel}.`;
    const userPrompt = `Sujet de la vidéo : "${subject}"
Script (voix off) :
"""
${narration}
"""

Génère pour ${platformLabel} :
- une légende (caption) courte, accrocheuse, avec 1 à 2 emojis maximum, qui donne envie de regarder et invite à l'engagement (commentaire / partage)
- une liste de 8 à 15 hashtags pertinents (mélange de hashtags de niche précis et de quelques hashtags larges), sans le caractère # (juste le mot)

FORMAT DE RÉPONSE : JSON strict uniquement, aucun texte avant ou après.
{
  "caption": "...",
  "hashtags": ["hashtag1", "hashtag2"]
}`;

    const raw = await callMistralChat({
      apiKey: key,
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const parsed = extractJson<MetadataResponse>(raw);
    const hashtags = Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((h) => h.replace(/^#/, "").trim()).filter(Boolean)
      : [];

    return NextResponse.json({ caption: parsed.caption ?? "", hashtags });
  } catch (error) {
    console.error("Erreur /api/generate-metadata :", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: `Échec de la génération des métadonnées : ${message}` }, { status: 500 });
  }
}
