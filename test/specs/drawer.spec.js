// Le tiroir pousse la page (marge droite) et ajuste les éléments fixés à l'écran.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

test('Kiosque : le contenu se réorganise à gauche du tiroir, et revient à la fermeture', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload();
  const before = await page.locator('main').boundingBox();
  await page.locator('#cmPanelBtn').click();
  await page.waitForTimeout(400);
  const panel = await page.locator('#cmPanel').boundingBox();
  const main = await page.locator('main').boundingBox();
  expect(main.x + main.width).toBeLessThanOrEqual(panel.x + 1);        // rien sous le tiroir
  expect(await page.evaluate(() => document.documentElement.style.marginRight)).toMatch(/^30[01]px$/);
  // les boutons flottants 💬📋 restent visibles (décalés à gauche du tiroir)
  const fab = await page.locator('.cm-fab').boundingBox();
  expect(fab.x + fab.width).toBeLessThanOrEqual(panel.x + 1);
  await page.locator('#cmPanel .cm-panel-head-row button').click();
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
  await page.locator('#cmPanelBtn').click();
  await page.waitForTimeout(400);
  const panel = await page.locator('#cmPanel').boundingBox();
  const nav = await page.locator('.navbar').boundingBox();
  const ctrl = await page.locator('.mock-controls').boundingBox();
  expect(nav.x + nav.width).toBeLessThanOrEqual(panel.x + 1);
  expect(ctrl.x + ctrl.width).toBeLessThanOrEqual(panel.x + 1);
  await page.locator('#cmPanel .cm-panel-head-row button').click();
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
  await page.locator('#cmPanelBtn').click();
  await expect.poll(async () => {
    const target = await page.locator('.kpi-tile:nth-child(3) .kpi-value').boundingBox();
    const frame = await page.locator('.cm-box-outline').boundingBox();
    return Math.abs(frame.x - target.x) < 3 && Math.abs(frame.width - target.width) < 3;
  }, { timeout: 3000 }).toBe(true);
});

test('data-drawer="overlay" : le tiroir recouvre la page', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard-nolines.html'));
  await page.locator('#cmPanelBtn').click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.documentElement.style.marginRight)).toBe('');
});
