const IMAGEN_MODEL = "imagen-4.0-generate-001";
const NANO_BANANA_MODEL = "gemini-2.5-flash-image";

async function generateWithImagen(
  prompt: string,
  apiKey: string,
  aspectRatio: "9:16" | "16:9" | "1:1"
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio,
        },
      }),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "Erreur Gemini");
  const base64 = data.predictions[0].bytesBase64Encoded;
  return `data:image/png;base64,${base64}`;
}

async function generateWithNanoBanana(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${NANO_BANANA_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "Erreur Gemini");
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData?.data);
  if (!imagePart?.inlineData?.data) throw new Error("Aucune image renvoyée par Nano Banana.");
  const mimeType = imagePart.inlineData.mimeType ?? "image/png";
  return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}

export async function generateImageWithGemini(
  prompt: string,
  apiKey: string,
  model: "gemini-imagen" | "gemini-nano-banana" = "gemini-nano-banana",
  aspectRatio: "9:16" | "16:9" | "1:1" = "9:16"
): Promise<string> {
  if (model === "gemini-imagen") {
    return generateWithImagen(prompt, apiKey, aspectRatio);
  }
  return generateWithNanoBanana(prompt, apiKey);
}
