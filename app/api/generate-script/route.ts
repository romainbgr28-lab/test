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

const LANGUAGE_LABELS: Record<Language, string> = {
  fr: "français",
  en: "anglais",
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
    sourceContent,
    platform,
    language,
    scriptInstructions,
    viralityInstructions,
    duration,
    model,
    apiKey,
    regenerateSegmentOrder,
    existingSegment,
  } = body as {
    subject: string;
    sourceContent?: string;
    platform: Platform;
    language: Language;
    scriptInstructions: string;
    viralityInstructions?: string;
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

  if (!subject || !platform || !language || !scriptInstructions || !duration || !model) {
    return NextResponse.json({ error: "Paramètres manquants pour générer le script." }, { status: 400 });
  }

  const systemPrompt = buildScriptSystemPrompt({ platform, language, scriptInstructions, viralityInstructions, duration, subject });

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
  const languageLabel = LANGUAGE_LABELS[language];
  const trimmedSource = sourceContent?.trim() ?? "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encodeEvent(event));

      try {
        // ÉTAPE 1 — Constituer une note de recherche factuelle qui servira de base au script.
        // Soit l'utilisateur a fourni son propre contenu (source prioritaire), soit on lance
        // une vraie recherche web (en texte brut, séparée de l'écriture du JSON, sinon le modèle
        // saute la recherche et répond de mémoire).
        let researchBrief = "";

        if (trimmedSource) {
          send({ type: "status", message: "Contenu source fourni : utilisation comme base du script (aucune invention)." });
          researchBrief = trimmedSource;
        } else {
          send({
            type: "status",
            message: `Recherche web en cours sur « ${subject} » (tendances et données récentes ${platformLabel})...`,
          });
          const researchInstruction = `Tu es un assistant de recherche rigoureux. Tu DOIS réellement utiliser l'outil de recherche web pour collecter des informations à jour : ne réponds jamais uniquement de mémoire. Réponds en ${languageLabel}.`;
          const researchQuery = `Sujet à rechercher : "${subject}".
Contexte / niche : ${scriptInstructions}
Plateforme cible : ${platformLabel}.

Effectue plusieurs recherches web et rédige une NOTE DE RECHERCHE dense et factuelle (pas un script, pas de JSON) contenant :
- 6 à 10 faits, chiffres et statistiques RÉCENTS et vérifiables (précise l'ordre de grandeur, l'année et la source quand c'est possible)
- les angles, accroches et tendances qui fonctionnent actuellement sur ce sujet
- des exemples concrets, anecdotes ou cas réels marquants
- les idées reçues à casser ou les vérités contre-intuitives
N'invente aucune donnée : tout doit provenir de tes recherches.`;

          try {
            const result = await withHeartbeat(
              callMistralWithWebSearch({ apiKey: key, model, instructions: researchInstruction, userMessage: researchQuery }),
              send,
              1
            );
            researchBrief = result.text.trim();
            if (result.searchQueries.length > 0) {
              send({
                type: "status",
                message: `Recherches effectuées : ${result.searchQueries.slice(0, 4).join(" • ")}`,
              });
            }
            if (result.sources.length > 0) {
              send({ type: "status", message: `${result.sources.length} source(s) web consultée(s).` });
              send({ type: "sources", sources: result.sources });
            }
          } catch (searchError) {
            console.error("Recherche web Mistral indisponible, repli sans recherche :", searchError);
            send({
              type: "status",
              message: "Recherche web indisponible : rédaction avec les connaissances du modèle.",
            });
            researchBrief = "";
          }
        }

        // ÉTAPE 2 — Écrire le script JSON, ancré dans la note de recherche, puis l'améliorer par itérations.
        let best: ScriptResponse | null = null;
        let previous: ScriptResponse | null = null;

        const sourceLabel = trimmedSource
          ? "CONTENU SOURCE FOURNI PAR L'UTILISATEUR (source prioritaire, à respecter, n'invente rien au-delà)"
          : "NOTE DE RECHERCHE (informations réelles et récentes à intégrer, n'invente rien au-delà)";
        const briefBlock = researchBrief
          ? `\n\n${sourceLabel} :\n"""\n${researchBrief}\n"""\n`
          : "";

        for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
          let userPrompt: string;
          if (iteration === 1) {
            send({ type: "status", iteration, message: "Rédaction du script à partir des informations collectées..." });
            userPrompt = `Sujet : ${subject}${briefBlock}
Rédige le script complet en t'appuyant sur ces informations : intègre les chiffres et faits concrets ci-dessus pour maximiser la crédibilité et le score de viralité (objectif : 100/100). Réponds uniquement avec le JSON demandé.`;
          } else {
            send({
              type: "status",
              iteration,
              message: `Itération ${iteration}/${MAX_ITERATIONS} : amélioration du script (score actuel ${previous!.viralityScore.score}/100)...`,
            });
            userPrompt = `Le script précédent a obtenu un score de viralité de ${previous!.viralityScore.score}/100. Voici l'analyse :
- Hook : ${previous!.viralityScore.hookStrength}
- Risque de décrochage : ${previous!.viralityScore.retentionRisk}
- Clarté du CTA : ${previous!.viralityScore.ctaClarity}
- Suggestions à appliquer impérativement : ${previous!.viralityScore.suggestions.join(" / ")}
${briefBlock}
Réécris ENTIÈREMENT un script amélioré qui corrige tous ces points faibles, en continuant de t'appuyer sur les informations factuelles ci-dessus. Ne te contente pas de reformuler : approfondis, muscle chaque segment et vise un score de 100/100. Réponds uniquement avec le JSON demandé.`;
          }

          const rawText = await withHeartbeat(
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

          send({ type: "status", iteration, message: "Analyse du script et calcul du score de viralité..." });

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
