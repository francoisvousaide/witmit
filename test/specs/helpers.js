// Petites fonctions partagées par les tests — toutes passent par de VRAIES actions souris/clavier.
const path = require('path');
const crypto = require('crypto');
const { expect } = require('@playwright/test');

const PAGES_DIR = path.resolve(__dirname, '..', 'pages');
const fileUrl = (name) => 'file://' + path.join(PAGES_DIR, name);

const IS_MAC = process.platform === 'darwin';
const SHORTCUT = 'Alt+KeyA'; // identique sur toutes les plateformes

async function clearStorage(page) {
  await page.evaluate(() => localStorage.clear());
}
async function stored(page, key) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), key);
}
async function activate(page) {
  await page.locator('#cmToggleBtn').click();
  await expect(page.locator('body')).toHaveClass(/cm-active/);
}
async function deactivate(page) {
  await page.locator('#cmToggleBtn').click();
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
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

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
// Faux Supabase : identité anonyme, défi, dépôt, réponse / réouverture, relecture des statuts (et du fil). `state` pilote les réponses.
function mockSupabase(page, state) {
  Object.assign(state, { signups: 0, challenges: 0, posts: [], failNext: null, rows: [], replies: [], failReply: null, ...state });
  return page.route('https://witmit.test/**', async (route, req) => {
    const url = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
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
module.exports = { mockSupabase, fileUrl, visibleBox, IS_MAC, SHORTCUT, clearStorage, stored, activate, deactivate, addPin, drag };
