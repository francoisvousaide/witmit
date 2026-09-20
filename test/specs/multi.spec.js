// Sélection multiple : ⌘/Ctrl+clic ajoute/retire des éléments à un commentaire "élément".
const { test, expect } = require('@playwright/test');
const H = require('./helpers');
const KEY = 'annotate_kiosque_v1';

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
async function shiftClick(page, selector) { // ⌘+clic (Mac) / Ctrl+clic
  const b = await H.visibleBox(page, selector);
  await page.keyboard.down(MOD);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.keyboard.up(MOD);
}

test.describe('Sélection multiple (Kiosque)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
  });

  test('clic + ⌘/Ctrl+clic ×2 → un commentaire, 3 cadres, 1 pastille + 2 réduites, libellé groupé', async ({ page }) => {
    const b = await H.visibleBox(page, '.kpi-tile:nth-child(1) .kpi-value');
    await page.mouse.click(b.x + 5, b.y + 5);
    await expect(page.locator('.cm-popup')).toBeVisible();
    await shiftClick(page, '.kpi-tile:nth-child(2) .kpi-value');
    await shiftClick(page, 'tbody tr:nth-child(2) td:nth-child(4)');
    await expect(page.locator('.cm-box-editing')).toHaveCount(3);
    await expect(page.locator('.cm-popup .cm-zone')).toHaveText('📍 3 éléments — 1 240 €, 37, En retard');
    await page.locator('.cm-popup textarea').fill('Ces trois chiffres doivent utiliser la même police');
    await page.locator('.cm-popup textarea').press('Enter');
    await expect(page.locator('.cm-box-outline')).toHaveCount(3);
    await expect(page.locator('.cm-pin:not(.cm-pin-secondary)')).toHaveCount(1);
    await expect(page.locator('.cm-pin.cm-pin-secondary')).toHaveCount(2);
    await expect(page.locator('.cm-pin.cm-pin-secondary').first()).toHaveText('1');
    const data = await H.stored(page, KEY);
    expect(data).toHaveLength(1);
    expect(data[0].zone).toBe('3 éléments — 1 240 €, 37, En retard');
    expect(data[0].targets).toHaveLength(3);
    expect(data[0].targets[2].label).toBe('En retard');
    await expect(page.locator('#cmLinks line')).toHaveCount(2); // lignes fines par défaut
  });

  test('⌘/Ctrl+clic sur un élément déjà sélectionné le retire ; on ne peut pas retirer le dernier', async ({ page }) => {
    const b = await H.visibleBox(page, '.kpi-tile:nth-child(1) .kpi-value');
    await page.mouse.click(b.x + 5, b.y + 5);
    await expect(page.locator('.cm-popup')).toBeVisible();
    await shiftClick(page, '.kpi-tile:nth-child(2) .kpi-value');
    await expect(page.locator('.cm-box-editing')).toHaveCount(2);
    await shiftClick(page, '.kpi-tile:nth-child(2) .kpi-value');
    await expect(page.locator('.cm-box-editing')).toHaveCount(1);
    await expect(page.locator('.cm-popup .cm-zone')).toHaveText('📍 1 240 €');
    await shiftClick(page, '.kpi-tile:nth-child(1) .kpi-value');
    await expect(page.locator('.cm-box-editing')).toHaveCount(1);
  });

  test('un groupe survit au rechargement, se rouvre avec ses cibles, et se modifie', async ({ page }) => {
    const b = await H.visibleBox(page, '.kpi-tile:nth-child(1) .kpi-value');
    await page.mouse.click(b.x + 5, b.y + 5);
    await expect(page.locator('.cm-popup')).toBeVisible();
    await shiftClick(page, '.kpi-tile:nth-child(2) .kpi-value');
    await page.locator('.cm-popup textarea').fill('groupe');
    await page.locator('.cm-popup textarea').press('Enter');
    await page.reload(); await H.activate(page);
    await expect(page.locator('.cm-box-outline')).toHaveCount(2);
    await expect(page.locator('.cm-pin')).toHaveCount(2);
    await page.locator('.cm-pin:not(.cm-pin-secondary)').click();
    await expect(page.locator('.cm-popup textarea')).toHaveValue('groupe');
    await expect(page.locator('.cm-box-editing')).toHaveCount(2);
    await shiftClick(page, '.kpi-tile:nth-child(3) .kpi-value');
    await page.locator('.cm-popup textarea').press('Enter');
    const data = await H.stored(page, KEY);
    expect(data[0].targets).toHaveLength(3);
    expect(data[0].zone).toBe('3 éléments — 1 240 €, 37, 33,5 €');
    await expect(page.locator('.cm-box-outline')).toHaveCount(3);
  });

  test('clic sur une pastille réduite, ou dans la liste : la bulle du groupe s’ouvre, tout le groupe passe en couleur active', async ({ page }) => {
    const b = await H.visibleBox(page, '.kpi-tile:nth-child(1) .kpi-value');
    await page.mouse.click(b.x + 5, b.y + 5);
    await expect(page.locator('.cm-popup')).toBeVisible();
    await shiftClick(page, '.kpi-tile:nth-child(2) .kpi-value');
    await page.locator('.cm-popup textarea').fill('groupe');
    await page.locator('.cm-popup textarea').press('Enter');
    await page.locator('.cm-pin.cm-pin-secondary').click();
    await expect(page.locator('.cm-popup textarea')).toHaveValue('groupe');
    await expect(page.locator('.cm-box-outline.cm-focus')).toHaveCount(2);
    await expect(page.locator('.cm-pin.cm-focus')).toHaveCount(2);
    await expect(page.locator('#cmLinks line.cm-focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.cm-focus')).toHaveCount(0);
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    await page.locator('.cm-panel-item .body').click();
    await expect(page.locator('.cm-popup textarea')).toHaveValue('groupe');
    await expect(page.locator('.cm-box-outline.cm-focus')).toHaveCount(2);
  });

  test('survol d’une pastille du groupe : tous ses cadres s’allument', async ({ page }) => {
    const b = await H.visibleBox(page, '.kpi-tile:nth-child(1) .kpi-value');
    await page.mouse.click(b.x + 5, b.y + 5);
    await expect(page.locator('.cm-popup')).toBeVisible();
    await shiftClick(page, '.kpi-tile:nth-child(2) .kpi-value');
    await page.locator('.cm-popup textarea').fill('g');
    await page.locator('.cm-popup textarea').press('Enter');
    await page.locator('.cm-pin.cm-pin-secondary').hover();
    await expect(page.locator('.cm-box-outline.cm-glow')).toHaveCount(2);
    await page.mouse.move(600, 600);
    await expect(page.locator('.cm-box-outline.cm-glow')).toHaveCount(0);
  });

  test('un élément du groupe dans un onglet masqué : les autres restent affichés', async ({ page }) => {
    const b = await H.visibleBox(page, '.kpi-tile:nth-child(1) .kpi-value');
    await page.mouse.click(b.x + 5, b.y + 5);
    await expect(page.locator('.cm-popup')).toBeVisible();
    await shiftClick(page, 'tbody tr:nth-child(2) td:nth-child(4)');
    await page.locator('.cm-popup textarea').fill('g');
    await page.locator('.cm-popup textarea').press('Enter');
    await H.deactivate(page);
    await page.locator('#tabBtnForm').click();
    await H.activate(page);
    await expect(page.locator('.cm-box-outline')).toHaveCount(1);
    await expect(page.locator('.cm-pin')).toHaveCount(1);
  });
});

test('data-multi-lines="false" : pas de lignes', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard-nolines.html'));
  await H.clearStorage(page);
  await page.reload(); await H.activate(page);
  const b = await H.visibleBox(page, '.kpi-tile:nth-child(1) .kpi-value');
  await page.mouse.click(b.x + 5, b.y + 5);
  await expect(page.locator('.cm-popup')).toBeVisible();
  await shiftClick(page, '.kpi-tile:nth-child(3) .kpi-value');
  await page.locator('.cm-popup textarea').fill('g');
  await page.locator('.cm-popup textarea').press('Enter');
  await expect(page.locator('.cm-pin')).toHaveCount(2);
  await expect(page.locator('#cmLinks')).toHaveCount(0);
});
