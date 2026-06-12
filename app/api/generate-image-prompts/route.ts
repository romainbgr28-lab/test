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

  const systemPrompt = `Tu es un directeur artistique expert en vidéos ${platformLabel} (format vertical 9:16, ratio cinématique).
Tu génères des prompts d'images ultra-précis en anglais, optimisés pour Midjourney v6 / SDXL / Flux.

STRUCTURE DE CHAQUE PROMPT (respecte cet ordre) :
1. Sujet principal — qui ou quoi, avec détails visuels concrets (pas "un homme" mais "a muscular athlete, 30s, dark skin, focused expression")
2. Action / pose — ce qui se passe dans l'instant
3. Environnement / décor — lieu précis, heure du jour, météo si pertinent
4. Éclairage — (ex: golden hour rim light, cold blue neon glow, dramatic chiaroscuro, soft window light)
5. Style — (ex: hyper-realistic photography, editorial magazine, cinematic still, data infographic, abstract 3D)
6. Palette de couleurs — 2-3 couleurs dominantes
7. Qualité — ajoute toujours : sharp focus, 8k, high detail, award-winning photo
${styleNote ? `Style visuel global imposé : ${styleNote.replace("\\nStyle visuel global : ", "").trim()}` : ""}

RÈGLES :
- Chaque prompt = minimum 40 mots en anglais.
- ZÉRO générique : jamais "a person", "a scene", "an image of". Toujours concret et spécifique.
- Varie les types de plans entre les prompts : extreme close-up, medium shot, bird's eye view, dutch angle, POV shot, macro shot.
- Varie les styles : photo réaliste, infographie 3D, illustration stylisée, typographie animée, metaphore visuelle abstraite.
- Chaque prompt doit illustrer PRÉCISÉMENT le passage de script correspondant (mêmes émotions, mêmes thèmes).
- Jamais deux prompts avec le même type de plan ou le même style consécutivement.

RÉPONDS UNIQUEMENT avec un tableau JSON : ["prompt 1", "prompt 2", ...] — aucun texte autour.`;

  const userPrompt = `Script complet (découpe-le en ${imageCount} segments égaux) :
"""
${scriptText}
"""

Génère exactement ${imageCount} prompts d'images en anglais qui illustrent ce script du début à la fin.
Chaque prompt correspond à un segment du script et doit en capturer l'essence visuelle avec précision.
Couvre tout le script de manière équilibrée — premier prompt = ouverture/hook, dernier prompt = conclusion/CTA.
Réponds uniquement avec le tableau JSON de ${imageCount} chaînes, chacune de minimum 40 mots.`;

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
