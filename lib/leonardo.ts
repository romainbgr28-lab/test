const LEONARDO_BASE = "https://cloud.leonardo.ai/api/rest/v1";

export interface LeonardoModel {
  id: string;
  name: string;
  description?: string;
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    accept: "application/json",
    "Content-Type": "application/json",
  };
}

// L'API de génération Leonardo exige des dimensions multiples de 8 (32 à 1024px en général,
// mais certains modèles imposent leurs propres valeurs — voir le mécanisme de correction
// automatique dans generateImageWithLeonardo).
export function clampDimensionsForLeonardo(width: number, height: number): { width: number; height: number } {
  const maxSide = 1024;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const roundToMultipleOf8 = (value: number) => Math.max(32, Math.min(maxSide, Math.round((value * scale) / 8) * 8));
  return { width: roundToMultipleOf8(width), height: roundToMultipleOf8(height) };
}

// Quand un modèle refuse une dimension, Leonardo renvoie la liste des valeurs acceptées
// dans le message d'erreur (ex. "This model requires a width of 672, 720, 752, ..., 1568").
// On parse cette liste et on choisit la paire largeur/hauteur la plus proche du ratio voulu.
function parseAllowedSizesFromError(message: string): number[] | null {
  const match = /requires (?:a )?(?:width|height) of ([\d,\s]+)/i.exec(message);
  if (!match) return null;
  const values = match[1]
    .split(",")
    .map((part) => parseInt(part.trim(), 10))
    .filter((n) => Number.isFinite(n));
  return values.length > 0 ? values : null;
}

function bestDimensionsFromAllowedSizes(sizes: number[], targetRatio: number): { width: number; height: number } {
  let best = { width: sizes[0], height: sizes[0], diff: Infinity };
  for (const width of sizes) {
    for (const height of sizes) {
      const diff = Math.abs(width / height - targetRatio);
      if (diff < best.diff) best = { width, height, diff };
    }
  }
  return { width: best.width, height: best.height };
}

function findModelList(node: unknown, depth = 0): LeonardoModel[] | null {
  if (node == null || depth > 5) return null;
  if (Array.isArray(node)) {
    const looksLikeModels =
      node.length > 0 &&
      node.every(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          typeof (entry as { id?: unknown }).id === "string" &&
          typeof (entry as { name?: unknown }).name === "string"
      );
    if (looksLikeModels) {
      return (node as Array<{ id: string; name: string; description?: string }>).map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
      }));
    }
    return null;
  }
  if (typeof node === "object") {
    for (const value of Object.values(node as Record<string, unknown>)) {
      const found = findModelList(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export async function listLeonardoModels(apiKey: string): Promise<LeonardoModel[]> {
  const response = await fetch(`${LEONARDO_BASE}/platformModels`, {
    headers: authHeaders(apiKey),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? "Impossible de récupérer la liste des modèles Leonardo.");
  }
  return findModelList(data) ?? [];
}

async function uploadInitImage(apiKey: string, dataUrl: string): Promise<string> {
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
      cache: "no-store",
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

async function startGeneration(
  body: Record<string, unknown>,
  apiKey: string
): Promise<{ generationId: string; apiCreditCost?: number }> {
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
  return { generationId, apiCreditCost: data?.sdGenerationJob?.apiCreditCost };
}

export interface LeonardoGenerationResult {
  imageUrl: string;
  apiCreditCost?: number;
}

export async function generateImageWithLeonardo(params: {
  prompt: string;
  apiKey: string;
  modelId: string;
  width: number;
  height: number;
  referenceImage?: string;
  initStrength?: number;
}): Promise<LeonardoGenerationResult> {
  const { prompt, apiKey, modelId, width, height, referenceImage, initStrength = 0.4 } = params;

  let initImageId: string | undefined;
  if (referenceImage) {
    initImageId = await uploadInitImage(apiKey, referenceImage);
  }

  const targetRatio = width / height;
  let dimensions = clampDimensionsForLeonardo(width, height);

  const buildBody = () => {
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
    return body;
  };

  let job: { generationId: string; apiCreditCost?: number };
  try {
    job = await startGeneration(buildBody(), apiKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const allowedSizes = parseAllowedSizesFromError(message);
    if (!allowedSizes) throw error;
    dimensions = bestDimensionsFromAllowedSizes(allowedSizes, targetRatio);
    job = await startGeneration(buildBody(), apiKey);
  }

  const imageUrl = await pollGeneration(job.generationId, apiKey);

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error("Échec du téléchargement de l'image générée par Leonardo.");
  const arrayBuffer = await imageResponse.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const contentType = imageResponse.headers.get("content-type") || "image/png";

  return { imageUrl: `data:${contentType};base64,${base64}`, apiCreditCost: job.apiCreditCost };
}
