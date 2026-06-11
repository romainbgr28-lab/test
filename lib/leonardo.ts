const LEONARDO_BASE = "https://cloud.leonardo.ai/api/rest/v1";
const LEONARDO_BASE_V2 = "https://cloud.leonardo.ai/api/rest/v2";

export interface LeonardoModel {
  id: string;
  name: string;
  description?: string;
}

// Modèles tiers (OpenAI / Google) intégrés par Leonardo et exposés via leur API unifiée v2
// (https://cloud.leonardo.ai/api/rest/v2/generations avec un paramètre "model").
// On les ajoute toujours à la liste car ils n'apparaissent pas systématiquement via /platformModels.
export const THIRD_PARTY_LEONARDO_MODELS: LeonardoModel[] = [
  {
    id: "gpt-image-2",
    name: "GPT Image 2 (OpenAI)",
    description: "Modèle d'édition premium OpenAI — excellent pour le texte dans l'image et le respect des consignes",
  },
  {
    id: "gpt-image-1.5",
    name: "GPT Image 1.5 (OpenAI)",
    description: "Modèle d'édition OpenAI — bon rapport qualité/coût pour des visuels précis",
  },
  {
    id: "gemini-2.5-flash-image",
    name: "Nano Banana (Gemini 2.5 Flash Image)",
    description: "Modèle Google rapide, très bon en édition et cohérence de style à partir d'images de référence",
  },
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    description: "Nouvelle génération Nano Banana — qualité et cohérence visuelle accrues",
  },
  {
    id: "gemini-image-2",
    name: "Nano Banana Pro (Gemini Image 2)",
    description: "Version Pro de Nano Banana — rendu haute fidélité, idéal pour un style visuel précis",
  },
];

const THIRD_PARTY_MODEL_IDS = new Set(THIRD_PARTY_LEONARDO_MODELS.map((m) => m.id));

export function isThirdPartyLeonardoModel(modelId: string): boolean {
  return THIRD_PARTY_MODEL_IDS.has(modelId);
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
  const platformModels = findModelList(data) ?? [];
  const knownIds = new Set(platformModels.map((m) => m.id));
  const extraThirdPartyModels = THIRD_PARTY_LEONARDO_MODELS.filter((m) => !knownIds.has(m.id));
  return [...platformModels, ...extraThirdPartyModels];
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

export interface LeonardoVideoResult {
  videoUrl: string;
  apiCreditCost?: number;
}

export const VIDEO_MODELS = [
  { id: "SVD", name: "SVD Motion", description: "Stable Video Diffusion — animation fluide, contrôlée par intensité (sans prompt)" },
  { id: "VEO", name: "VEO (Image-to-Video)", description: "Modèle image-to-video de Leonardo — animation dirigée par prompt texte" },
] as const;

export type VideoModelId = typeof VIDEO_MODELS[number]["id"];

// Anime une image (data URL) vers un court MP4 via Leonardo AI.
// - SVD  : POST /generations-motion-svd   (motionStrength, pas de prompt)
// - VEO3 : POST /generations-image-to-video (prompt obligatoire, motionModel)
// Dans les deux cas le polling se fait sur GET /generations/{id}.
export async function generateVideoFromImage(params: {
  imageDataUrl: string;
  apiKey: string;
  motionModel?: string;
  prompt?: string;
  motionStrength?: number;
}): Promise<LeonardoVideoResult> {
  const { imageDataUrl, apiKey, motionModel = "SVD", prompt = "", motionStrength = 4 } = params;

  const imageId = await uploadInitImage(apiKey, imageDataUrl);

  let generationId: string | undefined;
  let rawResponse: unknown;

  if (motionModel === "SVD" || motionModel === "SVD Motion") {
    const response = await fetch(`${LEONARDO_BASE}/generations-motion-svd`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({ imageId, isInitImage: true, motionStrength, isPublic: false }),
    });
    rawResponse = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error((rawResponse as Record<string,string>)?.error ?? "Échec du lancement de la génération SVD Motion.");
    }
    const d = rawResponse as Record<string, Record<string, string>>;
    generationId = d?.motionSvdGenerationJob?.generationId ?? d?.sdGenerationJob?.generationId;
  } else {
    if (!prompt.trim()) throw new Error("Un prompt est requis pour les modèles VEO.");
    const response = await fetch(`${LEONARDO_BASE}/generations-image-to-video`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        imageId,
        imageType: "UPLOADED",
        prompt: prompt.trim(),
        resolution: "RESOLUTION_720",
        frameInterpolation: true,
        promptEnhance: false,
        isPublic: false,
      }),
    });
    rawResponse = await response.json().catch(() => null);
    if (!response.ok) {
      const d = rawResponse as Record<string, string> | null;
      throw new Error(d?.error ?? d?.message ?? JSON.stringify(rawResponse) ?? "Échec image-to-video.");
    }
    const d = rawResponse as Record<string, unknown>;
    generationId =
      (d?.sdGenerationJob as Record<string,string>)?.generationId ??
      (d?.motionGenerationJob as Record<string,string>)?.generationId ??
      d?.generationId as string ??
      (d?.generation as Record<string,string>)?.id ??
      d?.id as string;
  }

  console.log("[generate-video] rawResponse:", JSON.stringify(rawResponse), "→ generationId:", generationId);

  if (!generationId) throw new Error(`generationId introuvable. Réponse Leonardo : ${JSON.stringify(rawResponse)}`);

  // Polling — jusqu'à 5 minutes (60 × 5s)
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const pollRes = await fetch(`${LEONARDO_BASE}/generations/${generationId}`, {
      headers: authHeaders(apiKey),
      cache: "no-store",
    });
    const pollData = await pollRes.json().catch(() => null);
    if (!pollRes.ok) throw new Error(pollData?.error ?? "Erreur de polling génération vidéo.");
    const gen = pollData?.generations_by_pk;
    if (gen?.status === "COMPLETE") {
      const videoUrl: string | undefined = gen?.generated_images?.[0]?.motionMP4URL;
      if (!videoUrl) throw new Error("Aucune URL vidéo renvoyée par Leonardo.");
      return { videoUrl, apiCreditCost: gen?.apiCreditCost };
    }
    if (gen?.status === "FAILED") throw new Error("La génération vidéo Leonardo a échoué.");
  }
  throw new Error("La génération vidéo a expiré (5 minutes).");
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

interface ImageReferenceGuidance {
  image: { id: string; type: "UPLOADED" };
  strength: "LOW" | "MID" | "HIGH";
}

// Les modèles tiers (GPT Image, Nano Banana) n'acceptent que des dimensions standard,
// multiples de 16. On choisit la taille supportée la plus proche du ratio voulu
// (portrait 9:16 → 1024x1536, paysage → 1536x1024, carré → 1024x1024).
function standardSizeForV2(width: number, height: number): { width: number; height: number } {
  if (height > width) return { width: 1024, height: 1536 };
  if (width > height) return { width: 1536, height: 1024 };
  return { width: 1024, height: 1024 };
}

// Les modèles tiers (GPT Image, Nano Banana...) passent par l'API unifiée v2 de Leonardo.
// IMPORTANT : contrairement à l'API v1, tous les réglages de génération doivent être imbriqués
// dans un objet "parameters" (sinon erreur "Unexpected variable ..."), avec "model" et "public"
// au niveau racine. Les images de référence (jusqu'à 4) passent par parameters.guidances.image_reference.
// cf. docs.leonardo.ai/docs/gpt-image-2 et /docs/nano-banana-2
export async function generateImageWithLeonardoV2(params: {
  prompt: string;
  apiKey: string;
  modelId: string;
  width: number;
  height: number;
  referenceImages?: string[];
}): Promise<LeonardoGenerationResult> {
  const { prompt, apiKey, modelId, width, height, referenceImages } = params;

  let imageReference: ImageReferenceGuidance[] | undefined;
  if (referenceImages && referenceImages.length > 0) {
    const ids = await Promise.all(referenceImages.slice(0, 4).map((image) => uploadInitImage(apiKey, image)));
    imageReference = ids.map((id) => ({ image: { id, type: "UPLOADED" as const }, strength: "MID" as const }));
  }

  const size = standardSizeForV2(width, height);

  const parameters: Record<string, unknown> = {
    prompt,
    width: size.width,
    height: size.height,
    quantity: 1,
    prompt_enhance: "OFF",
  };
  if (imageReference) {
    parameters.guidances = { image_reference: imageReference };
  }

  const body = {
    model: modelId,
    parameters,
    public: false,
  };

  const response = await fetch(`${LEONARDO_BASE_V2}/generations`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const apiMessage =
      (typeof data?.error === "string" && data.error) ||
      (typeof data?.message === "string" && data.message) ||
      JSON.stringify(data);
    throw new Error(apiMessage || `Échec du lancement de la génération Leonardo (${modelId}).`);
  }

  const generationId: string | undefined =
    data?.generate?.generationId ??
    data?.sdGenerationJob?.generationId ??
    data?.generations_by_pk?.id ??
    data?.generationId ??
    data?.id ??
    data?.generation?.id;
  if (!generationId) {
    throw new Error("Réponse inattendue de Leonardo (identifiant de génération manquant).");
  }
  const apiCreditCost: number | undefined =
    data?.generate?.apiCreditCost ?? data?.sdGenerationJob?.apiCreditCost ?? data?.apiCreditCost;

  const imageUrl = await pollGeneration(generationId, apiKey);

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error("Échec du téléchargement de l'image générée par Leonardo.");
  const arrayBuffer = await imageResponse.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const contentType = imageResponse.headers.get("content-type") || "image/png";

  return { imageUrl: `data:${contentType};base64,${base64}`, apiCreditCost };
}
