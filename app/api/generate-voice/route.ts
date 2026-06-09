import { NextRequest, NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/google-tts";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { text, voice, apiKey, language } = await req.json();

    if (!text || !voice || !apiKey) {
      return NextResponse.json(
        { error: "Paramètres manquants : text, voice et apiKey sont requis." },
        { status: 400 }
      );
    }

    const audioBuffer = await synthesizeSpeech(
      text,
      voice,
      apiKey,
      language ?? "fr"
    );

    return new NextResponse(audioBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="voiceover.mp3"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
