import { NextResponse } from "next/server";
import { generateImageWithLeonardo } from "@/lib/leonardo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, model, width, height, apiKey, referenceImage } = body as {
      prompt: string;
      model: string;
      width: number;
      height: number;
      apiKey?: string;
      referenceImage?: string;
    };

    if (!prompt || !model || !width || !height) {
      return NextResponse.json({ error: "Paramètres manquants pour générer l'image." }, { status: 400 });
    }

    const key = apiKey || process.env.LEONARDO_API_KEY;
    if (!key) {
      return NextResponse.json(
        {
          error:
            "Une clé API Leonardo est requise pour générer des images. Récupère ta clé sur app.leonardo.ai et renseigne-la dans la configuration.",
        },
        { status: 401 }
      );
    }

    try {
      const { imageUrl, apiCreditCost } = await generateImageWithLeonardo({
        prompt,
        apiKey: key,
        modelId: model,
        width,
        height,
        referenceImage,
      });
      return NextResponse.json({ imageUrl, apiCreditCost });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur Leonardo inconnue";
      return NextResponse.json({ error: `Échec de la génération via Leonardo : ${message}` }, { status: 502 });
    }
  } catch (error) {
    console.error("Erreur /api/generate-image :", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json(
      { error: `Échec de la génération de l'image : ${message}` },
      { status: 500 }
    );
  }
}
