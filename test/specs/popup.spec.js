// Retours du 20/09 (2e série) : Échap, bulle déplaçable, encadré ajustable, position de la pastille de texte.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');
const KEY = 'annotate_kiosque_v1';

test.describe('Bulle et encadré (Kiosque)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
  });

  test('Échap annule la bulle ; un second Échap quitte le mode', async ({ page }) => {
    const b = await H.visibleBox(page, 'tbody tr:first-child td:nth-child(2)');
    await page.mouse.click(b.x + 5, b.y + 5);
    await page.locator('.cm-popup textarea').fill('brouillon');
    await page.keyboard.press('Escape');
    await expect(page.locator('.cm-popup')).toHaveCount(0);
    await expect(page.locator('body')).toHaveClass(/cm-active/);
    expect(await H.stored(page, KEY)).toHaveLength(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  });

  test('la bulle se déplace par son bandeau, puis s’enregistre normalement', async ({ page }) => {
    const b = await H.visibleBox(page, 'tbody tr:first-child td:nth-child(2)');
    await page.mouse.click(b.x + 5, b.y + 5);
    const pop = page.locator('.cm-popup');
    const before = await pop.boundingBox();
    const zone = await pop.locator('.cm-zone').boundingBox();
    await H.drag(page, zone.x + 20, zone.y + 6, zone.x + 20 + 150, zone.y + 6 + 120);
    const after = await pop.boundingBox();
    expect(after.x - before.x).toBeGreaterThan(120);
    expect(after.y - before.y).toBeGreaterThan(90);
    await pop.locator('textarea').fill('déplacée');
    await pop.locator('textarea').press('Enter');
    expect(await H.stored(page, KEY)).toHaveLength(1);
  });

  test('encadré : poignées visibles, redimensionnement, libellé et ancrage recalculés', async ({ page }) => {
    const t1 = await H.visibleBox(page, '.kpi-tile:nth-child(1)');
    const t2 = await H.visibleBox(page, '.kpi-tile:nth-child(2)');
    await H.drag(page, t1.x - 4, t1.y - 4, t1.x + t1.width + 4, t1.y + t1.height + 4);
    await expect(page.locator('.cm-popup .cm-zone')).toHaveText('🔲 Zone encadrée — Chiffre du jour, 1 240 €');
    await expect(page.locator('.cm-box-editable .cm-handle')).toHaveCount(8);
    // on tire la poignée "e" (côté droit) jusqu'à couvrir la 2e tuile
    const h = await page.locator('.cm-handle-e').boundingBox();
    await H.drag(page, h.x + 5, h.y + 5, t2.x + t2.width + 4, h.y + 5);
    const box = await page.locator('.cm-box-editable').boundingBox();
    expect(box.x + box.width).toBeGreaterThan(t2.x + t2.width);
    await page.locator('.cm-popup textarea').fill('deux tuiles');
    await page.locator('.cm-popup textarea').press('Enter');
    await expect(page.locator('.cm-handle')).toHaveCount(0); // poignées retirées après enregistrement
    const data = await H.stored(page, KEY);
    expect(data[0].zone).toBe('Zone encadrée — Chiffre du jour, 1 240 €, Commandes (+1)');
    expect(data[0].fallback.w).toBeGreaterThan(t2.x + t2.width - t1.x - 10);
    // le repère rendu couvre bien les deux tuiles
    const saved = await page.locator('.cm-box-saved').boundingBox();
    expect(saved.x + saved.width).toBeGreaterThan(t2.x + t2.width);
  });

  test('encadré : déplacement au centre ; Annuler remet un encadré existant en place', async ({ page }) => {
    const t1 = await H.visibleBox(page, '.kpi-tile:nth-child(1)');
    await H.drag(page, t1.x - 4, t1.y - 4, t1.x + t1.width + 4, t1.y + t1.height + 4);
    await page.locator('.cm-popup textarea').fill('à déplacer');
    await page.locator('.cm-popup textarea').press('Enter');
    const before = await page.locator('.cm-box-saved').boundingBox();
    // réouverture via la pastille → l'encadré redevient ajustable
    await page.locator('.cm-pin').click();
    await expect(page.locator('.cm-box-editable .cm-handle')).toHaveCount(8);
    const c = await page.locator('.cm-box-editable').boundingBox();
    await H.drag(page, c.x + c.width / 2, c.y + c.height / 2, c.x + c.width / 2 + 200, c.y + c.height / 2 + 150);
    const moved = await page.locator('.cm-box-editable').boundingBox();
    expect(moved.x - before.x).toBeGreaterThan(150);
    await page.locator('.cm-popup .cm-cancel').click();
    const restored = await page.locator('.cm-box-saved').boundingBox();
    expect(Math.abs(restored.x - before.x)).toBeLessThan(3);
    expect(Math.abs(restored.y - before.y)).toBeLessThan(3);
    // rééditer, déplacer, Enregistrer → la nouvelle position est conservée après rechargement
    await page.locator('.cm-pin').click();
    const c2 = await page.locator('.cm-box-editable').boundingBox();
    await H.drag(page, c2.x + c2.width / 2, c2.y + c2.height / 2, c2.x + c2.width / 2 + 300, c2.y + c2.height / 2);
    await page.locator('.cm-popup textarea').press('Enter');
    await page.reload(); await H.activate(page);
    const afterReload = await page.locator('.cm-box-saved').boundingBox();
    expect(afterReload.x - before.x).toBeGreaterThan(250);
  });

  test('pastille de texte : en haut à droite de la fin du passage, sans cacher le texte', async ({ page }) => {
    const t = await H.visibleBox(page, 'tbody tr:nth-child(3) td:nth-child(2)');
    await H.drag(page, t.x + 2, t.y + 10, t.x + 120, t.y + 10, { shift: true });
    await page.locator('.cm-popup textarea').fill('x');
    await page.locator('.cm-popup textarea').press('Enter');
    const mark = await page.locator('mark.cm-highlight').last().boundingBox();
    const pin = await page.locator('.cm-pin').boundingBox();
    expect(pin.y + pin.height).toBeLessThanOrEqual(mark.y + 8);            // au-dessus du texte (la pointe inclinée peut effleurer)
    expect(pin.x + pin.width / 2).toBeGreaterThan(mark.x + mark.width - 14); // au niveau de la fin du passage
    await page.reload(); await H.activate(page);
    const pin2 = await page.locator('.cm-pin').boundingBox();
    expect(Math.abs(pin2.x - pin.x)).toBeLessThan(3); // même position après rechargement
  });
});
