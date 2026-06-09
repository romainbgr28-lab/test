import { NextResponse } from "next/server";
import { callMistralChat } from "@/lib/mistral";

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
          content: `Tu es un expert du copywriting pour ${platformLabel}. Tu écris des légendes accrocheuses et tu choisis des hashtags très pertinents ${langInstruction}. Tu réponds uniquement en JSON valide.`,
        },
        {
          role: "user",
          content: `Génère une légende de publication et des hashtags pour cette vidéo sur "${subject}".

Narration de la vidéo :
${narration}

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans code block) :
{"caption":"...","hashtags":["hashtag1","hashtag2",...]}

La légende doit être accrocheuse, courte (2-3 phrases max). Fournis 10-15 hashtags pertinents sans le #.`,
        },
      ],
      temperature: 0.7,
    });

    const cleaned = content.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned) as { caption: string; hashtags: string[] };

    const hashtags = parsed.hashtags.map((h) => h.replace(/^#/, ""));

    return NextResponse.json({ caption: parsed.caption, hashtags });
  } catch (error) {
    console.error("Erreur /api/generate-metadata :", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: `Échec de la génération des métadonnées : ${message}` }, { status: 500 });
  }
}
