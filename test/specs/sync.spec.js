// Mode live : envoi des tickets au guichet (Edge Function) — Supabase est SIMULÉ par interception réseau,
// mais le widget résout un vrai défi Altcha (sha256) et envoie de vraies requêtes.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const PAGE = 'generic-dashboard-sync.html';
const KEY = 'witmit_kiosque-sync_v1';
// Faux Supabase (identité anonyme, défi, dépôt, relecture des statuts) : voir helpers.js.
const mockSupabase = H.mockSupabase;
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
  await expect(page.locator('.cm-sync-chip')).toHaveText('envoyé');
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
  await expect(page.locator('#cmStatus')).toHaveText("envoi impossible : trop d'envois d'un coup. ton retour est gardé ici ; réessaie dans quelques minutes.");
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();   // ouvrir le tiroir = nouvel essai
  await waitSent(page);
  expect(state.posts).toHaveLength(2);
  await expect(page.locator('.cm-sync-chip')).toHaveText('envoyé');
});

test('5. le statut est relu depuis le serveur : résolu + message de retour', async ({ page }) => {
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'À résoudre');
  await waitSent(page);
  const t = await ticket(page);
  state.rows = [{ id_local: t.id, statut: 'resolu', message_retour: 'Corrigé dans la version 1.2', mis_a_jour_le: '2026-09-22T10:00:00Z' }];
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('.cm-status-chip')).toContainText('résolu');
  await expect(page.locator('.cm-feedback')).toContainText('Corrigé dans la version 1.2');
  expect((await ticket(page)).status).toBe('resolu');
  // en_cours → pris en compte
  await page.locator('#cmPanelBtn').click(); await H.activate(page);
  await H.addPin(page, 'tbody tr:nth-child(2) td:nth-child(2)', 'En cours');
  await waitSent(page, 1);
  const t2 = await ticket(page, 1);
  state.rows.push({ id_local: t2.id, statut: 'en_cours', message_retour: null, mis_a_jour_le: '2026-09-22T11:00:00Z' });
  await H.deactivate(page); await page.locator('#cmPanelBtn').click();
  await expect(page.locator('.cm-panel-item').nth(1).locator('.cm-status-chip')).toContainText('pris en compte');
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

test('8. mode live : rapport, « coller un retour » et « effacer (page) » cachés, réapparaissent si un retour est coincé (C9)', async ({ page }) => {
  const report = page.locator('#cmReportFoot');
  const paste = page.locator('#cmPasteBtn');
  const effacer = page.locator('#cmClearPageBtn');
  await page.locator('#cmPanelBtn').click();
  await expect(report).toBeHidden();               // aucun retour : rien à sortir
  await expect(paste).toBeHidden();
  await expect(effacer).toBeHidden();              // rien de supprimable : « effacer (page) » absent

  await page.locator('#cmPanelBtn').click();
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Retour envoyé');
  await waitSent(page);
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await expect(report).toBeHidden();               // tout est parti : toujours cachés
  await expect(paste).toBeHidden();
  await expect(effacer).toBeHidden();              // un retour reçu par witmit ne s'efface plus

  // un retour qui ne part pas (faux serveur en 429) → le filet de secours réapparaît, « effacer (page) » aussi
  await page.locator('#cmPanelBtn').click();
  await H.activate(page);
  state.failNext = { status: 429, erreur: 'trop de tickets, réessaie plus tard' };
  await H.addPin(page, 'tbody tr:nth-child(2) td:nth-child(2)', 'Retour coincé');
  await expect.poll(async () => ((await ticket(page, 1)).sync || {}).state, { timeout: 15000 }).toBe('error');
  await H.deactivate(page);
  state.failNext = { status: 429, erreur: 'trop de tickets, réessaie plus tard' };   // l'ouverture de la liste renvoie : refusé encore
  await page.locator('#cmPanelBtn').click();
  await expect.poll(() => state.posts.length, { timeout: 15000 }).toBe(3);
  await expect.poll(async () => ((await ticket(page, 1)).sync || {}).state, { timeout: 15000 }).toBe('error');
  await expect(report).toBeVisible();
  await expect(paste).toBeVisible();
  await expect(effacer).toBeVisible();
});

test('9. mode mock : rapport et « Coller un retour » toujours là', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload();
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmReportFoot')).toBeVisible();
  await expect(page.locator('#cmPasteBtn')).toBeVisible();
});

test('10. un 409 « déjà pris en charge » prouve que le retour est chez le guichet : recuLe posé (C9)', async ({ page }) => {
  state.failNext = { status: 409, erreur: 'ticket déjà pris en charge, plus modifiable' };
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Déjà chez l’équipe');
  await expect.poll(async () => ((await ticket(page)).sync || {}).state, { timeout: 15000 }).toBe('error');
  expect((await ticket(page)).recuLe).toBeTruthy();
  await H.deactivate(page);
  await page.evaluate(() => document.getElementById('cmPanel').classList.add('show'));   // la liste, sans relancer l'envoi
  await expect(page.locator('.cm-panel-item .del')).toHaveCount(0);
});

// Raisons d'échec en clair (Léa 3.11) et fin du renvoi automatique après un refus définitif (décision E1 de Tom).
const CIBLES = ['tbody tr:nth-child(1) td:nth-child(2)', 'tbody tr:nth-child(2) td:nth-child(2)', 'tbody tr:nth-child(3) td:nth-child(2)', 'tbody tr:nth-child(1) td:nth-child(4)', 'tbody tr:nth-child(2) td:nth-child(4)'];
const etatEnvoi = async (page, i) => ((await ticket(page, i)).sync || {}).state;

test('11. raisons en clair (429, 409, 413, 500, puis hors ligne) ; la raison brute seulement dans la console', async ({ page }) => {
  test.setTimeout(45000);
  const consoleTextes = [];
  page.on('console', (m) => consoleTextes.push(m.text()));
  const toast = page.locator('#cmStatus');
  const cas = [
    [{ status: 429, erreur: 'trop de tickets, réessaie plus tard' }, "envoi impossible : trop d'envois d'un coup. ton retour est gardé ici ; réessaie dans quelques minutes."],
    [{ status: 409, erreur: 'ticket déjà pris en charge, plus modifiable' }, "envoi impossible : l'équipe l'a déjà pris en compte. ta modification ne partira pas ; dis-la à l'équipe avec « répondre » quand elle t'aura écrit."],
    [{ status: 413, erreur: 'texte trop long' }, "envoi impossible : ton retour dépasse 5 000 caractères. il ne repartira pas tel quel : raccourcis-le, il repartira dès que tu l'auras modifié."],
    [{ status: 500, erreur: 'enregistrement impossible' }, 'envoi impossible : le service witmit ne répond pas. ton retour est gardé ici et repartira tout seul.'],
  ];
  await H.activate(page);
  for (let i = 0; i < cas.length; i++) {
    const [refus, phrase] = cas[i];
    state.failNext = refus;
    await H.addPin(page, CIBLES[i], 'Retour ' + (i + 1));
    await expect.poll(() => etatEnvoi(page, i), { timeout: 15000 }).toBe('error');
    await expect(toast).toHaveText(phrase);
    await expect(toast).toHaveAttribute('role', 'status');
    await expect(toast.locator('svg[data-icone="WarningCircle"]')).toHaveCount(1);
    expect(consoleTextes.some((t) => t.includes(refus.erreur)), 'raison brute dans la console : ' + refus.erreur).toBe(true);
  }
  // hors ligne : la coupure réseau
  await H.horsLigne(page, state, true);
  await H.addPin(page, CIBLES[4], 'Retour hors ligne');
  await expect.poll(() => etatEnvoi(page, 4), { timeout: 15000 }).toBe('error');
  await expect(toast).toHaveText('envoi impossible : pas de connexion. ton retour est gardé ici et repartira tout seul.');
  // (on reste hors ligne : au retour de la connexion, les retours en 429 et en 500 repartiraient — test 14)
  // la raison brute n'est jamais à l'écran : ni dans les textes, ni dans les info-bulles
  await H.deactivate(page);
  await page.evaluate(() => document.getElementById('cmPanel').classList.add('show'));   // la liste, sans relancer l'envoi
  const ecran = await page.evaluate(() => [...document.querySelectorAll('.cm-ui, .cm-ui *')].map((el) => (el.getAttribute('title') || '') + ' ' + (el.childNodes.length === 1 && el.firstChild.nodeType === 3 ? el.textContent : '')).join(' | '));
  for (const [refus] of cas) expect(ecran).not.toContain(refus.erreur);
  expect(ecran).not.toMatch(/failed to fetch|internet_disconnected/i);
  await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-sync-error')).toHaveAttribute('title', "trop d'envois d'un coup. clique pour réessayer.");
  await expect(page.locator('.cm-panel-item').nth(2).locator('.cm-sync-error')).toHaveAttribute('title', 'ton retour dépasse 5 000 caractères.');
  await expect(page.locator('.cm-panel-item').nth(4).locator('.cm-sync-error')).toHaveAttribute('title', 'pas de connexion. clique pour réessayer.');
});

test('12. aucun renvoi automatique après un 409 ou un 413 : ni à l’ouverture de la liste, ni au chargement ; il repart une fois modifié', async ({ page }) => {
  test.setTimeout(45000);
  await H.activate(page);
  state.failNext = { status: 413, erreur: 'texte trop long' };
  await H.addPin(page, CIBLES[0], 'Un retour trop long');
  await expect.poll(() => etatEnvoi(page, 0), { timeout: 15000 }).toBe('error');
  state.failNext = { status: 409, erreur: 'identifiant déjà pris' };
  await H.addPin(page, CIBLES[1], 'Un identifiant déjà pris');
  await expect.poll(() => etatEnvoi(page, 1), { timeout: 15000 }).toBe('error');
  await expect(page.locator('#cmStatus')).toHaveText('envoi impossible : witmit a refusé ce retour. il ne repartira pas : efface-le et écris-en un nouveau.');
  expect(state.posts).toHaveLength(2);
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();                       // ouvrir la liste : aucun nouvel essai
  await page.waitForTimeout(2500);
  expect(state.posts).toHaveLength(2);
  // « à renvoyer » n'est plus un bouton : son info-bulle donne la raison, sans « clique pour réessayer »
  const marque = page.locator('.cm-panel-item').nth(0).locator('.cm-sync-error');
  await expect(marque.locator('b')).toHaveText('à renvoyer');
  expect(await marque.evaluate((el) => el.tagName)).toBe('SPAN');
  await expect(marque).toHaveAttribute('title', 'ton retour dépasse 5 000 caractères.');
  // la raison est aussi lue au clavier et par un lecteur d'écran (le span n'est pas focalisable : son title ne suffit pas)
  await expect(marque).toHaveText('à renvoyer : ton retour dépasse 5 000 caractères.');      // contenu lu en parcourant la ligne
  await expect(marque.locator('.wm-lu')).toHaveText(' : ton retour dépasse 5 000 caractères.');
  const refuse = page.locator('.cm-panel-item').nth(1);
  await expect(refuse.locator('.cm-sync-error')).toHaveAttribute('title', 'witmit a refusé ce retour.');
  await expect(refuse.locator('.cm-sync-error .wm-lu')).toHaveText(' : witmit a refusé ce retour.');
  await expect(refuse.locator('.del')).toHaveCount(1);              // jamais reçu par witmit : la corbeille reste (C9), « efface-le »
  await page.reload();                                              // au chargement non plus
  await page.waitForTimeout(2500);
  expect(state.posts).toHaveLength(2);
  // modifié par l'auteur : il repart
  await H.activate(page);
  await page.locator('.cm-pin').first().click();
  await page.locator('.cm-popup textarea').fill('Un retour raccourci');
  await page.locator('.cm-popup textarea').press('Enter');
  await waitSent(page, 0);
  expect(state.posts).toHaveLength(3);
  expect(state.posts[2].body.texte).toBe('Un retour raccourci');
});

test('13. un dépôt en 500 est renvoyé (le guichet n’a rien enregistré) : à l’ouverture de la liste', async ({ page }) => {
  state.failNext = { status: 500, erreur: 'enregistrement impossible' };
  await H.activate(page);
  await H.addPin(page, CIBLES[0], 'Retour en 500');
  await expect.poll(() => etatEnvoi(page, 0), { timeout: 15000 }).toBe('error');
  await expect(page.locator('#cmStatus')).toHaveText('envoi impossible : le service witmit ne répond pas. ton retour est gardé ici et repartira tout seul.');
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await waitSent(page, 0);
  expect(state.posts).toHaveLength(2);
  expect(state.posts[1].body.id_local).toBe(state.posts[0].body.id_local);   // même identifiant : pas de doublon au guichet
});

test('14. renvoi au retour de la connexion, sans geste de l’auteur', async ({ page }) => {
  await H.activate(page);
  await H.horsLigne(page, state, true);
  await H.addPin(page, CIBLES[0], 'Écrit hors ligne');
  await expect.poll(() => etatEnvoi(page, 0), { timeout: 15000 }).toBe('error');
  await H.horsLigne(page, state, false);                          // l'évènement « online » relance l'envoi
  await waitSent(page, 0);
  expect(state.posts).toHaveLength(1);
  await expect(page.locator('#cmStatus')).toHaveText("retour envoyé à l'équipe.", { timeout: 10000 });   // après les 6 s de l'échec
});
