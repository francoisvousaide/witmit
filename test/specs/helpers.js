// Petites fonctions partagées par les tests — toutes passent par de VRAIES actions souris/clavier.
const path = require('path');
const crypto = require('crypto');
const { expect } = require('@playwright/test');

const PAGES_DIR = path.resolve(__dirname, '..', 'pages');
const fileUrl = (name) => 'file://' + path.join(PAGES_DIR, name);

const IS_MAC = process.platform === 'darwin';
// Raccourcis (K1) : ⌥+A / alt+A lance et arrête le mode annotation ; ⌥ deux fois / alt deux fois montre et cache
// witmit (live ; décision de François du 25/10 après-midi). Playwright tape la lettre de base avec alt (« a »),
// comme Windows et Linux.
const ANNOTER = 'Alt+KeyA';
// Deux appuis sur alt seule, chacun relâché ; « pause » : millisecondes entre les deux (witmit : moins de 400).
async function doubleAlt(page, pause = 0) {
  await page.keyboard.press('Alt');
  if (pause) await page.waitForTimeout(pause);
  await page.keyboard.press('Alt');
}

async function clearStorage(page) {
  await page.evaluate(() => localStorage.clear());
}
async function stored(page, key) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), key);
}
// Bouton du mode annotation (#cmToggleBtn) : un clic bascule le mode ; il suit en aria-pressed, le halo aussi.
async function activate(page) {
  await page.locator('#cmToggleBtn').click();
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await expect(page.locator('#cmToggleBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#cmFrame')).toHaveClass(/show/);
}
async function deactivate(page) {
  await page.locator('#cmToggleBtn').click();
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  await expect(page.locator('#cmToggleBtn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#cmFrame')).not.toHaveClass(/show/);
}
// Live : ⌥ deux fois montre witmit (les deux boutons, liste fermée).
async function montrer(page) {
  await doubleAlt(page);
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await expect(page.locator('#cmToggleBtn')).toBeVisible();
}
// Un vrai événement clavier envoyé par le protocole de Chromium (CDP Input.dispatchKeyEvent), pour les
// caractères que Playwright ne sait pas taper avec alt (« ∑ », « ‹ », « Æ », touche morte « Dead »).
// rawKeyDown puis keyUp : la page reçoit keydown avec exactement ce key et ce code.
async function toucheBrute(page, { key, code, alt = false, ctrl = false, meta = false, shift = false, repeat = false, up = true }) {
  const cdp = page._wmCdp || (page._wmCdp = await page.context().newCDPSession(page));
  const modifiers = (alt ? 1 : 0) | (ctrl ? 2 : 0) | (meta ? 4 : 0) | (shift ? 8 : 0);
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, modifiers, autoRepeat: repeat });
  if (up) await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers });
}
// Carte du clavier simulée, posée avant le chargement de la page (addInitScript) : 'azerty' (Mac français :
// la touche à la position KeyQ porte « a », KeyZ porte « w »…) ; null : navigator.keyboard absent, comme
// sur Safari et Firefox.
async function carteClavier(page, disposition) {
  await page.addInitScript((d) => {
    let valeur;
    if (d === 'azerty') {
      const m = new Map([['KeyQ', 'a'], ['KeyW', 'z'], ['KeyE', 'e'], ['KeyR', 'r'], ['KeyA', 'q'], ['KeyS', 's'], ['KeyZ', 'w'], ['KeyX', 'x'], ['KeyM', ','], ['Semicolon', 'm'], ['KeyN', 'n']]);
      valeur = { getLayoutMap: () => Promise.resolve(m) };
    }
    Object.defineProperty(Navigator.prototype, 'keyboard', { configurable: true, get: () => valeur });
  }, disposition);
}
// Clic au centre d'un élément (mode actif), saisie du texte, Entrée pour enregistrer.
async function addPin(page, selector, text) {
  const box = await visibleBox(page, selector);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const ta = page.locator('.cm-popup textarea');
  await expect(ta).toBeVisible();
  await ta.fill(text);
  await ta.press('Enter');
  await expect(page.locator('.cm-popup')).toHaveCount(0);
}
// Fait défiler jusqu'à l'élément (s'il est hors écran) et renvoie sa position à l'écran.
async function visibleBox(page, selector) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  return el.boundingBox();
}
// Glisser de (x1,y1) à (x2,y2) avec la souris — éventuellement Maj enfoncée.
async function drag(page, x1, y1, x2, y2, { shift = false } = {}) {
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 10 });
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
}

// Mode maquette : l'équipe répond par un « retour collé » (lignes « <id> <statut> | message »), liste ouverte.
// C'est l'activité de l'équipe qui allume le voyant (C5) dans une maquette.
async function retourColle(page, lignes) {
  if (!(await page.locator('#cmPanel').evaluate((p) => p.classList.contains('show')))) await page.locator('#cmPanelBtn').click();
  await page.locator('#cmPasteBtn').click();
  await page.locator('#cmFeedbackBox textarea').fill(lignes.join('\n'));
  await page.locator('#cmFeedbackBox').getByRole('button', { name: 'appliquer' }).click();
}
// Coupure réseau simulée : le faux guichet ne répond plus (requêtes interrompues) et le navigateur passe hors
// ligne ; au retour, il repasse en ligne, ce qui déclenche l'évènement « online » dans la page.
async function horsLigne(page, state, coupe) {
  state.horsLigne = coupe;
  await page.context().setOffline(coupe);
}
// Accepte la prochaine confirmation du navigateur (Playwright les refuse d'office) et renvoie son texte.
function accepterConfirmation(page) {
  return new Promise((resolve) => page.once('dialog', async (d) => { const m = d.message(); await d.accept(); resolve(m); }));
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
// Faux Supabase : identité anonyme, défi, dépôt, réponse / réouverture, relecture des statuts (et du fil). `state` pilote les réponses.
function mockSupabase(page, state) {
  Object.assign(state, { signups: 0, challenges: 0, posts: [], failNext: null, rows: [], replies: [], failReply: null, ...state });
  return page.route('https://witmit.test/**', async (route, req) => {
    const url = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
    if (state.horsLigne) return route.abort('internetdisconnected');   // coupure réseau : fetch échoue (« Failed to fetch »)
    if (req.method() === 'OPTIONS') return json(200, {});
    if (url.pathname === '/auth/v1/signup') { state.signups++; return json(200, { access_token: 'jeton-A', refresh_token: 'refresh-A', expires_in: 3600, user: { id: 'uid-A', is_anonymous: true } }); }
    if (url.pathname.endsWith('/submit-annotation/challenge')) {
      state.challenges++;
      const salt = 'sel' + state.challenges, number = 100 + state.challenges;
      return json(200, { algorithm: 'SHA-256', challenge: sha256(salt + number), maxnumber: 2000, salt, signature: 'sig' });
    }
    if (url.pathname.endsWith('/submit-annotation/reponse')) {   // répondre / rouvrir (V2.2)
      const body = req.postDataJSON();
      const preuve = JSON.parse(Buffer.from(body.altcha, 'base64').toString());
      state.replies.push({ body, preuveOk: sha256(preuve.salt + preuve.number) === preuve.challenge });
      if (state.failReply) { const f = state.failReply; state.failReply = null; return json(f.status, { erreur: f.erreur }); }
      const message = { id: 'msg-' + state.replies.length, de: 'auteur', texte: body.texte, rouvre: !!body.rouvrir, cree_le: new Date().toISOString() };
      return json(201, { message, statut: 'en_cours', rouvert: !!body.rouvrir });
    }
    if (url.pathname.endsWith('/submit-annotation')) {
      const body = req.postDataJSON();
      const preuve = JSON.parse(Buffer.from(body.altcha, 'base64').toString());
      state.posts.push({ body, headers: req.headers(), preuveOk: sha256(preuve.salt + preuve.number) === preuve.challenge });
      if (state.failNext) { const f = state.failNext; state.failNext = null; return json(f.status, { erreur: f.erreur }); }
      return json(201, { id: 'srv-' + state.posts.length, statut: 'nouveau', date_creation: new Date().toISOString(), capture: !!body.capture });
    }
    if (url.pathname === '/rest/v1/annotations') return json(200, state.rows);
    return json(404, { erreur: 'route inconnue ' + url.pathname });
  });
}
module.exports = { mockSupabase, fileUrl, visibleBox, IS_MAC, ANNOTER, doubleAlt, clearStorage, stored, activate, deactivate, montrer, toucheBrute, carteClavier, addPin, drag, retourColle, accepterConfirmation, horsLigne };
