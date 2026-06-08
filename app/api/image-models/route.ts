import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FALLBACK_MODELS = ["flux", "turbo", "kontext"];

export async function GET() {
  try {
    const response = await fetch("https://image.pollinations.ai/models", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ models: FALLBACK_MODELS });
    }

    const data = await response.json();
    const models = Array.isArray(data) ? data.filter((m): m is string => typeof m === "string") : FALLBACK_MODELS;

    return NextResponse.json({ models: models.length > 0 ? models : FALLBACK_MODELS });
  } catch (error) {
    console.error("Erreur /api/image-models :", error);
    return NextResponse.json({ models: FALLBACK_MODELS });
  }
}
