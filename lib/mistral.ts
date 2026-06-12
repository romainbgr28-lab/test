import type { Language, Platform } from "@/types";

export const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";
export const MISTRAL_CONVERSATIONS_ENDPOINT = "https://api.mistral.ai/v1/conversations";

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

export function buildScriptSystemPrompt(params: {
  platform: Platform;
  language: Language;
  scriptInstructions: string;
  viralityInstructions?: string;
  duration: number;
  subject: string;
}): string {
  const platformLabel = PLATFORM_LABELS[params.platform];
  const languageLabel = LANGUAGE_LABELS[params.language];

  return `Tu es un expert en copywriting viral TikTok avec 10 ans d'expérience.
Tu maîtrises la psychologie de l'attention humaine et les mécanismes neurobiologiques qui poussent à continuer à regarder une vidéo.

PRINCIPES PSYCHOLOGIQUES QUE TU APPLIQUES SYSTÉMATIQUEMENT :
- Loop ouvert : chaque segment crée une question dans l'esprit du spectateur que seul le segment suivant peut résoudre
- Pattern interrupt : varier le rythme, les chiffres chocs, les questions rhétoriques pour réactiver l'attention toutes les 5 à 7 secondes
- Curiosity gap : ne jamais tout révéler d'un coup, toujours laisser une promesse non tenue jusqu'au segment suivant
- Social proof + fear of missing out : ancrer dans le réel avec des chiffres, des situations reconnaissables
- Micro-engagements : poser des questions auxquelles le spectateur répond mentalement "oui" pour créer une validation continue

STRUCTURE OBLIGATOIRE POUR ${params.duration} SECONDES :
- Ligne 1 (hook) : Une phrase choc. Chiffre, question provocante ou affirmation contre-intuitive. Jamais plus de 15 mots.
- Corps : Chaque phrase = une idée, une preuve, une révélation. Créer un micro-cliffhanger toutes les 2-3 phrases.
- Dernière ligne (CTA) : Direct, simple, une seule action demandée.

CALCUL OBLIGATOIRE : Pour ${params.duration} secondes à 2,5 mots par seconde = environ ${Math.round(params.duration * 2.5)} mots au total. Compte les mots avant de répondre. Ne génère pas moins.

RÈGLES DE NARRATION :
- Phrases courtes. Maximum 20 mots par phrase.
- Rythme TikTok : une idée = une phrase = une respiration
- Utiliser "tu" pas "vous"
- Jamais de transition molle ("ensuite", "puis", "donc"). Transitions chocs : "Mais voilà le truc.", "Et c'est là que ça devient fou.", "La plupart des gens ignorent ça."
- Environ 2,5 mots par seconde à voix haute

RÈGLE ABSOLUE SUR LES FAITS :
Une NOTE DE RECHERCHE te sera fournie avec des faits, chiffres et informations réelles et vérifiées.
- Utilise UNIQUEMENT les faits présents dans cette note. N'en invente aucun.
- Si tu cites un chiffre, une date, un événement ou une personne, il doit être explicitement mentionné dans la note.
- N'extrapole pas, ne complète pas de mémoire : si l'information n'est pas dans la note, ne l'utilise pas.
- Ne fabrique jamais de statistiques, résultats sportifs, classements ou événements non confirmés dans la note.

Instructions de niche / sujet du script (à respecter scrupuleusement) : ${params.scriptInstructions}
${params.viralityInstructions?.trim() ? `Instructions de viralité et de format à privilégier pour ce profil : ${params.viralityInstructions.trim()}\n` : ""}Plateforme : ${platformLabel}
Langue : ${languageLabel}

Sujet : ${params.subject}

FORMAT DE RÉPONSE : JSON strict uniquement, aucun texte avant ou après.
{
  "viralityScore": {
    "score": [0-100],
    "hookStrength": "[analyse en 1 phrase]",
    "retentionRisk": "[analyse en 1 phrase]",
    "ctaClarity": "[analyse en 1 phrase]",
    "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
  },
  "script": "[texte complet du script à lire, en une seule chaîne de caractères. Chaque phrase sur une nouvelle ligne (\\n). Ne pas inclure de balises ou de marqueurs de segment.]"
}`;
}

export interface MistralChatParams {
  apiKey: string;
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
}

export async function callMistralChat(params: MistralChatParams): Promise<string> {
  const response = await fetch(MISTRAL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral API a répondu avec une erreur (${response.status}) : ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Réponse Mistral invalide : aucun contenu trouvé.");
  }
  return content;
}

export interface MistralWebSearchParams {
  apiKey: string;
  model: string;
  instructions: string;
  userMessage: string;
}

export interface MistralWebSearchResult {
  text: string;
  searchQueries: string[];
  sources: string[];
}

/**
 * Calls Mistral's Conversations API with the built-in `web_search` connector,
 * letting the model autonomously search the web before answering.
 */
export async function callMistralWithWebSearch(params: MistralWebSearchParams): Promise<MistralWebSearchResult> {
  const response = await fetch(MISTRAL_CONVERSATIONS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      instructions: params.instructions,
      inputs: [{ role: "user", content: params.userMessage }],
      tools: [{ type: "web_search" }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral Conversations API a répondu avec une erreur (${response.status}) : ${errorText}`);
  }

  const data = await response.json();
  const outputs: unknown[] = Array.isArray(data?.outputs) ? data.outputs : [];

  const searchQueries: string[] = [];
  const sources: string[] = [];
  let text = "";

  for (const entry of outputs) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;

    if (item.type === "tool.execution") {
      const args = item.arguments as Record<string, unknown> | undefined;
      const info = item.info as Record<string, unknown> | undefined;
      const query = (args?.query ?? info?.query) as unknown;
      if (typeof query === "string" && query.trim()) {
        searchQueries.push(query.trim());
      }
    }

    if (item.type === "message.output") {
      const content = item.content;
      if (typeof content === "string") {
        text += content;
      } else if (Array.isArray(content)) {
        for (const chunk of content) {
          if (!chunk || typeof chunk !== "object") continue;
          const c = chunk as Record<string, unknown>;
          if (c.type === "text" && typeof c.text === "string") {
            text += c.text;
          } else if (c.type === "tool_reference") {
            const url = (c.url ?? c.source) as unknown;
            if (typeof url === "string" && url.trim()) sources.push(url.trim());
          }
        }
      }
    }
  }

  if (!text.trim()) {
    throw new Error("Réponse Mistral (recherche web) invalide : aucun contenu trouvé.");
  }

  return { text, searchQueries: [...new Set(searchQueries)], sources: [...new Set(sources)] };
}

/**
 * Runs a fact-grounding pass: strips every specific claim in `script` that
 * cannot be found verbatim or by clear implication in `researchBrief`.
 * Returns the corrected script as a plain string.
 */
export async function groundScriptToResearch(params: {
  apiKey: string;
  model: string;
  script: string;
  researchBrief: string;
}): Promise<string> {
  const systemPrompt = `Tu es un vérificateur de faits strict. Ton seul rôle est de relire un script et de supprimer ou remplacer tout fait précis qui n'est PAS explicitement mentionné dans la NOTE DE RECHERCHE fournie.

RÈGLES :
- Chiffres, dates, noms propres, types de blessure, résultats, classements → vérifie chacun dans la note. S'il n'y est pas : supprime-le ou remplace-le par une formulation vague ("une blessure grave", "plusieurs semaines d'arrêt"…).
- Ne remplace jamais un fait manquant par un autre fait inventé.
- Préserve le style, le rythme et la structure du script. Ne réécris que ce qui est factuellement incorrect ou non vérifié.
- Réponds UNIQUEMENT avec le script corrigé, sans commentaire ni JSON.`;

  const userPrompt = `NOTE DE RECHERCHE :
"""
${params.researchBrief}
"""

SCRIPT À VÉRIFIER :
"""
${params.script}
"""

Renvoie le script corrigé.`;

  return callMistralChat({
    apiKey: params.apiKey,
    model: params.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
  });
}

export function extractJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Impossible d'extraire un JSON de la réponse de l'IA.");
  }
  const jsonSlice = trimmed.slice(start, end + 1);
  return JSON.parse(jsonSlice) as T;
}
