// Cas exacts remontés par François le 20/09 sur la page Kiosque : ciblage précis et libellés.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

test.describe('Détection de zone et libellés (Kiosque)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
  });

  test('clic sur "Chiffre du jour" → ce libellé, pas la rangée des 3 cartes', async ({ page }) => {
    const b = await H.visibleBox(page, '.kpi-tile:first-child .kpi-name');
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(page.locator('.cm-popup .cm-zone')).toHaveText('📍 Chiffre du jour');
    const outline = await page.locator('.cm-box-editing').boundingBox();
    expect(outline.width).toBeLessThan(b.width + 10); // le contour entoure le libellé, pas la section
  });

  test('clic dans la marge d’une tuile → la tuile (boîte visuelle), pas la rangée', async ({ page }) => {
    const b = await H.visibleBox(page, '.kpi-tile:first-child');
    await page.mouse.click(b.x + b.width - 6, b.y + b.height - 6);
    await expect(page.locator('.cm-popup .cm-zone')).toHaveText('📍 Chiffre du jour');
    const outline = await page.locator('.cm-box-editing').boundingBox();
    expect(Math.abs(outline.width - b.width)).toBeLessThan(4);
    await page.locator('.cm-popup textarea').fill('x');
    await page.locator('.cm-popup textarea').press('Enter');
    const data = await H.stored(page, 'annotate_kiosque_v1');
    expect(data[0].anchor.path).toMatch(/article:nth-of-type\(1\)$/);
  });

  test('encadré sur les 3 tuiles → "Zone encadrée — …" avec les textes contenus', async ({ page }) => {
    const b = await H.visibleBox(page, '.kpi-row');
    await H.drag(page, b.x - 4, b.y - 4, b.x + b.width + 4, b.y + b.height + 4);
    const zone = page.locator('.cm-popup .cm-zone');
    await expect(zone).toContainText('🔲 Zone encadrée — Chiffre du jour');
    await expect(zone).toContainText('(+');
    await page.locator('.cm-popup textarea').fill('x');
    await page.locator('.cm-popup textarea').press('Enter');
    const data = await H.stored(page, 'annotate_kiosque_v1');
    expect(data[0].zone.startsWith('Zone encadrée — Chiffre du jour')).toBe(true);
    expect(data[0].anchor.path).toBeTruthy(); // ancré au plus petit élément englobant (main), pas au centre
  });

  test('encadré partiel sur l’en-tête → libellé lisible, mots séparés', async ({ page }) => {
    const brand = await H.visibleBox(page, '.topbar .brand');
    // rectangle qui coupe le mot "KIOSQUE" en deux : aucun texte entièrement contenu
    await H.drag(page, brand.x + brand.width / 2, brand.y - 4, brand.x + brand.width + 120, brand.y + brand.height + 4);
    await expect(page.locator('.cm-popup .cm-zone')).toHaveText('🔲 Zone encadrée — dans : KIOSQUE · Ventes · Stocks · Réglages');
  });

  test('les icônes de type apparaissent dans la liste et dans le rapport', async ({ page }) => {
    await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'pin');
    const b = await H.visibleBox(page, '.kpi-tile:nth-child(2)');
    await H.drag(page, b.x - 4, b.y - 4, b.x + b.width + 4, b.y + b.height + 4);
    await page.locator('.cm-popup textarea').fill('box');
    await page.locator('.cm-popup textarea').press('Enter');
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('.cm-panel-item .zone').nth(0)).toHaveText('📍 Boulangerie Martin');
    await expect(page.locator('.cm-panel-item .zone').nth(1)).toHaveText('🔲 Zone encadrée — Commandes, 37');
    await page.locator('.cm-panel-foot button', { hasText: 'Copier' }).click();
    const txt = await page.evaluate(() => navigator.clipboard.readText());
    expect(txt).toContain('#1 [📍 Boulangerie Martin]');
    expect(txt).toContain('#2 [🔲 Zone encadrée — Commandes, 37]');
  });
});
