# Proxy Cloudflare Worker — API Mistral (Formation CGP)

Ce Worker résout le blocage CORS : le navigateur appelle le Worker (qui autorise
le cross-origin), et le Worker relaye vers `https://api.mistral.ai/v1/chat/completions`
en ajoutant la clé API **côté serveur**. La clé ne transite jamais par le navigateur.

## Prérequis

- Un compte Cloudflare (le plan gratuit suffit largement : 100 000 requêtes/jour)
- Node.js ≥ 18 installé
- Votre clé API Mistral (console.mistral.ai → API Keys)

## Déploiement pas à pas

Toutes les commandes se lancent **depuis ce dossier** (`formation-cgp/worker/`).

### 1. Se connecter à Cloudflare

```bash
npx wrangler login
```

Une page de navigateur s'ouvre : autorisez Wrangler sur votre compte Cloudflare.

### 2. Déployer le Worker

```bash
npx wrangler deploy
```

À la fin du déploiement, Wrangler affiche l'URL publique du Worker, de la forme :

```
https://formation-cgp-proxy.<votre-sous-domaine>.workers.dev
```

**Copiez cette URL**, c'est elle qu'il faudra donner au front. Vous pouvez aussi
la retrouver à tout moment dans le dashboard Cloudflare :
*Workers & Pages → formation-cgp-proxy → onglet Settings → Domains & Routes*.

### 3. Enregistrer la clé Mistral en secret (jamais dans le code)

```bash
npx wrangler secret put MISTRAL_API_KEY
```

Collez votre clé Mistral quand Wrangler la demande. Le secret est chiffré côté
Cloudflare et immédiatement disponible pour le Worker déployé — pas besoin de
redéployer.

### 4. Tester le Worker

```bash
curl -s https://formation-cgp-proxy.<votre-sous-domaine>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"model":"mistral-small-latest","messages":[{"role":"user","content":"Réponds par le JSON {\"ok\": true}"}],"jsonMode":true}'
```

Vous devez recevoir une réponse JSON Mistral (`choices[0].message.content`...).
Si vous recevez une erreur mentionnant `MISTRAL_API_KEY`, reprenez l'étape 3.

### 5. Brancher le front

Dans `formation-cgp.jsx`, remplacez la constante en haut du fichier :

```js
const WORKER_URL_PAR_DEFAUT = "https://formation-cgp-proxy.<votre-sous-domaine>.workers.dev";
```

L'écran de démarrage propose aussi un champ optionnel « URL du Worker » qui
permet de changer de proxy sans recompiler.

## Mise à jour ultérieure

- Modifier le code du Worker → `npx wrangler deploy` (l'URL ne change pas)
- Changer la clé Mistral → `npx wrangler secret put MISTRAL_API_KEY`
- Voir les logs en direct → `npx wrangler tail`

## Sécurité — à savoir

`Access-Control-Allow-Origin: *` signifie que n'importe quel site connaissant
l'URL du Worker peut consommer votre quota Mistral. Pour un usage personnel
c'est acceptable ; si vous voulez verrouiller, remplacez `*` par l'origine
exacte de votre artifact dans `src/index.js` (constante `CORS_HEADERS`).
