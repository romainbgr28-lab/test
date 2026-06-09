export async function synthesizeSpeech(
  text: string,
  voiceId: string,
  apiKey: string,
  language: "fr" | "en" = "fr"
): Promise<Buffer> {
  const languageCode = language === "fr" ? "fr-FR" : "en-US";
  const voiceName = `${languageCode}-Chirp3-HD-${voiceId}`;

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode,
          name: voiceName,
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.1,
        },
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message ?? "Erreur Google Cloud TTS");
  }

  return Buffer.from(data.audioContent, "base64");
}
