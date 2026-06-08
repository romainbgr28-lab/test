import { NextResponse } from "next/server";
import { buildScriptSystemPrompt, callMistralChat, extractJson } from "@/lib/mistral";
import type { Language, Platform, ViralityScore } from "@/types";

export const runtime = "nodejs";

interface RawSegment {
  order: number;
  narration: string;
  visualDescription: string;
  duration: number;
}

interface ScriptResponse {
  viralityScore: ViralityScore;
  segments: RawSegment[];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subject, platform, language, nicheInstructions, duration, model, apiKey, regenerateSegmentOrder, existingSegment } = body as {
      subject: string;
      platform: Platform;
      language: Language;
      nicheInstructions: string;
      duration: number;
      model: string;
      apiKey?: string;
      regenerateSegmentOrder?: number;
      existingSegment?: RawSegment;
    };

    const key = apiKey || process.env.MISTRAL_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Clé API Mistral manquante. Configure MISTRAL_API_KEY dans tes variables d'environnement." },
        { status: 400 }
      );
    }

    if (!subject || !platform || !language || !nicheInstructions || !duration || !model) {
      return NextResponse.json({ error: "Paramètres manquants pour générer le script." }, { status: 400 });
    }

    const systemPrompt = buildScriptSystemPrompt({ platform, language, nicheInstructions, duration, subject });

    let userPrompt = `Sujet : ${subject}`;
    if (regenerateSegmentOrder && existingSegment) {
      userPrompt = `Régénère uniquement le segment numéro ${regenerateSegmentOrder} de ce script (sujet global : "${subject}"). Voici le segment actuel à améliorer :
Narration : ${existingSegment.narration}
Description visuelle : ${existingSegment.visualDescription}
Durée : ${existingSegment.duration}s

Renvoie un unique objet JSON pour ce segment au format :
{ "order": ${regenerateSegmentOrder}, "narration": "...", "visualDescription": "...", "duration": ${existingSegment.duration} }
Aucun texte avant ou après le JSON.`;
    }

    const raw = await callMistralChat({
      apiKey: key,
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    if (regenerateSegmentOrder) {
      const segment = extractJson<RawSegment>(raw);
      return NextResponse.json({ segment });
    }

    const parsed = extractJson<ScriptResponse>(raw);

    if (!parsed.segments || !Array.isArray(parsed.segments) || parsed.segments.length === 0) {
      return NextResponse.json({ error: "Le script généré est invalide. Réessaie." }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Erreur /api/generate-script :", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json(
      { error: `Échec de la génération du script : ${message}` },
      { status: 500 }
    );
  }
}
