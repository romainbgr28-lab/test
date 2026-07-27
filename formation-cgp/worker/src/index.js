// ============================================================
// Cloudflare Worker — proxy CORS pour l'API Mistral
//
// Rôle :
//   1. Reçoit un POST du front avec { messages, model, temperature, jsonMode }
//   2. Relaye vers https://api.mistral.ai/v1/chat/completions en ajoutant
//      l'Authorization avec la clé stockée en secret côté Worker
//      (env.MISTRAL_API_KEY) — la clé ne transite jamais par le navigateur
//   3. Gère le préflight CORS (OPTIONS) et renvoie les en-têtes
//      Access-Control-Allow-* sur toutes les réponses
//   4. Renvoie la réponse JSON de Mistral telle quelle (même code HTTP)
// ============================================================

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    // 1) Préflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Méthode non autorisée. Utilisez POST." }, 405);
    }

    if (!env.MISTRAL_API_KEY) {
      return jsonResponse(
        { error: "Secret MISTRAL_API_KEY absent côté Worker. Exécutez : npx wrangler secret put MISTRAL_API_KEY" },
        500
      );
    }

    // 2) Lecture et validation du body envoyé par le front
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Body JSON invalide." }, 400);
    }

    const { messages, model, temperature, jsonMode } = body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: "Champ 'messages' manquant ou vide." }, 400);
    }
    if (typeof model !== "string" || !model) {
      return jsonResponse({ error: "Champ 'model' manquant." }, 400);
    }

    // 3) Relais vers Mistral avec la clé côté serveur
    let upstream;
    try {
      upstream = await fetch(MISTRAL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: typeof temperature === "number" ? temperature : 0.4,
          max_tokens: 2000,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
      });
    } catch {
      return jsonResponse({ error: "Impossible de joindre l'API Mistral depuis le Worker." }, 502);
    }

    // 4) Réponse Mistral renvoyée telle quelle, avec les en-têtes CORS
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  },
};
