import { NextResponse } from "next/server";
import { listLeonardoModels } from "@/lib/leonardo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const apiKey = (body?.apiKey as string | undefined) || process.env.LEONARDO_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Une clé API Leonardo est requise.", models: [] }, { status: 401 });
    }

    const models = await listLeonardoModels(apiKey);
    return NextResponse.json({ models });
  } catch (error) {
    console.error("Erreur /api/leonardo-models :", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message, models: [] }, { status: 502 });
  }
}
