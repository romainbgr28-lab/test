import { NextResponse } from "next/server";
import { buildImageUrl, IMAGE_EDIT_ENDPOINT, modelSupportsReferenceImage } from "@/lib/pollinations";
import { generateImageWithGemini } from "@/lib/gemini";

export const runtime = "nodejs";

function aspectRatioForPlatform(platform?: string): "9:16" | "16:9" | "1:1" {
  if (platform === "youtube") return "16:9";
  return "9:16";
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Image de référence invalide.");
  }
  return { buffer: Buffer.from(match[2], "base64"), contentType: match[1] };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, model, width, height, apiKey, seed, referenceImage, provider, geminiApiKey, platform } = body as {
      prompt: string;
      model: string;
      width: number;
      height: number;
      apiKey?: string;
      seed?: number;
      referenceImage?: string;
      provider?: "pollinations" | "gemini";
      geminiApiKey?: string;
      platform?: string;
    };

    if (!prompt || !model || !width || !height) {
      return NextResponse.json({ error: "Paramètres manquants pour générer l'image." }, { status: 400 });
    }

    if (provider === "gemini") {
      const geminiKey = geminiApiKey || process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        return NextResponse.json(
          { error: "Une clé API Gemini est requise pour générer des images avec Gemini." },
          { status: 401 }
        );
      }
      try {
        const geminiModel = model === "gemini-imagen" ? "gemini-imagen" : "gemini-nano-banana";
        const imageUrl = await generateImageWithGemini(prompt, geminiKey, geminiModel, aspectRatioForPlatform(platform));
        return NextResponse.json({ imageUrl });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erreur Gemini inconnue";
        return NextResponse.json({ error: `Échec de la génération via Gemini : ${message}` }, { status: 502 });
      }
    }

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

    if (referenceImage) {
      if (!modelSupportsReferenceImage(model)) {
        return NextResponse.json(
          {
            error: `Le modèle "${model}" ne prend pas en charge une image de référence. Choisis un modèle d'édition (kontext, gptimage, seedream, klein, nanobanana).`,
          },
          { status: 400 }
        );
      }
      const { buffer, contentType } = dataUrlToBuffer(referenceImage);
      const form = new FormData();
      form.append("image", new Blob([new Uint8Array(buffer)], { type: contentType }), "reference.png");
      form.append("prompt", prompt);
      form.append("model", model);
      form.append("size", `${width}x${height}`);
      if (seed !== undefined) form.append("seed", String(seed));

      const editResponse = await fetch(IMAGE_EDIT_ENDPOINT, {
        method: "POST",
        headers,
        body: form,
      });
      if (!editResponse.ok) {
        const text = await editResponse.text();
        return NextResponse.json(
          { error: `Le service d'édition d'image a renvoyé une erreur (${editResponse.status}).`, details: text },
          { status: editResponse.status === 401 || editResponse.status === 402 ? editResponse.status : 502 }
        );
      }
      const editData = await editResponse.json();
      const item = editData?.data?.[0];
      if (item?.b64_json) {
        return NextResponse.json({ imageUrl: `data:image/png;base64,${item.b64_json}` });
      }
      if (item?.url) {
        const fetched = await fetch(item.url);
        const arrayBuffer = await fetched.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const contentType2 = fetched.headers.get("content-type") || "image/png";
        return NextResponse.json({ imageUrl: `data:${contentType2};base64,${base64}` });
      }
      return NextResponse.json({ error: "Réponse inattendue du service d'édition d'image." }, { status: 502 });
    }

    const url = buildImageUrl({ prompt, model, width, height, seed });

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
