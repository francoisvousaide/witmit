// V2.1 : l'auteur déclaré par le site hôte — window.witmit.identify(), file d'attente window.witmitQueue,
// attribut data-user-name, ligne « Tes retours sont signés » dans le tiroir, nom envoyé au guichet (Supabase
// simulé) et écrit dans le rapport Markdown en mode maquette.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const PAGE = 'generic-dashboard-sync.html';
const KEY = 'witmit_kiosque-sync_v1';
const ticket = async (page, i = 0) => (await H.stored(page, KEY))[i];
const waitState = (page, i, st) => expect.poll(async () => ((await ticket(page, i)).sync || {}).state, { timeout: 15000 }).toBe(st);
const identify = (page, user) => page.evaluate((u) => window.witmit.identify(u), user);
const author = (page) => page.locator('#cmAuthor');
async function openDrawer(page) {
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanel')).toBeVisible();
}

test.describe('mode live (Supabase simulé)', () => {
  let state;
  test.beforeEach(async ({ page }) => {
    state = {};
    await H.mockSupabase(page, state);
    await page.goto(H.fileUrl(PAGE));
    await H.clearStorage(page);
  });

  test('1. identify après le chargement : ligne dans le tiroir, nom envoyé avec le ticket (source « hote »)', async ({ page }) => {
    await page.goto(H.fileUrl(PAGE) + '?witmit=on');
    await identify(page, { nom: '  Marine \n ' });
    await openDrawer(page);
    await expect(author(page)).toBeVisible();
    await expect(author(page)).toHaveText('Tes retours sont signés : Marine');
    await page.locator('#cmPanelBtn').click();
    await H.activate(page);
    await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Colonne trop étroite');
    await waitState(page, 0, 'sent');
    expect(state.posts[0].body.auteur_nom).toBe('Marine');
    expect(state.posts[0].body.auteur_source).toBe('hote');
    expect((await ticket(page)).author).toBe('Marine');
  });

  test('2. identify AVANT le chargement du script : l\'appel mis en file est exécuté', async ({ page }) => {
    await page.addInitScript(() => {
      (window.witmitQueue = window.witmitQueue || []).push(['identify', { nom: 'Éléonore' }]);
    });
    await page.goto(H.fileUrl(PAGE) + '?witmit=on');
    await openDrawer(page);
    await expect(author(page)).toHaveText('Tes retours sont signés : Éléonore');
    // après le chargement, un push dans la file s'exécute aussitôt
    await page.evaluate(() => window.witmitQueue.push(['identify', { nom: 'Marine' }]));
    await expect(author(page)).toHaveText('Tes retours sont signés : Marine');
  });

  test('3. identify(null) efface : plus de ligne, ticket suivant anonyme, rien de gardé au rechargement', async ({ page }) => {
    await page.goto(H.fileUrl(PAGE) + '?witmit=on');
    await identify(page, { nom: 'Marine' });
    await H.activate(page);
    await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Signé Marine');
    await waitState(page, 0, 'sent');
    await identify(page, null);
    await H.addPin(page, 'tbody tr:nth-child(2) td:nth-child(2)', 'Anonyme');
    await waitState(page, 1, 'sent');
    expect(state.posts[0].body.auteur_nom).toBe('Marine');
    expect(state.posts[1].body.auteur_nom).toBeUndefined();
    expect(state.posts[1].body.auteur_source).toBeUndefined();
    await H.deactivate(page);
    await openDrawer(page);
    await expect(author(page)).toBeHidden();
    // le nom n'est jamais gardé par le navigateur : rechargée sans identify, la page est anonyme
    await identify(page, { nom: 'Marine' });
    await page.reload();
    await openDrawer(page);
    await expect(author(page)).toBeHidden();
    const cles = await page.evaluate(() => Object.keys(localStorage).filter((k) => k !== 'witmit_kiosque-sync_v1' && (localStorage.getItem(k) || '').includes('Marine')));
    expect(cles).toEqual([]);
  });

  test('4. un ticket en attente d\'envoi garde l\'auteur qui l\'a écrit, même si le nom change entre-temps', async ({ page }) => {
    await page.goto(H.fileUrl(PAGE) + '?witmit=on');
    await identify(page, { nom: 'Marine' });
    state.failNext = { status: 500, erreur: 'serveur indisponible' };
    await H.activate(page);
    await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Écrit par Marine');
    await waitState(page, 0, 'error');
    await identify(page, { nom: 'Paul' });
    await H.deactivate(page);
    await openDrawer(page);   // ouvrir le tiroir = nouvel essai
    await waitState(page, 0, 'sent');
    const dernier = state.posts[state.posts.length - 1].body;
    expect(dernier.texte).toBe('Écrit par Marine');
    expect(dernier.auteur_nom).toBe('Marine');
  });

  test('5. le nom est affiché comme du texte (jamais interprété) et borné à 60 caractères', async ({ page }) => {
    await page.goto(H.fileUrl(PAGE) + '?witmit=on');
    await identify(page, { nom: '<img src=x onerror="window.__pirate=1">' });
    await openDrawer(page);
    await expect(author(page)).toContainText('<img src=x');
    expect(await page.locator('#cmAuthor img').count()).toBe(0);
    expect(await page.evaluate(() => window.__pirate)).toBeUndefined();
    await identify(page, 'X'.repeat(200));   // une simple chaîne est acceptée aussi
    await expect(author(page)).toHaveText('Tes retours sont signés : ' + 'X'.repeat(60));
    await identify(page, { nom: '   ' });
    await expect(author(page)).toBeHidden();
  });
});

test.describe('mode maquette', () => {
  test('6. attribut data-user-name lu au chargement : ligne dans le tiroir et « Signalé par » dans le rapport', async ({ page }) => {
    await page.goto(H.fileUrl('auteur-attribut.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, '#carte', 'Le montant est mal aligné');
    await H.deactivate(page);
    await openDrawer(page);
    await expect(author(page)).toHaveText('Tes retours sont signés : Élise');
    page.once('dialog', (d) => d.dismiss());
    await page.locator('.cm-panel-foot button', { hasText: 'Copier' }).click();
    await expect(page.locator('#cmStatus')).toContainText('copié');
    const md = await page.evaluate(() => navigator.clipboard.readText());
    expect(md).toContain('_Signalé par Élise_');
    expect(md).toContain('"auteur": "Élise"');
  });

  test('7. sans auteur déclaré : aucune ligne, rien dans le rapport', async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, '.kpi-tile:nth-child(1) .kpi-value', 'Anonyme');
    await H.deactivate(page);
    await openDrawer(page);
    await expect(author(page)).toBeHidden();
    page.once('dialog', (d) => d.dismiss());
    await page.locator('.cm-panel-foot button', { hasText: 'Copier' }).click();
    await expect(page.locator('#cmStatus')).toContainText('copié');
    const md = await page.evaluate(() => navigator.clipboard.readText());
    expect(md).not.toContain('Signalé par');
    expect(md).not.toContain('"auteur"');
  });
});
