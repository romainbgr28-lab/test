import { NextResponse } from "next/server";
import { buildImageUrl } from "@/lib/pollinations";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, model, width, height, apiKey } = body as {
      prompt: string;
      model: string;
      width: number;
      height: number;
      apiKey?: string;
    };

    if (!prompt || !model || !width || !height) {
      return NextResponse.json({ error: "Paramètres manquants pour générer l'image." }, { status: 400 });
    }

    const url = buildImageUrl({ prompt, model, width, height });

    const key = apiKey || process.env.POLLINATIONS_API_KEY;
    const headers: Record<string, string> = {};
    if (key) {
      headers.Authorization = `Bearer ${key}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Le service d'images a renvoyé une erreur (${response.status}).`, details: text },
        { status: 502 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return NextResponse.json({ imageUrl: `data:${contentType};base64,${base64}` });
  } catch (error) {
    console.error("Erreur /api/generate-image :", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json(
      { error: `Échec de la génération de l'image : ${message}` },
      { status: 500 }
    );
  }
}
