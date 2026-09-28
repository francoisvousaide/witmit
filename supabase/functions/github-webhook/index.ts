// witmit — Edge Function « github-webhook » : le retour. GitHub prévient cette adresse quand une issue change.
//   issue fermée            → ticket « resolu »   (rouverte → « en_cours »)
//   issue assignée/étiquetée « en cours » → « en_cours »
//   commentaire sur l'issue → un message « equipe » dans le fil du ticket (+ message_retour, gardé pour le widget V2.1)
//   commentaire qui commence par le marqueur witmit:auteur → ignoré : c'est la réponse de l'auteur, publiée par
//     submit-annotation (le jeton GitHub étant personnel, elle apparaît signée d'un humain, pas d'un bot)
// Authentification : signature HMAC de GitHub (X-Hub-Signature-256) avec GITHUB_WEBHOOK_SECRET — pas de JWT.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("GITHUB_WEBHOOK_SECRET") ?? "";
const MARQUEUR_AUTEUR = "<!-- witmit:auteur -->";   // identique dans submit-annotation
// Seuls les gens du repo parlent au nom de l'équipe (défense en profondeur : utile dès qu'un repo est public)
const EQUIPE = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// La signature : GitHub signe le corps brut avec le secret partagé ; on recalcule et on compare (temps constant).
async function signatureValide(corps: string, entete: string | null) {
  if (!SECRET || !entete?.startsWith("sha256=")) return false;
  const cle = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(corps)));
  const attendu = "sha256=" + Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (attendu.length !== entete.length) return false;
  let diff = 0;
  for (let i = 0; i < attendu.length; i++) diff |= attendu.charCodeAt(i) ^ entete.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { erreur: "méthode" });
  const corps = await req.text();
  if (!(await signatureValide(corps, req.headers.get("X-Hub-Signature-256")))) return json(401, { erreur: "signature invalide" });

  const evenement = req.headers.get("X-GitHub-Event") ?? "";
  if (evenement === "ping") return json(200, { ok: true, message: "witmit écoute" });
  if (evenement !== "issues" && evenement !== "issue_comment") return json(200, { ignore: evenement });

  let p: Record<string, unknown>;
  try { p = JSON.parse(corps); } catch { return json(400, { erreur: "JSON invalide" }); }
  const issue = p.issue as Record<string, unknown> | undefined;
  const repo = (p.repository as Record<string, unknown> | undefined)?.full_name as string | undefined;
  const numero = Number(issue?.number);
  if (!issue || !repo || !numero) return json(200, { ignore: "pas d'issue" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  // Le ticket : même repo (via projets.github_repo) et même numéro d'issue
  const { data: projets } = await admin.from("projets").select("slug").eq("github_repo", repo);
  const slugs = (projets ?? []).map((x) => x.slug);
  if (!slugs.length) return json(200, { ignore: "repo inconnu " + repo });
  const { data: ticket } = await admin.from("annotations").select("id, statut").in("projet", slugs).eq("github_issue_number", numero).maybeSingle();
  if (!ticket) return json(200, { ignore: "issue sans ticket #" + numero });

  const action = String(p.action ?? "");
  const maj: Record<string, unknown> = { mis_a_jour_le: new Date().toISOString() };

  if (evenement === "issues") {
    const labels = ((issue.labels as Array<Record<string, unknown>>) ?? []).map((l) => String(l.name).toLowerCase());
    if (action === "closed") maj.statut = "resolu";
    else if (action === "reopened") maj.statut = "en_cours";
    else if (action === "assigned" || (action === "labeled" && labels.includes("en cours"))) { if (ticket.statut === "nouveau") maj.statut = "en_cours"; }
    else return json(200, { ignore: action });
  } else {
    // issue_comment : un commentaire humain (pas un bot) devient le message visible par l'auteur du ticket
    if (action !== "created") return json(200, { ignore: action });
    const commentaire = p.comment as Record<string, unknown>;
    const auteur = commentaire.user as Record<string, unknown>;
    if (String(auteur?.type) === "Bot") return json(200, { ignore: "bot" });
    if (!EQUIPE.has(String(commentaire.author_association))) return json(200, { ignore: "pas un membre du repo", association: String(commentaire.author_association) });
    const texte = String(commentaire.body ?? "");
    if (texte.trimStart().startsWith(MARQUEUR_AUTEUR)) return json(200, { ignore: "réponse de l'auteur (witmit)" });
    const message = texte.slice(0, 2000);
    if (!message.trim()) return json(200, { ignore: "commentaire vide" });
    // Dans le fil ; un événement renvoyé par GitHub (même commentaire) est ignoré grâce à l'index unique
    const { error: e } = await admin.from("messages").upsert(
      { annotation_id: ticket.id, de: "equipe", texte: message, github_comment_id: Number(commentaire.id) || null, cree_le: String(commentaire.created_at ?? "") || new Date().toISOString() },
      { onConflict: "github_comment_id", ignoreDuplicates: true },
    );
    if (e) return json(500, { erreur: e.message });
    maj.message_retour = message;
    if (ticket.statut === "nouveau") maj.statut = "en_cours";
  }
  const { error } = await admin.from("annotations").update(maj).eq("id", ticket.id);
  if (error) return json(500, { erreur: error.message });
  return json(200, { ok: true, ticket: ticket.id, ...maj });
});
