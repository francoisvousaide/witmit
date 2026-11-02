// witmit 0.4.0, lot 4 : le retrait réel d'un retour (décision d1 du 29/10). Le guichet est SIMULÉ par interception
// réseau, mais il répond comme la route « …/submit-annotation/retirer » déployée : 200 { id, statut: "retire" }, avec
// un « avertissement » si GitHub n'a pas pu fermer l'issue. Un retour au statut « retire » quitte la liste de son auteur,
// au chargement comme après la relecture des statuts ; « retiré » n'est jamais affiché comme un statut.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const PAGE = 'generic-dashboard-sync.html';
const KEY = 'witmit_kiosque-sync_v1';
const ticket = async (page, i = 0) => (await H.stored(page, KEY))[i];
const waitSent = (page, i = 0) => expect.poll(async () => (((await ticket(page, i)) || {}).sync || {}).state, { timeout: 15000 }).toBe('sent');

let state;
test.beforeEach(async ({ page }) => {
  state = {};
  await H.mockSupabase(page, state);
  await page.goto(H.fileUrl(PAGE));
  await H.clearStorage(page);
  await page.goto(H.fileUrl(PAGE) + '?witmit=on');
});

async function deuxRetoursEnvoyes(page) {
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Premier, à retirer');
  await waitSent(page, 0);
  await H.addPin(page, 'tbody tr:nth-child(2) td:nth-child(2)', 'Second, gardé');
  await waitSent(page, 1);
  return [await ticket(page, 0), await ticket(page, 1)];
}

test('1. retrait réel : la route reçoit { ticket_id } avec le jeton, sans preuve ; 200 avec avertissement GitHub : le retour quitte quand même la liste', async ({ page }) => {
  const [t0] = await deuxRetoursEnvoyes(page);
  const appels = [];
  await page.route('https://witmit.test/functions/v1/submit-annotation/retirer', async (route, req) => {
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: '{}' });
    const body = req.postDataJSON();
    appels.push({ body, headers: req.headers() });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ id: body.ticket_id, statut: 'retire', avertissement: "retour retiré, mais son issue GitHub n'a pas pu être fermée" }) });
  });
  await page.locator('.cm-pin[data-id="' + t0.id + '"]').click();
  await page.locator('.cm-popup .cm-delete').click();
  await expect.poll(() => appels.length).toBe(1);
  expect(appels[0].body).toEqual({ ticket_id: t0.sync.id });
  expect(Object.keys(appels[0].body)).toEqual(['ticket_id']);              // ni altcha, ni projet : la route n'en veut pas
  expect(appels[0].headers['authorization']).toBe('Bearer jeton-A');
  expect(appels[0].headers['apikey']).toBeTruthy();
  await expect(page.locator('#cmStatus')).toHaveText("retour retiré : l'équipe ne le verra plus.");
  await expect.poll(async () => (await H.stored(page, KEY)).map((c) => c.text)).toEqual(['Second, gardé']);
  await expect(page.locator('#cmList .cm-panel-item')).toHaveCount(1);
  await expect(page.locator('.cm-pin[data-id="' + t0.id + '"]')).toHaveCount(0);
});

test('2. statut « retire » relu du serveur (retiré depuis un autre onglet) : le retour quitte la liste, sans statut affiché', async ({ page }) => {
  const [t0, t1] = await deuxRetoursEnvoyes(page);
  state.rows = [
    { id_local: t0.id, page: null, statut: 'retire', message_retour: null, mis_a_jour_le: '2026-11-02T16:00:00Z', messages: [] },
    { id_local: t1.id, page: null, statut: 'nouveau', message_retour: null, mis_a_jour_le: '2026-11-02T15:00:00Z', messages: [] },
  ];
  await H.deactivate(page);
  await H.ouvrirListe(page);                                               // ouvrir la liste relit les statuts
  await expect.poll(async () => (await H.stored(page, KEY)).map((c) => c.id)).toEqual([t1.id]);
  await expect(page.locator('#cmList .cm-panel-item')).toHaveCount(1);
  await expect(page.locator('#cmList')).not.toContainText('retiré');
  await expect(page.locator('#cmList')).not.toContainText('retire');
  await expect(page.locator('.cm-pin[data-id="' + t0.id + '"]')).toHaveCount(0);
  expect(state.retraits).toHaveLength(0);                                  // rien n'a été redemandé au guichet
});

test('3. au chargement : un retour déjà vu « retire » ne revient jamais dans la liste, et le carnet du navigateur l’oublie', async ({ page }) => {
  const [t0, t1] = await deuxRetoursEnvoyes(page);
  await page.evaluate(([k, id]) => {
    const tous = JSON.parse(localStorage.getItem(k));
    tous.forEach((c) => { if (c.id === id) c.sync.statut = 'retire'; });
    localStorage.setItem(k, JSON.stringify(tous));
  }, [KEY, t0.id]);
  await page.reload();
  await expect.poll(async () => (await H.stored(page, KEY)).map((c) => c.id)).toEqual([t1.id]);
  await H.ouvrirListe(page);
  await expect(page.locator('#cmList .cm-panel-item')).toHaveCount(1);
  await expect(page.locator('#cmList')).not.toContainText('retiré');
  await expect(page.locator('.cm-pin[data-id="' + t0.id + '"]')).toHaveCount(0);
});

test('4. version 0.4.0 : window.witmit.version', async ({ page }) => {
  expect(await page.evaluate(() => window.witmit.version)).toBe('0.4.0');
});
