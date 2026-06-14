import { NextRequest, NextResponse } from "next/server";
import { startVideoGeneration } from "@/lib/leonardo";

export const runtime = "nodejs";

// Démarre la génération vidéo et retourne le generationId immédiatement.
// Le client poll ensuite /api/generate-video/status jusqu'à COMPLETE.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, motionModel, prompt, motionStrength, apiKey } = body as {
      imageUrl?: string;
      motionModel?: string;
      prompt?: string;
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

    const { generationId, apiCreditCost } = await startVideoGeneration({
      imageDataUrl: imageUrl,
      apiKey: resolvedApiKey,
      motionModel: motionModel ?? "SVD",
      prompt: prompt ?? "",
      motionStrength: motionStrength ?? 4,
    });

    return NextResponse.json({ generationId, apiCreditCost });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[generate-video/start]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
