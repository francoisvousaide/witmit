// Étape 2 : catégorie par mots-clés (locale) + bloc technique par ticket.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');
const KEY = 'witmit_kiosque_v1';

const CASES = [
  ['Le bouton déborde du cadre sur mobile', 'bug-visuel'],
  ['Le texte est coupé et mal aligné', 'bug-visuel'],
  ['Quand je valide, rien ne se passe', 'bug-fonctionnel'],
  ['Erreur 500 à l’enregistrement', 'bug-fonctionnel'],
  ['Impossible de fermer la fenêtre', 'bug-fonctionnel'],
  ['Le titre est trop petit, agrandir la police', 'ajustement'],
  ['Plus de marge entre les cartes', 'ajustement'],
  ['Faute d’orthographe : « acceuil »', 'texte'],
  ['Remplacer par « Valider ma commande »', 'texte'],
  ['Le clic devrait ouvrir la fiche au lieu de la liste', 'comportement'],
  ['Trier par date par défaut', 'comportement'],
  ['Il faudrait un bouton pour exporter', 'suggestion'],
  ['On pourrait ajouter un filtre par client', 'suggestion'],
  ['À quoi sert ce chiffre ?', 'question'],
  ['Pourquoi ce statut est en rouge ?', 'question'],
  ['Pourquoi le bouton déborde ?', 'bug-visuel'],          // un « ? » ne l’emporte pas sur un mot de bug
  ['Ne se met pas à jour après validation', 'bug-fonctionnel'],
  ['Le total n’apparaît pas', 'bug-fonctionnel'],
  ['Le titre n’est pas aligné avec l’icône', 'ajustement'],
  ['RAS ici', 'a-classer'],
  ['', 'a-classer'],
];

test('catégorisation par mots-clés : phrases types', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  for (const [phrase, expected] of CASES) {
    const got = await page.evaluate((t) => window.cmCategorize(t), phrase);
    expect(got, phrase).toBe(expected);
  }
});

test.describe('Bulle et stockage (Kiosque)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
  });

  // 0.4.0 (décision i1 du 02/11, fiche Fenetre) : plus de catégorie à choisir dans la fenêtre ; witmit la pose seul par ses
  // règles de mots-clés et l'envoie avec le ticket ; elle reste lisible dans la liste (et pour l'équipe).
  test('la catégorie est posée par witmit seul, d’après le texte, sans rien à choisir dans la fenêtre ; elle se lit dans la liste', async ({ page }) => {
    const b = await H.visibleBox(page, '.kpi-tile:nth-child(1) .kpi-value');
    await page.mouse.click(b.x + 5, b.y + 5);
    const ta = page.locator('.cm-popup textarea');
    await expect(page.locator('.cm-popup .cm-cat, .cm-popup .cm-cat-liste, .cm-popup .cm-cat-auto, .cm-popup .cm-libelle')).toHaveCount(0);
    await ta.fill('Il faudrait un séparateur de milliers');
    await ta.press('Enter');
    let data = await H.stored(page, KEY);
    expect(data[0]).toMatchObject({ category: 'suggestion', categoryManual: false });
    await expect(page.locator('.cm-panel-item .cm-cat-chip')).toHaveText('suggestion');
    // Modifié : la catégorie suit le nouveau texte.
    await page.locator('.cm-pin').click();
    await page.locator('.cm-popup textarea').fill('Le chiffre déborde de la tuile');
    await page.locator('.cm-popup textarea').press('Enter');
    data = await H.stored(page, KEY);
    expect(data[0].category).toBe('bug-visuel');
  });

  test('bloc technique : sélecteur, page, fenêtre, navigateur, thème, erreurs console récentes', async ({ page }) => {
    await page.evaluate(() => { console.error('boom test'); setTimeout(() => { throw new Error('kaboom'); }, 0); });
    await page.waitForTimeout(50);
    await H.addPin(page, '.kpi-tile:nth-child(2) .kpi-value', 'Ne se met pas à jour');
    const t = (await H.stored(page, KEY))[0].tech;
    expect(t.selectors).toHaveLength(1);
    expect(t.selectors[0]).toMatch(/article:nth-of-type\(2\) > div:nth-of-type\(2\)$/);
    expect(t.labels).toEqual(['texte « 37 » · dans « Commandes »']);   // 0.4.0 : le type et le nom de l'élément visé (fiche Icones)
    expect(t.type).toBe('clic');
    expect(t.page.file).toBe('generic-dashboard.html');
    expect(t.viewport.width).toBe(1280);
    expect(t.browser).toMatch(/Chrom|Chrome/);
    expect(t.theme).toMatch(/clair|sombre/);
    expect(t.consoleErrors.map((e) => e.message).join(' | ')).toContain('boom test');
    expect(t.consoleErrors.map((e) => e.message).join(' | ')).toContain('kaboom');
    expect(t.consoleErrors.length).toBeLessThanOrEqual(5);
    expect(JSON.stringify(t)).not.toContain('?'); // pas de paramètres d'URL
    // visible dans la liste, replié
    await H.deactivate(page);
    await H.ouvrirListe(page);
    await expect(page.locator('.cm-panel-item .cm-cat-chip')).toHaveText('bug fonctionnel');
    await expect(page.locator('.cm-panel-item details.cm-tech pre')).toBeHidden();
    await H.ouvrirRetour(page, page.locator('.cm-panel-item').first());   // c1 (V2) : les détails sont dans le retour ouvert
    await page.locator('.cm-panel-item details.cm-tech summary').click();
    await expect(page.locator('.cm-panel-item details.cm-tech pre')).toContainText('cible : main');
    await expect(page.locator('.cm-panel-item details.cm-tech pre')).toContainText('boom test');
  });

  test('groupe et encadré : plusieurs sélecteurs / type adapté ; rapport texte avec catégorie', async ({ page }) => {
    const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
    const b = await H.visibleBox(page, '.kpi-tile:nth-child(1) .kpi-value');
    await page.mouse.click(b.x + 5, b.y + 5);
    await expect(page.locator('.cm-popup')).toBeVisible();
    const r = await H.visibleBox(page, '.kpi-tile:nth-child(3) .kpi-value');
    await page.keyboard.down(MOD); await page.mouse.click(r.x + 5, r.y + 5); await page.keyboard.up(MOD);
    await page.locator('.cm-popup textarea').fill('Même police pour ces deux chiffres');
    await page.locator('.cm-popup textarea').press('Enter');
    const row = await H.visibleBox(page, 'tbody');
    await H.drag(page, row.x - 4, row.y - 4, row.x + row.width + 4, row.y + row.height + 4);
    await page.locator('.cm-popup textarea').fill('Ce tableau est trop large');
    await page.locator('.cm-popup textarea').press('Enter');
    const data = await H.stored(page, KEY);
    expect(data[0].tech.type).toBe('groupe');
    expect(data[0].tech.selectors).toHaveLength(2);
    expect(data[0].category).toBe('ajustement');
    expect(data[1].tech.type).toBe('encadré');
    expect(data[1].tech.position.relW).toBeGreaterThan(0);
    await H.deactivate(page);
    await H.ouvrirListe(page);
    H.repondreConfirmation(page, false);
    await page.locator('.cm-panel-foot button', { hasText: 'Copier' }).click();
    await expect(page.locator('#cmStatus')).toContainText('copié');
    const txt = await page.evaluate(() => navigator.clipboard.readText());
    expect(txt).toContain(' — ajustement visuel · nouveau');
    expect(txt).toContain('"categorie": "ajustement visuel"');   // Léa 3.12 : catégorie en minuscules
  });
});
