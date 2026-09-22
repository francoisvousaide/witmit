// Mode live : envoi des tickets au guichet (Edge Function) — Supabase est SIMULÉ par interception réseau,
// mais le widget résout un vrai défi Altcha (sha256) et envoie de vraies requêtes.
const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const H = require('./helpers');

const PAGE = 'generic-dashboard-sync.html';
const KEY = 'witmit_kiosque-sync_v1';
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Faux Supabase : identité anonyme, défi, dépôt, relecture des statuts. `state` pilote les réponses.
function mockSupabase(page, state) {
  Object.assign(state, { signups: 0, challenges: 0, posts: [], failNext: null, rows: [] , ...state });
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
const ticket = async (page, i = 0) => (await H.stored(page, KEY))[i];
const waitSent = (page, i = 0) => expect.poll(async () => ((await ticket(page, i)).sync || {}).state, { timeout: 15000 }).toBe('sent');

let state;
test.beforeEach(async ({ page }) => {
  state = {};
  await mockSupabase(page, state);
  await page.goto(H.fileUrl(PAGE));
  await H.clearStorage(page);
  await page.goto(H.fileUrl(PAGE) + '?witmit=on');
});

test('1. un simple visiteur ne déclenche rien : aucune identité créée au chargement', async ({ page }) => {
  await page.waitForTimeout(2000);
  expect(state.signups).toBe(0);
  expect(state.posts).toHaveLength(0);
});

test('2. un clic enregistré part au guichet : identité, défi résolu, ticket, reçu ☁️', async ({ page }) => {
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Le nom du client déborde');
  await waitSent(page);
  expect(state.signups).toBe(1);
  expect(state.posts).toHaveLength(1);
  const p = state.posts[0];
  expect(p.preuveOk).toBe(true);
  expect(p.headers['authorization']).toBe('Bearer jeton-A');
  expect(p.headers['apikey']).toBe('sb_publishable_test');
  expect(p.body.projet).toBe('kiosque-sync');
  expect(p.body.texte).toBe('Le nom du client déborde');
  expect(p.body.categorie).toBe('bug-visuel');
  expect(p.body.page).toMatch(/generic-dashboard-sync\.html$/);
  expect(p.body.page).not.toContain('?');
  expect(p.body.capture).toBeUndefined();
  expect(p.body.donnees_techniques.type).toBe('pin');
  expect(p.body.donnees_techniques.tech.selectors[0]).toContain('tr');
  const t = await ticket(page);
  expect(p.body.id_local).toBe(t.id);
  expect(t.sync.id).toBe('srv-1');
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('.cm-sync-chip')).toHaveText('☁️ envoyé');
  // l'identité est réutilisée pour un second ticket
  await page.locator('#cmPanelBtn').click();
  await H.activate(page);
  await H.addPin(page, 'tbody tr:nth-child(2) td:nth-child(2)', 'Deuxième');
  await waitSent(page, 1);
  expect(state.signups).toBe(1);
  expect(state.posts).toHaveLength(2);
});

test('3. un encadré part avec sa capture JPEG', async ({ page }) => {
  await H.activate(page);
  const b = await H.visibleBox(page, '.kpi-row');
  await H.drag(page, b.x - 6, b.y - 6, b.x + b.width + 6, b.y + b.height + 6);
  await page.locator('.cm-popup textarea').fill('Les trois tuiles');
  await page.locator('.cm-popup textarea').press('Enter');
  await waitSent(page);
  expect(state.posts).toHaveLength(1);
  expect(state.posts[0].body.capture.startsWith('data:image/jpeg;base64,')).toBe(true);
  expect(state.posts[0].body.donnees_techniques.type).toBe('box');
});

test('4. échec (quota) : le ticket reste en local ⚠️, renvoyé à l’ouverture du tiroir ou au clic', async ({ page }) => {
  state.failNext = { status: 429, erreur: 'trop de tickets' };
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Ticket refusé');
  await expect.poll(async () => ((await ticket(page)).sync || {}).state, { timeout: 15000 }).toBe('error');
  expect((await ticket(page)).sync.error).toBe('trop de tickets');
  await expect(page.locator('#cmStatus')).toContainText('Envoi impossible');
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();   // ouvrir le tiroir = nouvel essai
  await waitSent(page);
  expect(state.posts).toHaveLength(2);
  await expect(page.locator('.cm-sync-chip')).toHaveText('☁️ envoyé');
});

test('5. le statut est relu depuis le serveur : résolu + message de retour', async ({ page }) => {
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'À résoudre');
  await waitSent(page);
  const t = await ticket(page);
  state.rows = [{ id_local: t.id, statut: 'resolu', message_retour: 'Corrigé dans la version 1.2', mis_a_jour_le: '2026-09-22T10:00:00Z' }];
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('.cm-status-chip')).toContainText('Résolu');
  await expect(page.locator('.cm-feedback')).toContainText('Corrigé dans la version 1.2');
  expect((await ticket(page)).status).toBe('resolu');
  // en_cours → pris en compte
  await page.locator('#cmPanelBtn').click(); await H.activate(page);
  await H.addPin(page, 'tbody tr:nth-child(2) td:nth-child(2)', 'En cours');
  await waitSent(page, 1);
  const t2 = await ticket(page, 1);
  state.rows.push({ id_local: t2.id, statut: 'en_cours', message_retour: null, mis_a_jour_le: '2026-09-22T11:00:00Z' });
  await H.deactivate(page); await page.locator('#cmPanelBtn').click();
  await expect(page.locator('.cm-panel-item').nth(1).locator('.cm-status-chip')).toContainText('Pris en compte');
});

test('6. un ticket modifié avant prise en charge est renvoyé (mise à jour)', async ({ page }) => {
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Version 1');
  await waitSent(page);
  await page.locator('.cm-pin').click();
  await page.locator('.cm-popup textarea').fill('Version 2');
  await page.locator('.cm-popup textarea').press('Enter');
  await expect.poll(() => state.posts.length, { timeout: 15000 }).toBe(2);
  expect(state.posts[1].body.texte).toBe('Version 2');
  expect(state.posts[1].body.id_local).toBe(state.posts[0].body.id_local);
});

test('7. mode mock : rien ne part, aucune puce d’envoi', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Local');
  await page.waitForTimeout(1500);
  expect(state.signups).toBe(0); expect(state.posts).toHaveLength(0);
  await H.deactivate(page); await page.locator('#cmPanelBtn').click();
  await expect(page.locator('.cm-sync-chip')).toHaveCount(0);
});

test('8. mode live : rapport et « Coller un retour » cachés, réapparaissent si un ticket est coincé', async ({ page }) => {
  const report = page.locator('#cmReportFoot');
  const paste = page.locator('#cmPasteBtn');
  await page.locator('#cmPanelBtn').click();
  await expect(report).toBeHidden();               // aucun ticket : rien à sortir
  await expect(paste).toBeHidden();
  await expect(page.locator('#cmClearAllBtn, .cm-panel-tools button').first()).toBeVisible();  // Effacer reste

  await page.locator('#cmPanelBtn').click();
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Ticket envoyé');
  await waitSent(page);
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await expect(report).toBeHidden();               // tout est parti : toujours cachés
  await expect(paste).toBeHidden();

  // un ticket qui ne part pas → le filet de secours réapparaît
  await page.locator('#cmPanelBtn').click();
  await H.activate(page);
  state.failNext = { status: 500, erreur: 'serveur indisponible' };
  await H.addPin(page, 'tbody tr:nth-child(2) td:nth-child(2)', 'Ticket coincé');
  await expect.poll(async () => ((await ticket(page, 1)).sync || {}).state, { timeout: 15000 }).toBe('error');
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await expect(report).toBeVisible();
  await expect(paste).toBeVisible();
});

test('9. mode mock : rapport et « Coller un retour » toujours là', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload();
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmReportFoot')).toBeVisible();
  await expect(page.locator('#cmPasteBtn')).toBeVisible();
});
