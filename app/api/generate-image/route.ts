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
    if (!key) {
      return NextResponse.json(
        {
          error:
            "L'API Pollinations nécessite désormais une clé API (pk_ ou sk_) pour toutes les générations d'images. Récupère ta clé sur enter.pollinations.ai et renseigne-la dans la configuration.",
        },
        { status: 401 }
      );
    }
    const headers: Record<string, string> = { Authorization: `Bearer ${key}` };

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401) {
        return NextResponse.json(
          {
            error:
              "La clé API Pollinations fournie est invalide ou expirée. Génère une nouvelle clé sur enter.pollinations.ai et mets à jour la configuration.",
            details: text,
          },
          { status: 401 }
        );
      }
      if (response.status === 402) {
        return NextResponse.json(
          {
            error: `Solde de Pollen insuffisant pour générer avec le modèle "${model}". Crédite ton compte Pollinations (enter.pollinations.ai) ou choisis un modèle moins coûteux (ex. "flux").`,
            details: text,
          },
          { status: 402 }
        );
      }
      if (response.status === 403) {
        return NextResponse.json(
          {
            error: `Ta clé API n'a pas la permission d'utiliser le modèle "${model}". Vérifie les restrictions de modèles configurées sur ta clé.`,
            details: text,
          },
          { status: 403 }
        );
      }
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
