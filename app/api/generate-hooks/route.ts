import { NextResponse } from "next/server";
import { callMistralChat, extractJson } from "@/lib/mistral";
import type { HookVariant, Language, Platform } from "@/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subject, currentHook, platform, language, model, apiKey } = body as {
      subject: string;
      currentHook: string;
      platform: Platform;
      language: Language;
      model: string;
      apiKey?: string;
    };

    const key = apiKey || process.env.MISTRAL_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "Clé API Mistral manquante." }, { status: 400 });
    }
    if (!subject || !currentHook || !model) {
      return NextResponse.json({ error: "Paramètres manquants pour générer les hooks." }, { status: 400 });
    }

    const languageLabel = language === "en" ? "anglais" : "français";

    const raw = await callMistralChat({
      apiKey: key,
      model,
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content: `Tu es un expert des 3 premières secondes des vidéos courtes (${platform}). Sur un short, le hook détermine la rétention, et la rétention détermine la monétisation. Tu écris en ${languageLabel}. Tu réponds uniquement en JSON valide.`,
        },
        {
          role: "user",
          content: `Sujet de la vidéo : "${subject}"
Hook actuel : "${currentHook}"

Propose 3 hooks alternatifs RADICALEMENT différents (max 15 mots chacun, lisibles en 3 secondes), chacun avec une mécanique psychologique distincte parmi : chiffre choc, question provocante, affirmation contre-intuitive, mise en situation "toi", interdit/secret révélé.

Réponds UNIQUEMENT avec ce JSON :
{"variants":[{"narration":"[le hook]","style":"[la mécanique utilisée, 2-4 mots]"}]}`,
        },
      ],
    });

    const parsed = extractJson<{ variants: HookVariant[] }>(raw);
    const variants = (parsed.variants ?? [])
      .filter((v) => v && typeof v.narration === "string" && v.narration.trim())
      .slice(0, 3)
      .map((v) => ({ narration: v.narration.trim(), style: typeof v.style === "string" ? v.style.trim() : "" }));
    if (variants.length === 0) throw new Error("Aucune variante de hook renvoyée par l'IA.");

    return NextResponse.json({ variants });
  } catch (error) {
    console.error("Erreur /api/generate-hooks :", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: `Échec de la génération des hooks : ${message}` }, { status: 500 });
  }
}
