import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// DONNÉES STATIQUES — Référentiel des thèmes (4 couches)
// ============================================================
const COUCHES = [
  {
    id: "c1",
    nom: "Socle juridico-fiscal",
    couleur: "indigo",
    themes: [
      { id: "fisc_pp", nom: "Fiscalité des personnes physiques", detail: "IR, barème, quotient familial, PV mobilières/immobilières, IFI" },
      { id: "fisc_av", nom: "Fiscalité de l'assurance-vie", detail: "Art. 990 I, 757 B, antériorité fiscale, rachat vs succession" },
      { id: "demembrement", nom: "Démembrement de propriété", detail: "Usufruit/nue-propriété, barème art. 669 CGI, réserve d'usufruit" },
      { id: "structures", nom: "Structures de détention", detail: "SCI IR vs IS, EI, EURL, holding, régimes matrimoniaux" },
      { id: "defisc_immo", nom: "Dispositifs immobiliers défiscalisants", detail: "Pinel, Denormandie, Malraux, LMNP, monuments historiques" },
      { id: "succession", nom: "Droits de succession et donation", detail: "Abattements, barèmes, donation-partage, AV hors succession" },
      { id: "retraite", nom: "Retraite et prévoyance", detail: "PER individuel/collectif, régimes obligatoires, rente vs capital" },
    ],
  },
  {
    id: "c2",
    nom: "Enveloppes et arbitrages",
    couleur: "teal",
    themes: [
      { id: "comparatif_env", nom: "AV vs PER vs PEA vs CTO", detail: "Logique comparative complète des enveloppes" },
      { id: "choix_profil", nom: "Critères de choix selon profil client", detail: "Horizon, TMI, objectif, liquidité, transmission" },
      { id: "pea", nom: "PEA et PEA-PME", detail: "Plafonds, fiscalité, contraintes" },
      { id: "cto", nom: "Comptes-titres ordinaires", detail: "Flat tax, option barème progressif" },
    ],
  },
  {
    id: "c3",
    nom: "Allocation d'actifs et marchés",
    couleur: "amber",
    themes: [
      { id: "fonds_euro", nom: "Fonds euro", detail: "Composition, PPB, taux de revalorisation, garantie" },
      { id: "uc", nom: "Unités de compte", detail: "Actions, obligations, SCPI/OPCI, private equity, dette privée" },
      { id: "diversification", nom: "Diversification, volatilité, corrélation", detail: "Notions clés et horizon de placement" },
      { id: "macro", nom: "Cycles économiques et macro", detail: "Contexte macro/géopolitique appliqué à l'allocation" },
      { id: "gestion", nom: "Gestion pilotée vs gestion libre", detail: "Modes de gestion et adéquation client" },
    ],
  },
  {
    id: "c4",
    nom: "Stratégie et relationnel",
    couleur: "violet",
    themes: [
      { id: "bilan", nom: "Bilan patrimonial complet", detail: "Actif/passif, objectifs de vie" },
      { id: "objections", nom: "Traitement des objections clients", detail: "Anticipation et réponses structurées" },
      { id: "vente", nom: "Vente complémentaire éthique", detail: "Cohérence besoin client / proposition" },
      { id: "transmission", nom: "Transmission d'entreprise", detail: "Pacte Dutreil, cession" },
    ],
  },
];

const TOUS_THEMES = COUCHES.flatMap((c) => c.themes.map((t) => ({ ...t, coucheId: c.id, coucheNom: c.nom, couleur: c.couleur })));
const themeById = (id) => TOUS_THEMES.find((t) => t.id === id);

const COULEURS = {
  indigo: { bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-800", accent: "bg-indigo-700", accentText: "text-indigo-700", bar: "bg-indigo-500", ring: "border-l-indigo-600" },
  teal: { bg: "bg-teal-50", border: "border-teal-300", text: "text-teal-800", accent: "bg-teal-700", accentText: "text-teal-700", bar: "bg-teal-500", ring: "border-l-teal-600" },
  amber: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-800", accent: "bg-amber-700", accentText: "text-amber-700", bar: "bg-amber-500", ring: "border-l-amber-600" },
  violet: { bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-800", accent: "bg-violet-700", accentText: "text-violet-700", bar: "bg-violet-500", ring: "border-l-violet-600" },
};

const NIVEAUX = ["Débutant", "Intermédiaire", "Avancé"];
const MODELES = ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"];

const MODE_LABELS = {
  cours: "Cours",
  qcm: "QCM",
  ouverte: "Question ouverte",
  situation: "Mise en situation",
  revision: "Révisions du jour",
  dashboard: "Tableau de bord",
};

// ============================================================
// BADGES — définitions statiques, déblocage stocké via window.storage
// ============================================================
const BADGES = [
  { id: "premier_cours", nom: "Premier cours lu", desc: "Lire sa première fiche de cours.", icone: "📖" },
  { id: "serie_10", nom: "Série de 10", desc: "10 bonnes réponses d'affilée en QCM.", icone: "🎯" },
  { id: "couche_exploree", nom: "Couche explorée", desc: "Travailler tous les thèmes d'une même couche.", icone: "🧭" },
  { id: "premiere_revision", nom: "Révision bouclée", desc: "Terminer une session de révisions SM-2.", icone: "🔁" },
  { id: "premiere_situation", nom: "Premier entretien", desc: "Terminer une mise en situation client débriefée.", icone: "💬" },
  { id: "streak_3", nom: "3 jours d'affilée", desc: "S'entraîner trois jours consécutifs.", icone: "🔥" },
];

function coucheEntierementExploree(progressMap) {
  return COUCHES.some((c) =>
    c.themes.every((t) => {
      const p = progressMap[t.id];
      return p && p.coursLus + p.qcmTotal + p.openTotal + p.situations > 0;
    })
  );
}

// ============================================================
// ANIMATIONS CSS (pur CSS, aucune librairie)
// ============================================================
const STYLES_ANIMATIONS = `
@keyframes ecranIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.anim-ecran { animation: ecranIn 0.25s ease-out both; }
@keyframes accordeonIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
.anim-accordeon { animation: accordeonIn 0.22s ease-out both; }
@keyframes popCorrect { 0% { transform: scale(1); } 45% { transform: scale(1.03); } 100% { transform: scale(1); } }
.anim-correct { animation: popCorrect 0.3s ease-out; }
@keyframes secousse { 0%, 100% { transform: translateX(0); } 30% { transform: translateX(-4px); } 70% { transform: translateX(4px); } }
.anim-wrong { animation: secousse 0.28s ease-in-out; }
@keyframes comboPop { from { transform: scale(0.75); opacity: 0.4; } to { transform: scale(1); opacity: 1; } }
.anim-combo { animation: comboPop 0.25s ease-out; }
@keyframes toastIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
.anim-toast { animation: toastIn 0.3s ease-out both; }
`;

// ============================================================
// API MISTRAL — via proxy Cloudflare Worker (contournement CORS)
// La clé API vit uniquement côté Worker (secret MISTRAL_API_KEY),
// le front n'envoie que { messages, model, temperature, jsonMode }.
// ⬇ Remplacez par l'URL affichée par `npx wrangler deploy` (voir worker/README.md)
// ============================================================
const WORKER_URL_PAR_DEFAUT = "https://formation-cgp-proxy.VOTRE-SOUS-DOMAINE.workers.dev";

const SYSTEM_PROMPT = `Tu es un formateur expert en gestion de patrimoine (CGP) qui forme un conseiller AXA Banque & Assurance en France.
Règles absolues, sans exception :
1. RIGUEUR FISCALE : tu n'inventes JAMAIS un texte de loi, un numéro d'article ou un chiffre. Quand tu cites un barème, un taux, un plafond ou un abattement, tu ajoutes systématiquement la mention "(à vérifier sur bofip.gouv.fr)" car les valeurs évoluent chaque année.
2. FORMAT : tu réponds UNIQUEMENT avec un objet JSON valide et parsable. Aucun texte avant ou après. Aucune balise markdown. Aucun commentaire.
3. TON : pédagogique, clair, orienté pratique de terrain bancaire. Vocabulaire professionnel mais accessible.
4. LANGUE : français uniquement.`;

async function callMistral(workerUrl, model, messages, { jsonMode = true, temperature = 0.4 } = {}) {
  let res;
  try {
    res = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature, jsonMode }),
    });
  } catch (e) {
    throw new Error("Proxy Worker injoignable. Vérifiez l'URL du Worker (écran de démarrage) et votre connexion internet.");
  }
  if (!res.ok) {
    if (res.status === 401) throw new Error("Clé API refusée par Mistral (erreur 401). La clé stockée côté Worker est invalide : refaites `wrangler secret put MISTRAL_API_KEY`.");
    if (res.status === 429) throw new Error("Limite de débit atteinte (erreur 429). Attendez quelques secondes puis réessayez.");
    const t = await res.text().catch(() => "");
    throw new Error(`Erreur ${res.status} renvoyée par le proxy. ${t.slice(0, 180)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Réponse API vide ou mal formée.");
  return content;
}

function parseJSON(text) {
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* tombe en erreur ci-dessous */ }
    }
    throw new Error("La réponse du modèle n'est pas un JSON parsable. Régénérez.");
  }
}

// ============================================================
// SM-2 (calcul local, aucun appel API)
// ============================================================
function sm2Update(card, quality) {
  let ef = card.ef ?? 2.5;
  let reps = card.reps ?? 0;
  let interval = card.interval ?? 0;
  if (quality >= 3) {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ef);
    reps += 1;
  } else {
    reps = 0;
    interval = 1;
  }
  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ef < 1.3) ef = 1.3;
  return { ...card, ef, reps, interval, nextReview: Date.now() + interval * 86400000, lastQuality: quality, lastReview: Date.now() };
}

// ============================================================
// STOCKAGE (window.storage — clés groupées par thème pour limiter les appels)
// review:{themeId} -> { cards: { [qid]: card } }
// sessions -> [ {date, themeId, mode, score} ]
// progress -> { [themeId]: { coursLus, qcmTotal, qcmOk, openTotal, openOk, situations } }
// badges -> { [badgeId]: dateISO }
// ============================================================
async function stGet(key, fallback) {
  try {
    const r = await window.storage.get(key);
    return r ? JSON.parse(r.value) : fallback;
  } catch {
    return fallback;
  }
}
async function stSet(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

async function loadAllReviews() {
  const out = {};
  try {
    const res = await window.storage.list("review:");
    const keys = res?.keys || [];
    for (const k of keys) {
      const themeId = k.replace("review:", "");
      const data = await stGet(k, { cards: {} });
      out[themeId] = data.cards || {};
    }
  } catch { /* pas de données */ }
  return out;
}

async function saveCard(themeId, card) {
  const data = await stGet(`review:${themeId}`, { cards: {} });
  data.cards[card.id] = card;
  await stSet(`review:${themeId}`, data);
}

async function logSession(entry) {
  const sessions = await stGet("sessions", []);
  sessions.unshift({ ...entry, date: new Date().toISOString() });
  await stSet("sessions", sessions.slice(0, 60));
}

async function bumpProgress(themeId, fn) {
  const p = await stGet("progress", {});
  const cur = p[themeId] || { coursLus: 0, qcmTotal: 0, qcmOk: 0, openTotal: 0, openOk: 0, situations: 0 };
  p[themeId] = fn(cur);
  await stSet("progress", p);
  return p;
}

// ============================================================
// STREAK — jours consécutifs d'activité, depuis l'historique sessions
// ============================================================
function calcStreak(sessions) {
  if (!sessions || sessions.length === 0) return 0;
  const jours = new Set(sessions.map((s) => new Date(s.date).toDateString()));
  const d = new Date();
  // le streak reste valide si la dernière activité date d'hier
  if (!jours.has(d.toDateString())) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (jours.has(d.toDateString())) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ============================================================
// STATUT D'UN THÈME — pour les pastilles de l'accueil
// rouge = jamais travaillé, orange = en cours, vert = maîtrisé (reps>=3 SM-2)
// ============================================================
const PASTILLES = {
  nouveau: { dot: "bg-red-400", label: "Jamais travaillé", bar: "bg-red-300" },
  encours: { dot: "bg-amber-400", label: "En cours", bar: "bg-amber-400" },
  maitrise: { dot: "bg-emerald-500", label: "Maîtrisé", bar: "bg-emerald-500" },
};

function statutTheme(themeId, progressMap, reviews) {
  const p = progressMap[themeId];
  const cards = Object.values(reviews[themeId] || {});
  const activite = (p ? p.coursLus + p.qcmTotal + p.openTotal + p.situations : 0) + cards.length;
  if (activite === 0) return { statut: "nouveau", ratio: 0, maitrisees: 0, nbCartes: 0 };
  const maitrisees = cards.filter((k) => (k.reps ?? 0) >= 3).length;
  const ratio = cards.length > 0 ? maitrisees / cards.length : 0;
  const statut = cards.length >= 3 && ratio >= 0.7 ? "maitrise" : "encours";
  return { statut, ratio, maitrisees, nbCartes: cards.length };
}

// ============================================================
// COMPOSANTS UTILITAIRES
// ============================================================
function AvertissementBofip() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <span className="mt-0.5 font-bold">⚠</span>
      <span>Chiffres, barèmes et plafonds générés par IA : vérifiez systématiquement les valeurs en vigueur sur <span className="font-semibold">bofip.gouv.fr</span> avant tout usage client.</span>
    </div>
  );
}

function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700"></div>
      <p className="text-sm">{label}</p>
    </div>
  );
}

function ErreurBloc({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-4">
      <p className="text-sm font-medium text-red-800">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800">
          Réessayer
        </button>
      )}
    </div>
  );
}

function BarreProgression({ ratio, couleurClasse }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full ${couleurClasse} transition-all duration-500`} style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}></div>
    </div>
  );
}

function Retour({ onClick, label = "Retour" }) {
  return (
    <button onClick={onClick} className="mb-4 flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
      ← {label}
    </button>
  );
}

// Icônes SVG inline par mode d'exercice (aucune librairie)
function IconeMode({ type, className = "h-5 w-5" }) {
  const p = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  if (type === "cours") {
    return (
      <svg {...p}>
        <path d="M12 7v14" />
        <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
      </svg>
    );
  }
  if (type === "qcm") {
    return (
      <svg {...p}>
        <path d="m3 17 2 2 4-4" />
        <path d="m3 7 2 2 4-4" />
        <path d="M13 6h8" />
        <path d="M13 12h8" />
        <path d="M13 18h8" />
      </svg>
    );
  }
  if (type === "ouverte") {
    return (
      <svg {...p}>
        <path d="M12 20h9" />
        <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
      </svg>
    );
  }
  // situation
  return (
    <svg {...p}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </svg>
  );
}

// Fil d'ariane cliquable : Accueil › Couche › Thème › Mode
function FilAriane({ ecran, theme, onAccueil, onCouche, onTheme }) {
  const segs = [{ id: "accueil", label: "Accueil", onClick: onAccueil }];
  if (ecran === "dashboard" || ecran === "revision") {
    segs.push({ id: ecran, label: MODE_LABELS[ecran] });
  } else if (theme && ["theme", "cours", "qcm", "ouverte", "situation"].includes(ecran)) {
    segs.push({ id: "couche", label: theme.coucheNom, onClick: onCouche });
    segs.push({ id: "theme", label: theme.nom, onClick: ecran !== "theme" ? onTheme : undefined });
    if (ecran !== "theme") segs.push({ id: ecran, label: MODE_LABELS[ecran] });
  }
  return (
    <nav className="flex items-center gap-1 overflow-x-auto whitespace-nowrap text-xs text-slate-500">
      {segs.map((s, i) => {
        const dernier = i === segs.length - 1;
        return (
          <span key={s.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-300">›</span>}
            {dernier || !s.onClick ? (
              <span className={dernier ? "font-semibold text-slate-800" : ""}>{s.label}</span>
            ) : (
              <button onClick={s.onClick} className="rounded px-1 py-0.5 transition hover:bg-slate-100 hover:text-slate-900">
                {s.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// Toast discret de déblocage de badge
function ToastBadge({ badge }) {
  if (!badge) return null;
  return (
    <div className="anim-toast fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <span className="text-2xl">{badge.icone}</span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Badge débloqué</p>
        <p className="text-sm font-semibold text-slate-900">{badge.nom}</p>
      </div>
    </div>
  );
}

// ============================================================
// ÉCRAN 1 — DÉMARRAGE (la clé API vit côté Worker, plus rien à saisir)
// ============================================================
function EcranConfig({ onStart }) {
  const [workerUrl, setWorkerUrl] = useState(WORKER_URL_PAR_DEFAUT);
  const [modele, setModele] = useState(MODELES[0]);
  const [avance, setAvance] = useState(false);
  const urlValide = /^https?:\/\/.+/.test(workerUrl.trim());
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <div className="mb-8">
        <div className="mb-3 inline-block rounded bg-blue-900 px-2 py-1 text-xs font-bold uppercase tracking-widest text-white">Formation CGP</div>
        <h1 className="text-3xl font-bold text-slate-900">Entraînement au conseil patrimonial</h1>
        <p className="mt-2 text-slate-600">Cours, QCM, questions ouvertes et mises en situation client, générés en temps réel par Mistral. Répétition espacée SM-2 intégrée.</p>
      </div>
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Modèle</label>
          <select value={modele} onChange={(e) => setModele(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-700 focus:outline-none">
            {MODELES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <button onClick={() => setAvance((a) => !a)} className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline">
          {avance ? "Masquer les options avancées" : "Options avancées (URL du proxy)"}
        </button>
        {avance && (
          <div className="anim-accordeon">
            <label className="mb-1 block text-sm font-medium text-slate-700">URL du Worker (proxy Mistral)</label>
            <input
              type="url"
              value={workerUrl}
              onChange={(e) => setWorkerUrl(e.target.value)}
              placeholder="https://formation-cgp-proxy.xxx.workers.dev"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">Permet de changer de proxy sans recompiler. La clé API Mistral est stockée côté Worker, jamais dans le navigateur.</p>
          </div>
        )}
        <button
          onClick={() => urlValide && onStart(workerUrl.trim(), modele)}
          disabled={!urlValide}
          className="w-full rounded-lg bg-blue-900 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Démarrer
        </button>
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">Outil d'entraînement. Aucun contenu généré ne constitue un conseil fiscal opposable.</p>
    </div>
  );
}

// ============================================================
// ÉCRAN 2 — ACCUEIL : streak, révisions dues, accordéon de couches
// ============================================================
function EcranAccueil({ dueCount, onReviser, onTheme, difficulte, setDifficulte, onDashboard, reviews, progress, streak, coucheOuverte, setCoucheOuverte }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Choisissez un thème</h1>
          <p className="text-sm text-slate-500">4 couches, du socle fiscal au relationnel client</p>
        </div>
        <div className="flex items-center gap-2">
          <div
            title="Jours consécutifs avec au moins une session d'entraînement"
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${streak > 0 ? "border-orange-200 bg-orange-50 text-orange-800" : "border-slate-200 bg-white text-slate-400"}`}
          >
            <span>🔥</span>
            <span className="font-bold">{streak}</span>
            <span className="text-xs">jour{streak > 1 ? "s" : ""} d'affilée</span>
          </div>
          <button onClick={onDashboard} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Tableau de bord
          </button>
        </div>
      </div>

      {dueCount > 0 && (
        <button onClick={onReviser} className="mb-6 flex w-full items-center justify-between rounded-xl border-2 border-blue-800 bg-blue-900 px-5 py-4 text-left text-white shadow-sm transition hover:bg-blue-800">
          <div>
            <p className="font-semibold">Révisions du jour</p>
            <p className="text-sm text-blue-200">{dueCount} question{dueCount > 1 ? "s" : ""} due{dueCount > 1 ? "s" : ""} selon l'algorithme SM-2, toutes couches confondues</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-blue-900">{dueCount}</span>
        </button>
      )}

      <div className="mb-6 flex items-center gap-2">
        <span className="text-sm font-medium text-slate-600">Difficulté :</span>
        {NIVEAUX.map((n) => (
          <button
            key={n}
            onClick={() => setDifficulte(n)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${difficulte === n ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-300 hover:border-slate-500"}`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Accordéon : une couche ouverte à la fois */}
      <div className="space-y-3">
        {COUCHES.map((couche, i) => {
          const c = COULEURS[couche.couleur];
          const ouverte = coucheOuverte === couche.id;
          const nbTravailles = couche.themes.filter((t) => statutTheme(t.id, progress, reviews).statut !== "nouveau").length;
          return (
            <div
              key={couche.id}
              className={`rounded-2xl border transition-colors duration-300 ${c.border} ${ouverte ? c.bg : "bg-white"}`}
              style={{ marginLeft: `${i * 4}px` }}
            >
              <button onClick={() => setCoucheOuverte(ouverte ? null : couche.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
                <div className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white ${c.accent}`}>Couche {i + 1}/4</span>
                  <h2 className={`text-base font-bold sm:text-lg ${c.text}`}>{couche.nom}</h2>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-xs text-slate-500 sm:inline">{nbTravailles}/{couche.themes.length} thème{nbTravailles > 1 ? "s" : ""} travaillé{nbTravailles > 1 ? "s" : ""}</span>
                  <span className={`text-slate-400 transition-transform duration-200 ${ouverte ? "rotate-90" : ""}`}>▸</span>
                </div>
              </button>
              {ouverte && (
                <div className="anim-accordeon grid gap-2 px-4 pb-4 sm:grid-cols-2">
                  {couche.themes.map((t) => {
                    const st = statutTheme(t.id, progress, reviews);
                    const pastille = PASTILLES[st.statut];
                    return (
                      <button
                        key={t.id}
                        onClick={() => onTheme(t.id)}
                        className={`rounded-xl border-l-4 ${c.ring} border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:shadow-md`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{t.nom}</p>
                          <span title={pastille.label} className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${pastille.dot}`}></span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{t.detail}</p>
                        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${pastille.bar} transition-all duration-500`} style={{ width: `${st.statut === "nouveau" ? 0 : Math.max(8, Math.round(st.ratio * 100))}%` }}></div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400"></span>Jamais travaillé</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400"></span>En cours</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500"></span>Maîtrisé (SM-2)</span>
      </div>
    </div>
  );
}

// ============================================================
// ÉCRAN 3 — CHOIX DU MODE POUR UN THÈME
// ============================================================
function EcranTheme({ theme, difficulte, onMode, onRetour, dueDansTheme }) {
  const c = COULEURS[theme.couleur];
  const modes = [
    { id: "cours", titre: "Cours", desc: "Fiche pédagogique dense : définition, mécanisme, exemple chiffré, pièges, opportunité commerciale." },
    { id: "qcm", titre: "QCM rapide", desc: dueDansTheme > 0 ? `${dueDansTheme} question(s) due(s) sur ce thème, puis génération de nouvelles.` : "Questions générées à la volée, correction instantanée, intégrées à la répétition espacée." },
    { id: "ouverte", titre: "Question ouverte", desc: "Réponse en texte libre, notée de 0 à 5 sur critères, avec feedback détaillé." },
    { id: "situation", titre: "Mise en situation client", desc: "Dialogue avec un client simulé (profil généré), puis débrief formateur." },
  ];
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Retour onClick={onRetour} label="Tous les thèmes" />
      <div className={`mb-6 rounded-xl ${c.bg} border ${c.border} p-4`}>
        <p className={`text-xs font-bold uppercase tracking-wider ${c.accentText}`}>{theme.coucheNom} · {difficulte}</p>
        <h1 className="text-xl font-bold text-slate-900">{theme.nom}</h1>
        <p className="text-sm text-slate-600">{theme.detail}</p>
      </div>
      <div className="grid gap-3">
        {modes.map((m) => (
          <button key={m.id} onClick={() => onMode(m.id)} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.bg} ${c.accentText}`}>
              <IconeMode type={m.id} />
            </span>
            <span>
              <p className="font-semibold text-slate-900">{m.titre}</p>
              <p className="mt-1 text-sm text-slate-500">{m.desc}</p>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MODE COURS
// ============================================================
function ModeCours({ api, theme, difficulte, onRetour, onBadge }) {
  const [cours, setCours] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [graine, setGraine] = useState(0);

  const generer = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const txt = await api([
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Génère une fiche de cours courte et dense (lisible en 3 à 5 minutes) sur le thème "${theme.nom}" (${theme.detail}), niveau ${difficulte}, pour un conseiller AXA en formation CGP.${graine > 0 ? " Utilise un exemple chiffré DIFFÉRENT et original (profil client, montants et contexte nouveaux)." : ""}
Réponds avec exactement ce JSON :
{
  "definition": "définition simple en 2-3 phrases",
  "mecanisme": "le mécanisme expliqué comme on l'expliquerait à un client, en un paragraphe",
  "exemple": "un exemple chiffré concret et détaillé avec un profil client",
  "pieges": ["piège ou point de vigilance 1", "piège 2", "piège 3 (optionnel)"],
  "opportunite": "une opportunité commerciale éthique liée à ce thème pour un conseiller bancaire",
  "chiffres_a_verifier": true ou false selon que la fiche contient des chiffres/barèmes fiscaux
}`,
        },
      ]);
      setCours(parseJSON(txt));
      const p = await bumpProgress(theme.id, (pr) => ({ ...pr, coursLus: pr.coursLus + 1 }));
      await logSession({ themeId: theme.id, mode: "cours", score: null });
      if (onBadge) {
        onBadge("premier_cours");
        if (coucheEntierementExploree(p)) onBadge("couche_exploree");
      }
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [api, theme, difficulte, graine, onBadge]);

  useEffect(() => { generer(); }, [generer]);

  const c = COULEURS[theme.couleur];
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Retour onClick={onRetour} label={theme.nom} />
      <h1 className="mb-1 text-xl font-bold text-slate-900">Cours — {theme.nom}</h1>
      <p className={`mb-4 text-xs font-bold uppercase tracking-wider ${c.accentText}`}>{difficulte}</p>
      {chargement && <Spinner label="Génération de la fiche…" />}
      {erreur && <ErreurBloc message={erreur} onRetry={generer} />}
      {cours && !chargement && (
        <div className="anim-accordeon space-y-4">
          {(cours.chiffres_a_verifier ?? true) && <AvertissementBofip />}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Définition</h2>
            <p className="text-slate-800">{cours.definition}</p>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Mécanisme (comme à un client)</h2>
            <p className="whitespace-pre-line text-slate-800">{cours.mecanisme}</p>
          </section>
          <section className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
            <h2 className={`mb-1 text-xs font-bold uppercase tracking-wider ${c.accentText}`}>Exemple chiffré</h2>
            <p className="whitespace-pre-line text-slate-800">{cours.exemple}</p>
          </section>
          <section className="rounded-xl border border-red-200 bg-red-50 p-4">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-red-700">Pièges et points de vigilance</h2>
            <ul className="space-y-1.5">
              {(cours.pieges || []).map((p, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-800"><span className="font-bold text-red-600">•</span>{p}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-700">Opportunité commerciale éthique</h2>
            <p className="text-slate-800">{cours.opportunite}</p>
          </section>
          <button onClick={() => setGraine((g) => g + 1)} className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Régénérer avec un autre exemple
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MODE QCM — génération + révision SM-2 + série de bonnes réponses
// Si reviewMode : sert uniquement les cartes dues (toutes couches)
// ============================================================
function ModeQcm({ api, theme, difficulte, onRetour, reviewMode, dueCards, onCardsUpdated, onBadge }) {
  const [carte, setCarte] = useState(null);
  const [file, setFile] = useState(reviewMode ? dueCards : []);
  const [reponse, setReponse] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [stats, setStats] = useState({ ok: 0, total: 0 });
  const [combo, setCombo] = useState(0);
  const [fini, setFini] = useState(false);

  const genererQuestion = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    setReponse(null);
    try {
      const txt = await api([
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Génère UNE question QCM originale sur le thème "${theme.nom}" (${theme.detail}), niveau ${difficulte}, pour un conseiller CGP. Une seule bonne réponse, distracteurs plausibles.
Réponds avec exactement ce JSON :
{"question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0 à 3, "explication": "pourquoi la bonne réponse est correcte et les autres non, avec mention (à vérifier sur bofip.gouv.fr) si un chiffre est cité"}`,
        },
        // légère variabilité
      ], { temperature: 0.8 });
      const q = parseJSON(txt);
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correctIndex !== "number") {
        throw new Error("Question mal formée reçue du modèle. Réessayez.");
      }
      const nouvelle = {
        id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        themeId: theme.id,
        difficulte,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explication: q.explication || "",
        ef: 2.5, reps: 0, interval: 0, nextReview: Date.now(),
      };
      setCarte(nouvelle);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [api, theme, difficulte]);

  const suivante = useCallback(async () => {
    if (reviewMode) {
      if (file.length > 0) {
        const [next, ...reste] = file;
        setFile(reste);
        setCarte(next);
        setReponse(null);
      } else {
        setFini(true);
        setCarte(null);
        if (onBadge) onBadge("premiere_revision");
      }
    } else {
      // priorité aux cartes dues du thème, sinon génération
      if (file.length > 0) {
        const [next, ...reste] = file;
        setFile(reste);
        setCarte(next);
        setReponse(null);
      } else {
        await genererQuestion();
      }
    }
  }, [reviewMode, file, genererQuestion, onBadge]);

  useEffect(() => {
    // premier chargement
    (async () => {
      if (reviewMode) {
        if (dueCards.length === 0) { setFini(true); return; }
        setFile(dueCards.slice(1));
        setCarte(dueCards[0]);
      } else {
        const data = await stGet(`review:${theme.id}`, { cards: {} });
        const dues = Object.values(data.cards || {}).filter((k) => k.nextReview <= Date.now() && k.difficulte === difficulte);
        if (dues.length > 0) {
          setFile(dues.slice(1));
          setCarte(dues[0]);
        } else {
          await genererQuestion();
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const repondre = async (idx) => {
    if (reponse !== null || !carte) return;
    const correct = idx === carte.correctIndex;
    setReponse(idx);
    setStats((s) => ({ ok: s.ok + (correct ? 1 : 0), total: s.total + 1 }));
    if (correct) {
      const nouveauCombo = combo + 1;
      setCombo(nouveauCombo);
      if (nouveauCombo === 10 && onBadge) onBadge("serie_10");
    } else {
      setCombo(0);
    }
    const maj = sm2Update(carte, correct ? 5 : 2);
    try {
      await saveCard(carte.themeId, maj);
      const p = await bumpProgress(carte.themeId, (pr) => ({ ...pr, qcmTotal: pr.qcmTotal + 1, qcmOk: pr.qcmOk + (correct ? 1 : 0) }));
      if (onBadge && coucheEntierementExploree(p)) onBadge("couche_exploree");
      if (onCardsUpdated) onCardsUpdated();
    } catch { /* stockage indisponible : la session continue en mémoire */ }
  };

  const statsRef = useRef(stats);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => {
    return () => {
      const s = statsRef.current;
      if (s.total > 0) {
        logSession({ themeId: reviewMode ? "revision" : theme?.id, mode: reviewMode ? "révision" : "qcm", score: `${s.ok}/${s.total}` });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const th = carte ? themeById(carte.themeId) : theme;
  const c = COULEURS[(th || theme || { couleur: "indigo" }).couleur] || COULEURS.indigo;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Retour onClick={onRetour} label={reviewMode ? "Accueil" : theme.nom} />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">{reviewMode ? "Révisions du jour" : `QCM — ${theme.nom}`}</h1>
        <div className="flex items-center gap-2">
          {combo >= 2 && (
            <span key={combo} title="Bonnes réponses d'affilée" className="anim-combo rounded-full bg-emerald-600 px-3 py-1 text-sm font-semibold text-white">
              Série : {combo}
            </span>
          )}
          <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">{stats.ok} / {stats.total}</span>
        </div>
      </div>
      {reviewMode && !fini && <p className="mb-4 text-sm text-slate-500">{file.length + (carte ? 1 : 0)} carte(s) restante(s)</p>}

      {chargement && <Spinner label="Génération de la question…" />}
      {erreur && <ErreurBloc message={erreur} onRetry={genererQuestion} />}

      {fini && (
        <div className="anim-accordeon rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-center">
          <p className="text-lg font-bold text-emerald-800">Révisions terminées</p>
          <p className="mt-1 text-sm text-emerald-700">Score : {stats.ok}/{stats.total}. Les prochaines échéances sont recalculées par SM-2.</p>
        </div>
      )}

      {carte && !chargement && (
        <div className="space-y-3">
          {reviewMode && th && (
            <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white ${c.accent}`}>{th.nom}</span>
          )}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium text-slate-900">{carte.question}</p>
          </div>
          <div className="grid gap-2">
            {carte.options.map((opt, i) => {
              let cls = "border-slate-200 bg-white hover:border-slate-400";
              let anim = "";
              if (reponse !== null) {
                if (i === carte.correctIndex) { cls = "border-emerald-500 bg-emerald-50"; anim = "anim-correct"; }
                else if (i === reponse) { cls = "border-red-500 bg-red-50"; anim = "anim-wrong"; }
                else cls = "border-slate-200 bg-white opacity-60";
              }
              return (
                <button key={i} onClick={() => repondre(i)} disabled={reponse !== null}
                  className={`rounded-xl border-2 p-3 text-left text-sm text-slate-800 transition-all duration-300 ${cls} ${anim}`}>
                  <span className="mr-2 font-bold text-slate-400">{String.fromCharCode(65 + i)}.</span>{opt}
                </button>
              );
            })}
          </div>
          {reponse !== null && (
            <div className={`anim-accordeon rounded-xl border p-4 ${reponse === carte.correctIndex ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
              <p className={`mb-1 font-bold ${reponse === carte.correctIndex ? "text-emerald-700" : "text-red-700"}`}>
                {reponse === carte.correctIndex ? "Correct" : `Incorrect — bonne réponse : ${String.fromCharCode(65 + carte.correctIndex)}`}
              </p>
              <p className="text-sm text-slate-700">{carte.explication}</p>
              {/(bofip|barème|taux|abattement|plafond|€|%)/i.test(carte.explication + carte.question) && <div className="mt-3"><AvertissementBofip /></div>}
              <button onClick={suivante} className="mt-3 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
                Question suivante
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MODE QUESTION OUVERTE
// ============================================================
function ModeOuverte({ api, theme, difficulte, onRetour, onBadge }) {
  const [etape, setEtape] = useState("chargement"); // chargement | reponse | notation | resultat
  const [q, setQ] = useState(null);
  const [texte, setTexte] = useState("");
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);

  const genererQuestion = useCallback(async () => {
    setEtape("chargement");
    setErreur(null);
    setTexte("");
    setResultat(null);
    try {
      const txt = await api([
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Génère UNE question ouverte exigeante sur le thème "${theme.nom}" (${theme.detail}), niveau ${difficulte}, pour un conseiller CGP en formation, ainsi que des critères de notation internes.
Réponds avec exactement ce JSON :
{"question": "...", "criteres": ["critère de notation 1", "critère 2", "critère 3", "critère 4"]}`,
        },
      ], { temperature: 0.8 });
      const parsed = parseJSON(txt);
      if (!parsed.question) throw new Error("Question mal formée. Réessayez.");
      setQ(parsed);
      setEtape("reponse");
    } catch (e) {
      setErreur(e.message);
      setEtape("reponse");
    }
  }, [api, theme, difficulte]);

  useEffect(() => { genererQuestion(); }, [genererQuestion]);

  const noter = async () => {
    setEtape("notation");
    setErreur(null);
    try {
      const txt = await api([
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Question posée : "${q.question}"
Critères de notation : ${JSON.stringify(q.criteres)}
Réponse du conseiller en formation : """${texte}"""
Note cette réponse de 0 à 5 (entier) strictement selon les critères. Sois exigeant mais juste et constructif. Ne récompense pas le remplissage.
Réponds avec exactement ce JSON :
{"note": 0 à 5, "feedback": "feedback global constructif en 3-5 phrases", "points_forts": ["..."], "points_ameliorer": ["..."], "reponse_modele": "les éléments clés qu'une réponse complète devait contenir, en un paragraphe"}`,
        },
      ]);
      const r = parseJSON(txt);
      setResultat(r);
      setEtape("resultat");
      const ok = (r.note ?? 0) >= 3;
      const p = await bumpProgress(theme.id, (pr) => ({ ...pr, openTotal: pr.openTotal + 1, openOk: pr.openOk + (ok ? 1 : 0) }));
      await logSession({ themeId: theme.id, mode: "ouverte", score: `${r.note}/5` });
      if (onBadge && coucheEntierementExploree(p)) onBadge("couche_exploree");
    } catch (e) {
      setErreur(e.message);
      setEtape("reponse");
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Retour onClick={onRetour} label={theme.nom} />
      <h1 className="mb-4 text-xl font-bold text-slate-900">Question ouverte — {theme.nom}</h1>
      {etape === "chargement" && <Spinner label="Génération de la question…" />}
      {erreur && <ErreurBloc message={erreur} onRetry={q ? undefined : genererQuestion} />}
      {q && etape !== "chargement" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium text-slate-900">{q.question}</p>
          </div>
          {etape === "reponse" && (
            <>
              <textarea
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                rows={8}
                placeholder="Rédigez votre réponse comme si vous l'expliquiez à un client ou à votre manager…"
                className="w-full rounded-xl border border-slate-300 p-4 text-sm text-slate-800 focus:border-blue-700 focus:outline-none"
              />
              <div className="flex gap-2">
                <button onClick={noter} disabled={texte.trim().length < 20}
                  className="flex-1 rounded-lg bg-blue-900 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:bg-slate-300">
                  Soumettre pour notation
                </button>
                <button onClick={genererQuestion} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Autre question
                </button>
              </div>
              {texte.trim().length > 0 && texte.trim().length < 20 && <p className="text-xs text-slate-500">Réponse trop courte pour être notée (20 caractères minimum).</p>}
            </>
          )}
          {etape === "notation" && <Spinner label="Notation en cours…" />}
          {etape === "resultat" && resultat && (
            <div className="anim-accordeon space-y-3">
              <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white ${resultat.note >= 4 ? "bg-emerald-600" : resultat.note >= 3 ? "bg-amber-500" : "bg-red-600"}`}>
                  {resultat.note}/5
                </div>
                <p className="text-sm text-slate-700">{resultat.feedback}</p>
              </div>
              {resultat.points_forts?.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-700">Points forts</h3>
                  <ul className="space-y-1 text-sm text-slate-800">{resultat.points_forts.map((p, i) => <li key={i}>• {p}</li>)}</ul>
                </div>
              )}
              {resultat.points_ameliorer?.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-red-700">À améliorer</h3>
                  <ul className="space-y-1 text-sm text-slate-800">{resultat.points_ameliorer.map((p, i) => <li key={i}>• {p}</li>)}</ul>
                </div>
              )}
              {resultat.reponse_modele && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Éléments attendus</h3>
                  <p className="text-sm text-slate-700">{resultat.reponse_modele}</p>
                </div>
              )}
              <AvertissementBofip />
              <button onClick={genererQuestion} className="w-full rounded-lg bg-slate-900 py-2.5 font-semibold text-white hover:bg-slate-700">
                Nouvelle question
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MODE MISE EN SITUATION CLIENT
// ============================================================
function ModeSituation({ api, theme, difficulte, onRetour, onBadge }) {
  const [profil, setProfil] = useState(null);
  const [messages, setMessages] = useState([]); // {role: 'client'|'conseiller', text}
  const [saisie, setSaisie] = useState("");
  const [chargement, setChargement] = useState(true);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [debrief, setDebrief] = useState(null);
  const [debriefEnCours, setDebriefEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const finRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, debrief]);

  const initialiser = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const txt = await api([
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Génère un profil de client bancaire réaliste pour une mise en situation sur le thème "${theme.nom}" (${theme.detail}), niveau de difficulté de l'entretien : ${difficulte} (plus le niveau est élevé, plus le client est exigeant, informé ou méfiant).
Réponds avec exactement ce JSON :
{"prenom": "...", "age": 45, "situation_familiale": "...", "profession": "...", "patrimoine": "description synthétique", "objectif": "objectif patrimonial principal", "budget": "capacité d'épargne ou capital disponible", "personnalite": "trait dominant (méfiant, pressé, bavard, très informé…)", "premiere_phrase": "la phrase d'ouverture que ce client dit au conseiller en entrant dans le bureau"}`,
        },
      ], { temperature: 0.9 });
      const p = parseJSON(txt);
      setProfil(p);
      setMessages([{ role: "client", text: p.premiere_phrase }]);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [api, theme, difficulte]);

  useEffect(() => { initialiser(); }, [initialiser]);

  const promptRolePlay = () => `Tu joues UNIQUEMENT le rôle du client suivant dans un entretien avec un conseiller AXA. Tu n'es pas le formateur, tu es le client.
Profil : ${JSON.stringify(profil)}
Thème de l'entretien : ${theme.nom} (${theme.detail}). Difficulté : ${difficulte}.
Règles : reste dans le personnage (personnalité : ${profil?.personnalite}), pose des questions réalistes, exprime des objections crédibles, ne donne jamais de cours, réponds en 1 à 4 phrases naturelles. Si le conseiller dit une erreur fiscale grossière, réagis comme un client (doute, demande de confirmation), pas comme un correcteur. Réponds en texte brut, sans JSON.`;

  const envoyer = async () => {
    const contenu = saisie.trim();
    if (!contenu || envoiEnCours || debrief) return;
    setSaisie("");
    setErreur(null);
    const historique = [...messages, { role: "conseiller", text: contenu }];
    setMessages(historique);
    setEnvoiEnCours(true);
    try {
      const apiMessages = [
        { role: "system", content: promptRolePlay() },
        ...historique.map((m) => ({ role: m.role === "client" ? "assistant" : "user", content: m.text })),
      ];
      const txt = await api(apiMessages, { jsonMode: false, temperature: 0.9 });
      setMessages((ms) => [...ms, { role: "client", text: txt.trim() }]);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const lancerDebrief = async () => {
    setDebriefEnCours(true);
    setErreur(null);
    try {
      const transcription = messages.map((m) => `${m.role === "client" ? "CLIENT" : "CONSEILLER"} : ${m.text}`).join("\n");
      const txt = await api([
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Voici la transcription d'un entretien d'entraînement. Profil client : ${JSON.stringify(profil)}. Thème : ${theme.nom}. Niveau : ${difficulte}.
Transcription :
${transcription}

Fais un débrief de formateur exigeant sur la prestation du CONSEILLER uniquement.
Réponds avec exactement ce JSON :
{"note_globale": 0 à 5, "points_forts": ["..."], "points_ameliorer": ["..."], "cgp_senior": "ce qu'un CGP senior aurait dit ou fait différemment aux moments clés de cet entretien, en un paragraphe concret", "conformite": "remarque sur le devoir de conseil / conformité si pertinent, sinon chaîne vide"}`,
        },
      ]);
      const d = parseJSON(txt);
      setDebrief(d);
      const p = await bumpProgress(theme.id, (pr) => ({ ...pr, situations: pr.situations + 1 }));
      await logSession({ themeId: theme.id, mode: "situation", score: `${d.note_globale}/5` });
      if (onBadge) {
        onBadge("premiere_situation");
        if (coucheEntierementExploree(p)) onBadge("couche_exploree");
      }
    } catch (e) {
      setErreur(e.message);
    } finally {
      setDebriefEnCours(false);
    }
  };

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col px-4 py-6">
      <Retour onClick={onRetour} label={theme.nom} />
      <h1 className="text-xl font-bold text-slate-900">Mise en situation — {theme.nom}</h1>
      {chargement && <Spinner label="Génération du profil client…" />}
      {profil && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{profil.prenom}, {profil.age} ans</span> — {profil.profession}, {profil.situation_familiale}. Patrimoine : {profil.patrimoine}. Objectif : {profil.objectif}. Budget : {profil.budget}. <span className="italic">({profil.personnalite})</span>
        </div>
      )}
      <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "conseiller" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-md rounded-2xl px-4 py-2 text-sm ${m.role === "conseiller" ? "bg-blue-900 text-white" : "bg-slate-100 text-slate-800"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {envoiEnCours && <p className="text-xs italic text-slate-400">{profil?.prenom} réfléchit…</p>}
        {debriefEnCours && <Spinner label="Débrief du formateur en cours…" />}
        {debrief && (
          <div className="anim-accordeon space-y-3 border-t border-slate-200 pt-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full font-bold text-white ${debrief.note_globale >= 4 ? "bg-emerald-600" : debrief.note_globale >= 3 ? "bg-amber-500" : "bg-red-600"}`}>{debrief.note_globale}/5</div>
              <p className="font-bold text-slate-900">Débrief du formateur</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3"><p className="mb-1 text-xs font-bold uppercase text-emerald-700">Points forts</p><ul className="space-y-1 text-sm text-slate-800">{(debrief.points_forts || []).map((p, i) => <li key={i}>• {p}</li>)}</ul></div>
            <div className="rounded-lg bg-red-50 p-3"><p className="mb-1 text-xs font-bold uppercase text-red-700">À améliorer</p><ul className="space-y-1 text-sm text-slate-800">{(debrief.points_ameliorer || []).map((p, i) => <li key={i}>• {p}</li>)}</ul></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="mb-1 text-xs font-bold uppercase text-slate-500">Ce qu'un CGP senior aurait fait</p><p className="text-sm text-slate-700">{debrief.cgp_senior}</p></div>
            {debrief.conformite && <div className="rounded-lg bg-amber-50 p-3"><p className="mb-1 text-xs font-bold uppercase text-amber-700">Conformité / devoir de conseil</p><p className="text-sm text-slate-700">{debrief.conformite}</p></div>}
          </div>
        )}
        <div ref={finRef}></div>
      </div>
      {erreur && <div className="mt-2"><ErreurBloc message={erreur} /></div>}
      {!debrief && profil && (
        <div className="mt-3 flex gap-2">
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && envoyer()}
            placeholder="Votre réponse au client…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-700 focus:outline-none"
          />
          <button onClick={envoyer} disabled={envoiEnCours || !saisie.trim()} className="rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-slate-300">
            Envoyer
          </button>
          <button onClick={lancerDebrief} disabled={messages.length < 3 || debriefEnCours} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">
            Terminer &amp; débriefer
          </button>
        </div>
      )}
      {debrief && (
        <button onClick={onRetour} className="mt-3 w-full rounded-lg bg-slate-900 py-2.5 font-semibold text-white hover:bg-slate-700">
          Retour au thème
        </button>
      )}
    </div>
  );
}

// ============================================================
// TABLEAU DE BORD — badges + progression + historique
// ============================================================
function Dashboard({ onRetour, reviews }) {
  const [progress, setProgress] = useState({});
  const [sessions, setSessions] = useState([]);
  const [badgesDebloques, setBadgesDebloques] = useState({});
  const [pret, setPret] = useState(false);

  useEffect(() => {
    (async () => {
      setProgress(await stGet("progress", {}));
      setSessions(await stGet("sessions", []));
      setBadgesDebloques(await stGet("badges", {}));
      setPret(true);
    })();
  }, []);

  const maintenant = Date.now();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Retour onClick={onRetour} label="Accueil" />
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Tableau de bord</h1>
      {!pret && <Spinner label="Chargement des données…" />}
      {pret && (
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold text-slate-900">Badges</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BADGES.map((b) => {
                const date = badgesDebloques[b.id];
                return (
                  <div key={b.id} className={`rounded-xl border p-3 transition ${date ? "border-emerald-200 bg-white shadow-sm" : "border-slate-200 bg-slate-50 opacity-60"}`}>
                    <span className={`text-xl ${date ? "" : "grayscale"}`}>{b.icone}</span>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{b.nom}</p>
                    <p className="text-xs text-slate-500">{b.desc}</p>
                    {date && <p className="mt-1 text-xs font-medium text-emerald-700">Obtenu le {new Date(date).toLocaleDateString("fr-FR")}</p>}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="space-y-5">
            {COUCHES.map((couche, i) => {
              const c = COULEURS[couche.couleur];
              return (
                <div key={couche.id} className={`rounded-2xl border ${c.border} ${c.bg} p-4`}>
                  <h2 className={`mb-3 font-bold ${c.text}`}>Couche {i + 1} — {couche.nom}</h2>
                  <div className="space-y-3">
                    {couche.themes.map((t) => {
                      const p = progress[t.id] || { coursLus: 0, qcmTotal: 0, qcmOk: 0, openTotal: 0, openOk: 0, situations: 0 };
                      const cards = Object.values(reviews[t.id] || {});
                      const maitrisees = cards.filter((k) => k.reps >= 3).length;
                      const dues = cards.filter((k) => k.nextReview <= maintenant).length;
                      const total = p.qcmTotal + p.openTotal;
                      const ok = p.qcmOk + p.openOk;
                      const taux = total > 0 ? ok / total : 0;
                      return (
                        <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-900">{t.nom}</p>
                            {dues > 0 && <span className="rounded-full bg-blue-900 px-2 py-0.5 text-xs font-bold text-white">{dues} due{dues > 1 ? "s" : ""}</span>}
                          </div>
                          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>Cours lus : <b className="text-slate-700">{p.coursLus}</b></span>
                            <span>Questions maîtrisées : <b className="text-slate-700">{maitrisees}/{cards.length}</b></span>
                            <span>Situations : <b className="text-slate-700">{p.situations}</b></span>
                            <span>Réussite : <b className="text-slate-700">{total > 0 ? `${Math.round(taux * 100)} %` : "—"}</b></span>
                          </div>
                          <BarreProgression ratio={taux} couleurClasse={c.bar} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <h2 className="mb-3 mt-8 text-lg font-bold text-slate-900">Historique des sessions</h2>
          {sessions.length === 0 && <p className="text-sm text-slate-500">Aucune session enregistrée. Lancez un cours ou un QCM pour démarrer l'historique.</p>}
          <div className="space-y-1.5">
            {sessions.slice(0, 25).map((s, i) => {
              const t = themeById(s.themeId);
              return (
                <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <span className="text-slate-700">
                    <span className="font-medium capitalize">{s.mode}</span> — {t ? t.nom : s.themeId === "revision" ? "Révision multi-thèmes" : s.themeId}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-slate-500">
                    {s.score && <span className="font-semibold text-slate-700">{s.score}</span>}
                    {new Date(s.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// APP RACINE
// ============================================================
export default function App() {
  const [config, setConfig] = useState(null); // { workerUrl, model } — mémoire de session uniquement
  const [ecran, setEcran] = useState("config"); // config | accueil | theme | cours | qcm | ouverte | situation | revision | dashboard
  const [themeId, setThemeId] = useState(null);
  const [difficulte, setDifficulte] = useState("Intermédiaire");
  const [reviews, setReviews] = useState({}); // { themeId: { qid: card } }
  const [progress, setProgress] = useState({});
  const [streak, setStreak] = useState(0);
  const [coucheOuverte, setCoucheOuverte] = useState("c1"); // accordéon de l'accueil
  const [toast, setToast] = useState(null); // badge en cours d'affichage
  const toastTimer = useRef(null);

  const debloquerBadge = useCallback(async (badgeId) => {
    const badges = await stGet("badges", {});
    if (badges[badgeId]) return; // déjà obtenu, pas de toast
    badges[badgeId] = new Date().toISOString();
    await stSet("badges", badges);
    const def = BADGES.find((b) => b.id === badgeId);
    if (!def) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(def);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const rechargerDonnees = useCallback(async () => {
    setReviews(await loadAllReviews());
    setProgress(await stGet("progress", {}));
    const s = calcStreak(await stGet("sessions", []));
    setStreak(s);
    if (s >= 3) debloquerBadge("streak_3");
  }, [debloquerBadge]);

  useEffect(() => {
    if (ecran === "accueil" || ecran === "dashboard") rechargerDonnees();
  }, [ecran, rechargerDonnees]);

  const api = useCallback(
    (messages, opts) => {
      if (!config) return Promise.reject(new Error("Configuration manquante."));
      return callMistral(config.workerUrl, config.model, messages, opts);
    },
    [config]
  );

  const maintenant = Date.now();
  const cartesDues = Object.values(reviews).flatMap((cards) => Object.values(cards)).filter((c) => c.nextReview <= maintenant);
  const theme = themeId ? themeById(themeId) : null;
  const duesDansTheme = theme ? Object.values(reviews[theme.id] || {}).filter((c) => c.nextReview <= maintenant && c.difficulte === difficulte).length : 0;

  return (
    <div className="min-h-screen bg-slate-100" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{STYLES_ANIMATIONS}</style>

      {ecran !== "config" && (
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-2.5">
            <div className="flex items-center justify-between">
              <button onClick={() => setEcran("accueil")} className="flex items-center gap-2">
                <span className="rounded bg-blue-900 px-1.5 py-0.5 text-xs font-bold text-white">CGP</span>
                <span className="text-sm font-semibold text-slate-900">Entraînement patrimonial</span>
              </button>
              <span className="text-xs text-slate-400">{config?.model} · {difficulte}</span>
            </div>
            <div className="mt-1.5">
              <FilAriane
                ecran={ecran}
                theme={theme}
                onAccueil={() => setEcran("accueil")}
                onCouche={() => { if (theme) setCoucheOuverte(theme.coucheId); setEcran("accueil"); }}
                onTheme={() => setEcran("theme")}
              />
            </div>
          </div>
        </header>
      )}

      {/* key={ecran} force le re-montage et déclenche la transition d'entrée */}
      <div key={ecran} className="anim-ecran">
        {ecran === "config" && (
          <EcranConfig onStart={(workerUrl, model) => { setConfig({ workerUrl, model }); setEcran("accueil"); }} />
        )}

        {ecran === "accueil" && (
          <EcranAccueil
            dueCount={cartesDues.length}
            onReviser={() => setEcran("revision")}
            onTheme={(id) => { setThemeId(id); setEcran("theme"); }}
            difficulte={difficulte}
            setDifficulte={setDifficulte}
            onDashboard={() => setEcran("dashboard")}
            reviews={reviews}
            progress={progress}
            streak={streak}
            coucheOuverte={coucheOuverte}
            setCoucheOuverte={setCoucheOuverte}
          />
        )}

        {ecran === "theme" && theme && (
          <EcranTheme theme={theme} difficulte={difficulte} dueDansTheme={duesDansTheme}
            onMode={(m) => setEcran(m)} onRetour={() => setEcran("accueil")} />
        )}

        {ecran === "cours" && theme && (
          <ModeCours api={api} theme={theme} difficulte={difficulte} onBadge={debloquerBadge} onRetour={() => setEcran("theme")} />
        )}

        {ecran === "qcm" && theme && (
          <ModeQcm api={api} theme={theme} difficulte={difficulte} reviewMode={false}
            dueCards={[]} onCardsUpdated={rechargerDonnees} onBadge={debloquerBadge} onRetour={() => setEcran("theme")} />
        )}

        {ecran === "revision" && (
          <ModeQcm api={api} theme={null} difficulte={difficulte} reviewMode={true}
            dueCards={cartesDues} onCardsUpdated={rechargerDonnees} onBadge={debloquerBadge} onRetour={() => setEcran("accueil")} />
        )}

        {ecran === "ouverte" && theme && (
          <ModeOuverte api={api} theme={theme} difficulte={difficulte} onBadge={debloquerBadge} onRetour={() => setEcran("theme")} />
        )}

        {ecran === "situation" && theme && (
          <ModeSituation api={api} theme={theme} difficulte={difficulte} onBadge={debloquerBadge} onRetour={() => setEcran("theme")} />
        )}

        {ecran === "dashboard" && (
          <Dashboard reviews={reviews} onRetour={() => setEcran("accueil")} />
        )}
      </div>

      <ToastBadge badge={toast} />
    </div>
  );
}
