// witmit — Edge Function « submit-annotation » : le guichet devant le coffre.
// Le widget ne parle qu'à ce guichet. Deux routes :
//   GET  …/submit-annotation/challenge  → un défi Altcha (petit calcul à résoudre par le navigateur)
//   POST …/submit-annotation            → le ticket + la preuve du calcul ; vérifie, range, rend un reçu
// Secrets attendus : ALTCHA_HMAC_KEY (à poser dans Edge Functions → Secrets) ;
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createChallenge, verifySolution } from "npm:altcha-lib@1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HMAC_KEY = Deno.env.get("ALTCHA_HMAC_KEY") ?? "";

// Réglages (plafonds) — volontairement bas : un humain n'a jamais besoin de plus.
const ALTCHA_MAX_NUMBER = 100_000;          // difficulté du calcul (~1 s dans un navigateur)
const ALTCHA_EXPIRES_MS = 10 * 60 * 1000;   // un défi vaut 10 min
const QUOTA_AUTEUR = { max: 10, fenetre: "10 minutes" };   // par visiteur
const QUOTA_PROJET = { max: 60, fenetre: "1 hour" };       // par site
const MAX_TEXTE = 5000, MAX_PAGE = 500, MAX_TECH_OCTETS = 20_000, MAX_CAPTURE_OCTETS = 1_000_000;
const CATEGORIES = new Set(["bug_visuel", "bug_fonctionnel", "ajustement_visuel", "texte", "comportement", "suggestion", "question", "a_classer"]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Le visiteur : on relit son jeton (identité anonyme Supabase) — sans jeton valide, pas de service.
async function visiteur(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const client = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!HMAC_KEY) return json(500, { erreur: "ALTCHA_HMAC_KEY manquant" });

  const user = await visiteur(req);
  if (!user) return json(401, { erreur: "identité requise" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);   // la clé serveur : ne sort jamais d'ici
  const route = new URL(req.url).pathname.replace(/\/+$/, "").split("/").pop();

  // ---- 1. le défi ----
  if (req.method === "GET" && route === "challenge") {
    const challenge = await createChallenge({
      hmacKey: HMAC_KEY, maxNumber: ALTCHA_MAX_NUMBER, expires: new Date(Date.now() + ALTCHA_EXPIRES_MS),
    });
    return json(200, challenge);
  }
  if (req.method !== "POST") return json(405, { erreur: "méthode" });

  // ---- 2. le ticket : forme et tailles ----
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { erreur: "JSON invalide" }); }
  const projet = String(body.projet ?? "").trim();
  const page = String(body.page ?? "").trim().slice(0, MAX_PAGE);
  const texte = String(body.texte ?? "").trim();
  const categorie = CATEGORIES.has(String(body.categorie)) ? String(body.categorie) : "a_classer";
  const idLocal = body.id_local ? String(body.id_local).slice(0, 64) : null;
  const tech = (body.donnees_techniques && typeof body.donnees_techniques === "object") ? body.donnees_techniques : {};
  const capture = typeof body.capture === "string" ? body.capture : null;
  if (!projet || !page || !texte) return json(400, { erreur: "projet, page et texte sont obligatoires" });
  if (texte.length > MAX_TEXTE) return json(413, { erreur: "texte trop long" });
  if (JSON.stringify(tech).length > MAX_TECH_OCTETS) return json(413, { erreur: "bloc technique trop gros" });
  if (capture && (!capture.startsWith("data:image/jpeg;base64,") || capture.length > MAX_CAPTURE_OCTETS * 1.4)) {
    return json(413, { erreur: "capture refusée (JPEG ≤ 1 Mo)" });
  }

  // ---- 3. les trois vérifications : projet connu, preuve Altcha, quotas ----
  const { data: p } = await admin.from("projets").select("slug, actif").eq("slug", projet).maybeSingle();
  if (!p || !p.actif) return json(403, { erreur: "projet inconnu" });

  const preuve = String(body.altcha ?? "");
  if (!preuve || !(await verifySolution(preuve, HMAC_KEY, true))) return json(403, { erreur: "preuve Altcha invalide" });
  // Une preuve ne sert qu'une fois (sinon on pourrait la rejouer pendant ses 10 min de validité)
  let defi = "";
  try { defi = String(JSON.parse(atob(preuve)).challenge ?? ""); } catch { /* preuve déjà validée par la lib */ }
  const { data: neuve } = await admin.rpc("consommer_quota", { p_cle: "altcha:" + defi.slice(0, 64), p_max: 1, p_fenetre: "15 minutes" });
  if (neuve === false) return json(403, { erreur: "preuve déjà utilisée" });

  const { data: okAuteur } = await admin.rpc("consommer_quota", { p_cle: `auteur:${user.id}`, p_max: QUOTA_AUTEUR.max, p_fenetre: QUOTA_AUTEUR.fenetre });
  const { data: okProjet } = await admin.rpc("consommer_quota", { p_cle: `projet:${projet}`, p_max: QUOTA_PROJET.max, p_fenetre: QUOTA_PROJET.fenetre });
  if (okAuteur === false || okProjet === false) return json(429, { erreur: "trop de tickets, réessaie plus tard" });

  // ---- 4. rangement dans le coffre (clé serveur) + reçu ----
  // Même id_local renvoyé par le même auteur = mise à jour de son ticket (texte corrigé avant envoi
  // du rapport) ; renvoyé par quelqu'un d'autre = refusé (on n'écrase jamais le ticket d'un autre).
  const ligne = { projet, page, texte, categorie, donnees_techniques: tech, mis_a_jour_le: new Date().toISOString() };
  let ticket: { id: string; statut: string; date_creation: string } | null = null;
  let error: { message: string } | null = null;
  const existant = idLocal
    ? (await admin.from("annotations").select("id, auteur_anonyme_id, statut").eq("projet", projet).eq("id_local", idLocal).maybeSingle()).data
    : null;
  if (existant) {
    if (existant.auteur_anonyme_id !== user.id) return json(409, { erreur: "identifiant déjà pris" });
    if (existant.statut !== "nouveau") return json(409, { erreur: "ticket déjà pris en charge, plus modifiable" });
    ({ data: ticket, error } = await admin.from("annotations").update(ligne).eq("id", existant.id).select("id, statut, date_creation").single());
  } else {
    ({ data: ticket, error } = await admin.from("annotations").insert({ ...ligne, id_local: idLocal, auteur_anonyme_id: user.id }).select("id, statut, date_creation").single());
  }
  if (error || !ticket) return json(500, { erreur: "enregistrement impossible", detail: error?.message });

  let capture_chemin: string | null = null;
  if (capture) {
    const octets = Uint8Array.from(atob(capture.split(",")[1]), (c) => c.charCodeAt(0));
    if (octets.length <= MAX_CAPTURE_OCTETS) {
      capture_chemin = `${user.id}/${ticket.id}.jpg`;
      const { error: e } = await admin.storage.from("captures").upload(capture_chemin, octets, { contentType: "image/jpeg", upsert: true });
      if (e) capture_chemin = null;
      else await admin.from("annotations").update({ capture_chemin }).eq("id", ticket.id);
    }
  }
  return json(201, { id: ticket.id, statut: ticket.statut, date_creation: ticket.date_creation, capture: !!capture_chemin });
});
