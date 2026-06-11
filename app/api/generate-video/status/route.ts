import { NextRequest, NextResponse } from "next/server";
import { pollVideoGeneration } from "@/lib/leonardo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const generationId = searchParams.get("generationId");
    const apiKey = searchParams.get("apiKey") || process.env.LEONARDO_API_KEY;

    if (!generationId) return NextResponse.json({ error: "generationId manquant." }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: "Clé API Leonardo manquante." }, { status: 400 });

    const result = await pollVideoGeneration(generationId, apiKey);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
