export async function generateImageWithGemini(
  prompt: string,
  apiKey: string,
  aspectRatio: "9:16" | "16:9" | "1:1" = "9:16"
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
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
