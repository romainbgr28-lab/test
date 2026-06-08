const LEONARDO_BASE = "https://cloud.leonardo.ai/api/rest/v1";

export interface LeonardoModel {
  id: string;
  name: string;
  description?: string;
}

// L'API de génération Leonardo exige des dimensions entre 32 et 1024px, multiples de 8.
export function clampDimensionsForLeonardo(width: number, height: number): { width: number; height: number } {
  const maxSide = 1024;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const roundToMultipleOf8 = (value: number) => Math.max(32, Math.min(maxSide, Math.round((value * scale) / 8) * 8));
  return { width: roundToMultipleOf8(width), height: roundToMultipleOf8(height) };
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    accept: "application/json",
    "Content-Type": "application/json",
  };
}

export async function listLeonardoModels(apiKey: string): Promise<LeonardoModel[]> {
  const response = await fetch(`${LEONARDO_BASE}/platformModels`, {
    headers: authHeaders(apiKey),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? "Impossible de récupérer la liste des modèles Leonardo.");
  }
  const raw =
    data?.platformModels ??
    data?.platform_models ??
    data?.custom_models ??
    data?.models ??
    [];
  return (raw as Array<{ id: string; name: string; description?: string }>).map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
  }));
}

async function uploadInitImage(prompt: string, apiKey: string, dataUrl: string): Promise<string> {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Image de référence invalide.");
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const extension = contentType.split("/")[1]?.split("+")[0] ?? "png";

  const initResponse = await fetch(`${LEONARDO_BASE}/init-image`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ extension }),
  });
  const initData = await initResponse.json().catch(() => null);
  if (!initResponse.ok || !initData?.uploadInitImage) {
    throw new Error(initData?.error ?? "Échec de la préparation de l'upload de l'image de référence.");
  }

  const { id, url, fields } = initData.uploadInitImage as { id: string; url: string; fields: string };
  const parsedFields = JSON.parse(fields) as Record<string, string>;

  const form = new FormData();
  for (const [key, value] of Object.entries(parsedFields)) {
    form.append(key, value);
  }
  form.append("file", new Blob([new Uint8Array(buffer)], { type: contentType }), `reference.${extension}`);

  const uploadResponse = await fetch(url, { method: "POST", body: form });
  if (!uploadResponse.ok && uploadResponse.status !== 204) {
    throw new Error("Échec de l'envoi de l'image de référence vers Leonardo.");
  }

  return id;
}

async function pollGeneration(generationId: string, apiKey: string): Promise<string> {
  const maxAttempts = 40;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${LEONARDO_BASE}/generations/${generationId}`, {
      headers: authHeaders(apiKey),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error ?? "Échec de la récupération de la génération Leonardo.");
    }
    const generation = data?.generations_by_pk;
    if (generation?.status === "COMPLETE") {
      const imageUrl = generation?.generated_images?.[0]?.url;
      if (!imageUrl) throw new Error("Aucune image renvoyée par Leonardo.");
      return imageUrl as string;
    }
    if (generation?.status === "FAILED") {
      throw new Error("La génération Leonardo a échoué.");
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("La génération Leonardo a expiré (délai dépassé).");
}

export async function generateImageWithLeonardo(params: {
  prompt: string;
  apiKey: string;
  modelId: string;
  width: number;
  height: number;
  referenceImage?: string;
  initStrength?: number;
}): Promise<string> {
  const { prompt, apiKey, modelId, width, height, referenceImage, initStrength = 0.4 } = params;

  let initImageId: string | undefined;
  if (referenceImage) {
    initImageId = await uploadInitImage(prompt, apiKey, referenceImage);
  }

  const dimensions = clampDimensionsForLeonardo(width, height);

  const body: Record<string, unknown> = {
    prompt,
    modelId,
    width: dimensions.width,
    height: dimensions.height,
    num_images: 1,
  };
  if (initImageId) {
    body.init_image_id = initImageId;
    body.init_strength = initStrength;
    body.isInitImage = true;
  }

  const response = await fetch(`${LEONARDO_BASE}/generations`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? "Échec du lancement de la génération Leonardo.");
  }
  const generationId = data?.sdGenerationJob?.generationId;
  if (!generationId) throw new Error("Réponse inattendue de Leonardo (identifiant de génération manquant).");

  const imageUrl = await pollGeneration(generationId, apiKey);

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error("Échec du téléchargement de l'image générée par Leonardo.");
  const arrayBuffer = await imageResponse.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const contentType = imageResponse.headers.get("content-type") || "image/png";
  return `data:${contentType};base64,${base64}`;
}
