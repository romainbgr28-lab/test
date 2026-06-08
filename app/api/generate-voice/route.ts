import { NextResponse } from "next/server";
import { TTS_ENDPOINT } from "@/lib/pollinations";
import type { VoiceId } from "@/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, voice, apiKey } = body as { text: string; voice: VoiceId; apiKey?: string };

    if (!text || !voice) {
      return NextResponse.json({ error: "Paramètres manquants pour générer la voix off." }, { status: 400 });
    }

    const key = apiKey || process.env.POLLINATIONS_API_KEY;
    if (!key) {
      return NextResponse.json(
        {
          error:
            "L'API Pollinations nécessite désormais une clé API (pk_ ou sk_) pour toutes les générations. Récupère ta clé sur enter.pollinations.ai et renseigne-la dans la configuration.",
        },
        { status: 401 }
      );
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    };

    const response = await fetch(TTS_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "openai-audio",
        voice,
        messages: [{ role: "user", content: text }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Le service de voix off a renvoyé une erreur (${response.status}).`, details: errorText },
        { status: 502 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return NextResponse.json({ audioUrl: `data:audio/mpeg;base64,${base64}` });
  } catch (error) {
    console.error("Erreur /api/generate-voice :", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json(
      { error: `Échec de la génération de la voix off : ${message}` },
      { status: 500 }
    );
  }
}
