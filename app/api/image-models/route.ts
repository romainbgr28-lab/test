import { NextResponse } from "next/server";
import { IMAGE_MODELS_ENDPOINT } from "@/lib/pollinations";

export const runtime = "nodejs";

const FALLBACK_MODELS = ["flux", "turbo", "kontext"];

function extractModelNames(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string") {
          return (entry as { name: string }).name;
        }
        if (entry && typeof entry === "object" && typeof (entry as { id?: unknown }).id === "string") {
          return (entry as { id: string }).id;
        }
        return null;
      })
      .filter((m): m is string => !!m);
  }
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return extractModelNames((data as { data: unknown[] }).data);
  }
  return [];
}

export async function GET() {
  try {
    const response = await fetch(IMAGE_MODELS_ENDPOINT, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ models: FALLBACK_MODELS });
    }

    const data = await response.json();
    const models = extractModelNames(data);

    return NextResponse.json({ models: models.length > 0 ? models : FALLBACK_MODELS });
  } catch (error) {
    console.error("Erreur /api/image-models :", error);
    return NextResponse.json({ models: FALLBACK_MODELS });
  }
}
