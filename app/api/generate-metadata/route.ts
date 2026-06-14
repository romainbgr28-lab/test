import { NextResponse } from "next/server";
import { callMistralChat, extractJson } from "@/lib/mistral";
import type { PublishMetadata } from "@/types";

export const runtime = "nodejs";

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  youtube: "YouTube",
  reels: "Instagram Reels",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subject, narration, platform, language, model, apiKey } = body as {
      subject: string;
      narration: string;
      platform: string;
      language: string;
      model: string;
      apiKey?: string;
    };

    const key = apiKey || process.env.MISTRAL_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "Clé API Mistral manquante." }, { status: 400 });
    }

    const platformLabel = PLATFORM_LABELS[platform] ?? platform;
    const langInstruction = language === "en" ? "in English" : "en français";

    const content = await callMistralChat({
      apiKey: key,
      model,
      messages: [
        {
          role: "system",
          content: `Tu es un expert de la croissance et de la monétisation sur ${platformLabel}. Tu optimises chaque publication pour la rétention, la découvrabilité (SEO) et la conversion en abonnés — c'est ce qui débloque la monétisation. Tu écris ${langInstruction}. Tu réponds uniquement en JSON valide.`,
        },
        {
          role: "user",
          content: `Prépare le pack de publication complet pour cette vidéo d'environ 60 secondes sur "${subject}".

Narration de la vidéo :
${narration}

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans code block) :
{
  "title": "[titre YouTube optimisé clic + SEO, MAXIMUM 95 caractères]",
  "description": "[description YouTube : 2-3 phrases avec mots-clés naturels, puis un appel à l'abonnement, puis 3-5 mots-clés]",
  "caption": "[légende TikTok/Reels accrocheuse, 2-3 phrases max, qui pousse au commentaire]",
  "hashtags": ["mélange de 10-15 hashtags SANS le # : 3-4 très gros (millions de vues), 4-5 moyens, 4-5 de niche précis"],
  "bestPostTime": "[meilleur créneau de publication pour une audience francophone sur ${platformLabel}, ex : 'Mardi/jeudi 18h-20h']",
  "nextVideoIdeas": ["3 idées de vidéos suivantes qui forment une SÉRIE avec celle-ci pour fidéliser et convertir en abonnés"]
}`,
        },
      ],
      temperature: 0.7,
    });

    const parsed = extractJson<PublishMetadata>(content);

    const metadata: PublishMetadata = {
      caption: typeof parsed.caption === "string" ? parsed.caption : "",
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map((h) => String(h).replace(/^#/, "")) : [],
      title: typeof parsed.title === "string" ? parsed.title.slice(0, 100) : undefined,
      description: typeof parsed.description === "string" ? parsed.description : undefined,
      bestPostTime: typeof parsed.bestPostTime === "string" ? parsed.bestPostTime : undefined,
      nextVideoIdeas: Array.isArray(parsed.nextVideoIdeas) ? parsed.nextVideoIdeas.map(String).slice(0, 5) : undefined,
    };

    return NextResponse.json(metadata);
  } catch (error) {
    console.error("Erreur /api/generate-metadata :", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: `Échec de la génération des métadonnées : ${message}` }, { status: 500 });
  }
}
