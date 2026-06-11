import { NextRequest, NextResponse } from "next/server";
import { generateVideoFromImage } from "@/lib/leonardo";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, motionStrength, apiKey } = body as {
      imageUrl?: string;
      motionStrength?: number;
      apiKey?: string;
    };

    const resolvedApiKey = apiKey || process.env.LEONARDO_API_KEY;
    if (!resolvedApiKey) {
      return NextResponse.json({ error: "Clé API Leonardo manquante." }, { status: 400 });
    }
    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl manquant." }, { status: 400 });
    }

    const result = await generateVideoFromImage({
      imageDataUrl: imageUrl,
      apiKey: resolvedApiKey,
      motionStrength: motionStrength ?? 4,
    });

    return NextResponse.json({ videoUrl: result.videoUrl, apiCreditCost: result.apiCreditCost });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
