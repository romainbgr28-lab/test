import { NextResponse } from "next/server";
import {
  buildScriptSystemPrompt,
  callMistralChat,
  callMistralWithWebSearch,
  extractJson,
} from "@/lib/mistral";
import type { Language, Platform, ViralityScore } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RawSegment {
  order: number;
  narration: string;
  visualDescription: string;
  duration: number;
}

interface ScriptResponse {
  viralityScore: ViralityScore;
  segments: RawSegment[];
}

const MAX_ITERATIONS = 4;
const TARGET_SCORE = 100;

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  youtube: "YouTube",
  reels: "Instagram Reels",
};

function encodeEvent(event: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

const HEARTBEAT_PHRASES = [
  "L'IA explore le web et croise les sources...",
  "Analyse des hooks et des accroches qui cartonnent en ce moment...",
  "Vérification des chiffres et des faits trouvés...",
  "Construction de la structure narrative segment par segment...",
  "Ajustement du rythme et des transitions pour maximiser la rétention...",
];

/**
 * Emits periodic "still working" status updates while a long Mistral call runs,
 * so the live log keeps moving instead of looking frozen for tens of seconds.
 */
async function withHeartbeat<T>(
  task: Promise<T>,
  send: (event: Record<string, unknown>) => void,
  iteration: number
): Promise<T> {
  let tick = 0;
  const interval = setInterval(() => {
    send({
      type: "status",
      iteration,
      message: HEARTBEAT_PHRASES[tick % HEARTBEAT_PHRASES.length],
    });
    tick++;
  }, 6000);

  try {
    return await task;
  } finally {
    clearInterval(interval);
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    subject,
    platform,
    language,
    nicheInstructions,
    duration,
    model,
    apiKey,
    regenerateSegmentOrder,
    existingSegment,
  } = body as {
    subject: string;
    platform: Platform;
    language: Language;
    nicheInstructions: string;
    duration: number;
    model: string;
    apiKey?: string;
    regenerateSegmentOrder?: number;
    existingSegment?: RawSegment;
  };

  const key = apiKey || process.env.MISTRAL_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Clé API Mistral manquante. Configure MISTRAL_API_KEY dans tes variables d'environnement." },
      { status: 400 }
    );
  }

  if (!subject || !platform || !language || !nicheInstructions || !duration || !model) {
    return NextResponse.json({ error: "Paramètres manquants pour générer le script." }, { status: 400 });
  }

  const systemPrompt = buildScriptSystemPrompt({ platform, language, nicheInstructions, duration, subject });

  // Régénération d'un segment unique : pas de recherche web ni de boucle, réponse JSON classique.
  if (regenerateSegmentOrder && existingSegment) {
    try {
      const userPrompt = `Régénère uniquement le segment numéro ${regenerateSegmentOrder} de ce script (sujet global : "${subject}"). Voici le segment actuel à améliorer :
Narration : ${existingSegment.narration}
Description visuelle : ${existingSegment.visualDescription}
Durée : ${existingSegment.duration}s

Renvoie un unique objet JSON pour ce segment au format :
{ "order": ${regenerateSegmentOrder}, "narration": "...", "visualDescription": "...", "duration": ${existingSegment.duration} }
Aucun texte avant ou après le JSON.`;

      const raw = await callMistralChat({
        apiKey: key,
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      const segment = extractJson<RawSegment>(raw);
      return NextResponse.json({ segment });
    } catch (error) {
      console.error("Erreur /api/generate-script (régénération segment) :", error);
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      return NextResponse.json({ error: `Échec de la régénération du segment : ${message}` }, { status: 500 });
    }
  }

  const platformLabel = PLATFORM_LABELS[platform];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encodeEvent(event));

      try {
        let best: ScriptResponse | null = null;
        let previous: ScriptResponse | null = null;

        for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
          let userPrompt: string;
          if (iteration === 1) {
            send({
              type: "status",
              iteration,
              message: `Recherche d'informations sur le sujet « ${subject} » et les tendances ${platformLabel}...`,
            });
            userPrompt = `Sujet : ${subject}

Avant de rédiger, utilise la recherche web pour repérer les tendances actuelles, statistiques marquantes, angles populaires et formulations qui font le buzz sur ce sujet et sur des contenus ${platformLabel} similaires. Intègre ces informations réelles et récentes dans le script pour maximiser l'impact, la crédibilité et le score de viralité (objectif : 100/100).`;
          } else {
            send({
              type: "status",
              iteration,
              message: `Itération ${iteration}/${MAX_ITERATIONS} : nouvelle recherche pour combler les faiblesses détectées (score actuel ${previous!.viralityScore.score}/100)...`,
            });
            userPrompt = `Le script précédent a obtenu un score de viralité de ${previous!.viralityScore.score}/100. Voici l'analyse :
- Hook : ${previous!.viralityScore.hookStrength}
- Risque de décrochage : ${previous!.viralityScore.retentionRisk}
- Clarté du CTA : ${previous!.viralityScore.ctaClarity}
- Suggestions à appliquer impérativement : ${previous!.viralityScore.suggestions.join(" / ")}

Relance une recherche web pour creuser davantage le sujet "${subject}" (nouveaux angles, données chiffrées récentes, formulations virales actuelles), puis réécris ENTIÈREMENT un script amélioré qui corrige tous ces points faibles. Ne te contente pas de reformuler : approfondis, muscle chaque segment et vise un score de 100/100.`;
          }

          let rawText: string;
          let searchQueries: string[] = [];
          try {
            const result = await withHeartbeat(
              callMistralWithWebSearch({ apiKey: key, model, instructions: systemPrompt, userMessage: userPrompt }),
              send,
              iteration
            );
            rawText = result.text;
            searchQueries = result.searchQueries;
            if (searchQueries.length > 0) {
              send({
                type: "status",
                iteration,
                message: `Recherches effectuées sur le web : ${searchQueries.slice(0, 3).join(" • ")}`,
              });
            } else {
              send({ type: "status", iteration, message: "Analyse des résultats de recherche en cours..." });
            }
          } catch (searchError) {
            console.error("Recherche web Mistral indisponible, repli sans recherche :", searchError);
            send({
              type: "status",
              iteration,
              message: "Recherche web indisponible pour le moment, génération directe avec les connaissances du modèle...",
            });
            rawText = await withHeartbeat(
              callMistralChat({
                apiKey: key,
                model,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt },
                ],
              }),
              send,
              iteration
            );
          }

          send({ type: "status", iteration, message: "Rédaction du script et calcul du score de viralité..." });

          const parsed = extractJson<ScriptResponse>(rawText);
          if (!parsed.segments || !Array.isArray(parsed.segments) || parsed.segments.length === 0) {
            throw new Error("Le script généré est invalide. Réessaie.");
          }

          send({
            type: "status",
            iteration,
            score: parsed.viralityScore.score,
            message: `Score de viralité obtenu : ${parsed.viralityScore.score}/100`,
          });

          if (!best || parsed.viralityScore.score > best.viralityScore.score) {
            best = parsed;
          }
          previous = parsed;

          if (parsed.viralityScore.score >= TARGET_SCORE) {
            send({ type: "status", iteration, message: "Score maximal atteint ! Finalisation du script..." });
            break;
          }

          if (iteration < MAX_ITERATIONS) {
            send({
              type: "status",
              iteration,
              message: `Score actuel ${parsed.viralityScore.score}/100 : l'IA continue de chercher et de retravailler le script pour viser 100/100...`,
            });
          } else {
            send({ type: "status", iteration, message: "Nombre maximal d'itérations atteint, sélection de la meilleure version..." });
          }
        }

        if (!best) {
          throw new Error("Le script généré est invalide. Réessaie.");
        }

        send({ type: "status", message: "Script finalisé !" });
        send({ type: "result", viralityScore: best.viralityScore, segments: best.segments });
      } catch (error) {
        console.error("Erreur /api/generate-script :", error);
        const message = error instanceof Error ? error.message : "Erreur inconnue";
        send({ type: "error", message: `Échec de la génération du script : ${message}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
