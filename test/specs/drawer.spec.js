// Le tiroir pousse la page (marge droite) et ajuste les éléments fixés à l'écran.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

test('Kiosque : le contenu se réorganise à gauche du tiroir, et revient à la fermeture', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload();
  const before = await page.locator('main').boundingBox();
  await H.ouvrirListe(page);
  await page.waitForTimeout(400);
  const panel = await page.locator('#cmPanel').boundingBox();
  const main = await page.locator('main').boundingBox();
  expect(main.x + main.width).toBeLessThanOrEqual(panel.x + 1);        // rien sous le tiroir
  expect(await page.evaluate(() => document.documentElement.style.marginRight)).toBe('340px');   // V2 : liste de 340 px (fiche Tiroir)
  // 0.4.0 (fiche BoutonWitmit) : witmit ouvert, le bouton a quitté la page.
  await expect(page.locator('#cmPanelBtn')).toBeHidden();
  await page.locator('#cmPanel .cm-panel-reduire').click();
  await page.waitForTimeout(400);
  const after = await page.locator('main').boundingBox();
  expect(Math.abs(after.width - before.width)).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.style.marginRight)).toBe('');
});

test('TellUs : la navbar fixe est rétrécie, les contrôles fixes en bas à droite sont décalés, puis rétablis', async ({ page }) => {
  await page.goto(H.fileUrl('tellus-accueil.html'));
  await H.clearStorage(page); await page.reload();
  const navBefore = await page.locator('.navbar').boundingBox();
  const ctrlBefore = await page.locator('.mock-controls').boundingBox();
  await H.ouvrirListe(page);
  await page.waitForTimeout(400);
  const panel = await page.locator('#cmPanel').boundingBox();
  const nav = await page.locator('.navbar').boundingBox();
  const ctrl = await page.locator('.mock-controls').boundingBox();
  expect(nav.x + nav.width).toBeLessThanOrEqual(panel.x + 1);
  expect(ctrl.x + ctrl.width).toBeLessThanOrEqual(panel.x + 1);
  await page.locator('#cmPanel .cm-panel-reduire').click();
  await page.waitForTimeout(400);
  const navAfter = await page.locator('.navbar').boundingBox();
  const ctrlAfter = await page.locator('.mock-controls').boundingBox();
  expect(Math.abs(navAfter.width - navBefore.width)).toBeLessThan(2);
  expect(Math.abs(ctrlAfter.x - ctrlBefore.x)).toBeLessThan(2);
});

test('les repères restent accrochés après le déplacement du contenu', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload(); await H.activate(page);
  await H.addPin(page, '.kpi-tile:nth-child(3) .kpi-value', 'droite');
  await H.ouvrirListe(page);
  await expect.poll(async () => {
    const target = await page.locator('.kpi-tile:nth-child(3) .kpi-value').boundingBox();
    const frame = await page.locator('.cm-box-outline').boundingBox();
    return Math.abs(frame.x - target.x) < 3 && Math.abs(frame.width - target.width) < 3;
  }, { timeout: 3000 }).toBe(true);
});

test('data-drawer="overlay" : le tiroir recouvre la page', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard-nolines.html'));
  await H.ouvrirListe(page);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.documentElement.style.marginRight)).toBe('');
});

test('Échap annule d’abord un champ en cours (le tiroir reste), puis replie witmit entier (liste et mode)', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Un ticket');
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await page.locator('.cm-panel-item .body').click();             // c1 : un clic choisit le retour…
  await page.locator('.cm-panel-item .body').click();             // …un deuxième l'ouvre, son texte en place dans le champ
  await expect(page.locator('.cm-inline-edit')).toBeVisible();
  await page.keyboard.press('Escape');                            // 1er Échap : annule le champ et referme le retour, le tiroir reste
  await expect(page.locator('.cm-inline-edit')).toHaveCount(0);
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await page.keyboard.press('Escape');                            // 2e : replie witmit (0.4.0 : liste et mode ensemble)
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
});

// ---------- Lot 5 : pied de la liste, confirmations, suppressions en live (C9) ----------

test('« effacer (page) » demande confirmation (maquette) ; « masquer witmit » a quitté la liste (live, 0.4.0)', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Un');
  await H.addPin(page, 'tbody tr:nth-child(2) td:nth-child(2)', 'Deux');
  await H.deactivate(page);
  await H.ouvrirListe(page);
  // Refus : rien n'est effacé.
  const refus = H.repondreConfirmation(page, false);   // 0.4.0 : la question au pied de la liste, « annuler »
  await page.locator('#cmClearPageBtn').click();
  expect(await refus).toBe("effacer les 2 retours de cette page ? c'est définitif.");
  await expect(page.locator('.cm-panel-item')).toHaveCount(2);
  // Accord : effacés, avec le message de Léa.
  const accord = H.accepterConfirmation(page);
  await page.locator('#cmClearPageBtn').click();
  await accord;
  await expect(page.locator('.cm-panel-item')).toHaveCount(0);
  await expect(page.locator('#cmStatus')).toContainText('retours de cette page effacés.');
  // État vide (fiche Tiroir, 0.4.0) : la phrase, puis comment laisser un retour (les gestes, un par ligne) ; plus de touche
  // « nouveau retour » (le mode est déjà actif), l'aide du pied à sa place.
  await expect(page.locator('.cm-panel-empty p').first()).toHaveText("aucun retour sur cette page pour l'instant.");
  await expect(page.locator('.cm-panel-empty p').nth(1)).toHaveText('pour en laisser un, vise un élément de la page\u00a0:');
  await expect(page.locator('.cm-panel-empty li')).toHaveCount(4);
  await expect(page.locator('#cmPanel button', { hasText: 'nouveau retour' })).toHaveCount(0);
  await expect(page.locator('#cmPanelAide')).toBeVisible();
  // Live : « masquer witmit » a quitté la liste (R27) ; ⌥+A cache witmit et le message dit comment revenir.
  await page.goto(H.fileUrl('generic-dashboard-live.html') + '?witmit=on');
  await H.ouvrirListe(page);
  await expect(page.locator('#cmHideBtn')).toHaveCount(0);
  await expect(page.locator('#cmPanel')).not.toContainText('masquer witmit');
  await page.keyboard.press(H.CACHER);
  await expect(page.locator('#cmStatus')).toContainText('witmit est masqué. pour le retrouver :');
});

// 0.4.0 (décision d1 du 29/10, remplace C9) : un retour reçu par witmit garde sa corbeille tant qu'il n'est pas « pris en
// compte » : elle le retire (route « retirer » du guichet) ; un retour jamais reçu s'efface ici. « effacer (page) » et
// « vider tout (site) » n'effacent toujours que les retours jamais reçus.
test('d1 : en live, un retour reçu par witmit se retire (corbeille « retirer ») tant qu’il est nouveau ; un retour jamais reçu s’efface', async ({ page }) => {
  const KEY = 'witmit_kiosque-sync_v1';
  const state = {};
  await H.mockSupabase(page, state);
  await page.goto(H.fileUrl('generic-dashboard-sync.html'));
  await H.clearStorage(page);
  await page.goto(H.fileUrl('generic-dashboard-sync.html') + '?witmit=on');
  const sent = (i) => expect.poll(async () => (((await H.stored(page, KEY))[i] || {}).sync || {}).state, { timeout: 15000 });
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Reçu');
  await sent(0).toBe('sent');
  expect((await H.stored(page, KEY))[0].recuLe).toBeTruthy();
  // Reçu : la corbeille le retire (fenêtre et liste) ; modifié, il est renvoyé.
  await page.locator('.cm-pin').first().click();
  await expect(page.locator('.cm-popup .cm-delete')).toHaveAccessibleName('retirer ce retour');
  await page.locator('.cm-popup textarea').fill('Reçu, puis modifié');
  await page.locator('.cm-popup textarea').press('Enter');
  await expect.poll(() => state.posts.length, { timeout: 15000 }).toBe(2);
  // Un second retour refusé (429) : jamais reçu, il garde sa corbeille.
  state.failNext = { status: 429, erreur: 'trop de tickets' };
  await H.addPin(page, 'tbody tr:nth-child(2) td:nth-child(2)', 'Jamais reçu');
  await sent(1).toBe('error');
  await page.locator('.cm-pin').nth(1).click();
  await expect(page.locator('.cm-popup .cm-delete')).toHaveAccessibleName('supprimer ce retour');
  await page.keyboard.press('Escape');
  await H.deactivate(page);
  state.failNext = { status: 429, erreur: 'trop de tickets' };             // l'ouverture de la liste renvoie : refusé encore
  await H.ouvrirListe(page);
  await sent(1).toBe('error');
  await expect.poll(() => state.posts.length, { timeout: 15000 }).toBe(4);
  const lignes = page.locator('.cm-panel-item');
  await expect(lignes.nth(0).locator('.del')).toHaveAttribute('aria-label', 'retirer ce retour');
  await expect(lignes.nth(1).locator('.del')).toHaveCount(1);
  await H.ouvrirRetour(page, lignes.nth(1));                                 // c1 (V2) : la corbeille est dans le retour ouvert
  await expect(lignes.nth(1).locator('.del')).toHaveAccessibleName('supprimer ce retour');
  await expect(page.locator('#cmClearPageBtn')).toBeVisible();
  await expect(page.locator('#cmClearSiteBtn')).toBeVisible();
  // Les fonctions appelées directement refusent le retour reçu ; « effacer (page) » n'efface que l'autre.
  const [recu, autre] = await H.stored(page, KEY);
  await page.evaluate((id) => window.cmDeleteById(id), recu.id);
  expect((await H.stored(page, KEY)).map((c) => c.id)).toEqual([recu.id, autre.id]);
  const question = H.accepterConfirmation(page);
  await page.evaluate(() => window.cmClearAll());
  expect(await question).toBe("effacer le retour pas encore parti de cette page ? c'est définitif. tes retours envoyés restent.");
  expect((await H.stored(page, KEY)).map((c) => c.id)).toEqual([recu.id]);
  await expect(page.locator('#cmStatus')).toContainText('retours pas encore partis effacés.', { timeout: 10000 });   // après les 6 s du message d'échec de l'envoi refusé
  await page.evaluate(() => window.cmClearSite());                        // plus rien de supprimable : rien, sans question
  expect((await H.stored(page, KEY)).map((c) => c.id)).toEqual([recu.id]);
  await expect(page.locator('#cmClearPageBtn')).toBeHidden();
  await expect(page.locator('#cmClearSiteBtn')).toBeHidden();
  await expect(lignes.nth(0).locator('.del')).toHaveAttribute('aria-label', 'retirer ce retour');
  expect(state.retraits).toHaveLength(0);                               // rien n'a été retiré sans la corbeille
});

test('C9 et d1 : pendant « envoi en cours », pas de corbeille ; au premier chargement de la 0.2.0, recuLe posé sur les retours qui portent une trace du guichet', async ({ page }) => {
  const KEY = 'witmit_kiosque-sync_v1';
  const state = {};
  await H.mockSupabase(page, state);
  await page.goto(H.fileUrl('generic-dashboard-sync.html'));
  await H.clearStorage(page);
  await page.evaluate((k) => {
    const now = new Date().toISOString();
    const base = (id, extra) => Object.assign({ id, type: 'pin', status: 'nouveau', page: 'generic-dashboard-sync.html', zone: 'Cellule ' + id, text: 'Retour ' + id, date: now, category: 'a-classer', fallback: { x: 40, y: 40 } }, extra);
    localStorage.setItem(k, JSON.stringify([
      base('enroute', { sync: { state: 'pending', at: now } }),                                 // envoi en cours (récent)
      base('avecid', { sync: { state: 'sent', id: 'srv-9', statut: 'nouveau', at: now } }),    // envoyé en 0.1
      base('modifie', { sync: null, thread: [{ de: 'equipe', texte: 'Vu', rouvre: false, cree_le: now }] }),   // reçu puis modifié
      base('serveur', { status: 'resolu', resolvedBy: 'serveur', resolvedAt: now, sync: null }),
      base('jamais', { sync: { state: 'error', error: 'hors ligne', at: now } }),
    ]));
  }, KEY);
  state.failNext = { status: 429, erreur: 'trop de tickets' };
  await page.goto(H.fileUrl('generic-dashboard-sync.html') + '?witmit=on');
  const l = await H.stored(page, KEY);
  const recu = Object.fromEntries(l.map((c) => [c.id, !!c.recuLe]));
  expect(recu).toEqual({ enroute: false, avecid: true, modifie: true, serveur: true, jamais: false });
  // Le chargement ne remet pas en route un envoi récent : « envoi en cours… », sans corbeille.
  const ligne = (id) => page.locator(`.cm-panel-item[data-id="${id}"]`);
  await page.evaluate(() => document.getElementById('cmPanel').classList.add('show'));   // regarder la liste sans relancer l'envoi
  await expect(ligne('enroute').locator('.cm-sync-chip')).toHaveText('envoi en cours…');
  await expect(ligne('enroute').locator('.del')).toHaveCount(0);
  // d1 : envoyé et encore « nouveau », avec son identifiant au guichet : « retirer » ; reçu sans identifiant ou terminé : rien.
  await expect(ligne('avecid').locator('.del')).toHaveAttribute('aria-label', 'retirer ce retour');
  for (const id of ['modifie', 'serveur']) await expect(ligne(id).locator('.del'), id).toHaveCount(0);
  await expect(ligne('jamais').locator('.del')).toHaveCount(1);
});
