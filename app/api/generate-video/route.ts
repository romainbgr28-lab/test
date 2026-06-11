import { NextRequest, NextResponse } from "next/server";
import { generateVideoFromImage } from "@/lib/leonardo";

export const runtime = "nodejs";

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

    const result = await generateVideoFromImage({
      imageDataUrl: imageUrl,
      apiKey: resolvedApiKey,
      motionModel: motionModel ?? "SVD",
      prompt: prompt ?? "",
      motionStrength: motionStrength ?? 4,
    });

    return NextResponse.json({ videoUrl: result.videoUrl, apiCreditCost: result.apiCreditCost });
  } catch (error) {
    // Le message inclut la réponse brute Leonardo pour diagnostic
    const message = error instanceof Error ? error.message : String(error);
    console.error("[generate-video]", message);
    return NextResponse.json({ error: message, debug: message }, { status: 500 });
  }
}
