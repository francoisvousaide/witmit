// Étape 3 : statut nouveau / traité, compteur des restants, filtre, repères grisés.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');
const KEY = 'annotate_kiosque_v1';

test.describe('Statut (Kiosque)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, '.kpi-tile:nth-child(1) .kpi-value', 'Premier');
    await H.addPin(page, 'tbody tr:nth-child(2) td:nth-child(4)', 'Second');
    await page.waitForTimeout(1300);
  });

  test('marquer traité : item grisé, repères grisés, compteurs à jour, persistant ; rouvrir', async ({ page }) => {
    await expect(page.locator('#cmCount')).toHaveText('2');
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    await page.locator('.cm-panel-item').nth(0).locator('.st').click();
    await expect(page.locator('.cm-panel-item').nth(0)).toHaveClass(/cm-done/);
    await expect(page.locator('#cmCount')).toHaveText('1');                       // il reste 1 à traiter
    await expect(page.locator('#cmPanelCount')).toHaveText('2');
    await expect(page.locator('#cmPanelSub')).toContainText('1 restant(s) · 1 traité(s)');
    await expect(page.locator('#cmStatus')).toContainText('traité');
    let data = await H.stored(page, KEY);
    expect(data[0].status).toBe('traite');
    expect(data[0].doneAt).toBeTruthy();
    expect(data[1].status).toBeUndefined();
    // repères grisés sur la page (mode actif)
    await page.mouse.click(30, 600);
    await H.activate(page);
    await expect(page.locator('.cm-pin').nth(0)).toHaveClass(/cm-done/);
    await expect(page.locator('.cm-box-outline').nth(0)).toHaveClass(/cm-done/);
    await expect(page.locator('.cm-pin').nth(1)).not.toHaveClass(/cm-done/);
    // persistance
    await page.reload(); await H.activate(page);
    await expect(page.locator('.cm-pin').nth(0)).toHaveClass(/cm-done/);
    await expect(page.locator('#cmCount')).toHaveText('1');
    // rouvrir
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    await page.locator('.cm-panel-item').nth(0).locator('.st').click();
    await expect(page.locator('.cm-panel-item').nth(0)).not.toHaveClass(/cm-done/);
    await expect(page.locator('#cmCount')).toHaveText('2');
    data = await H.stored(page, KEY);
    expect(data[0].status).toBe('nouveau');
    expect(data[0].doneAt).toBeUndefined();
  });

  test('filtre « Masquer les traités » : liste et repères, mémorisé', async ({ page }) => {
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('.cm-hide-done')).toHaveCount(0); // rien de traité : pas de filtre proposé
    await page.locator('.cm-panel-item').nth(0).locator('.st').click();
    await page.locator('.cm-hide-done').click();
    await expect(page.locator('.cm-panel-item')).toHaveCount(1);
    await expect(page.locator('.cm-panel-item .txt')).toHaveText('Second');
    await expect(page.locator('.cm-hide-done')).toHaveText('Afficher les traités');
    await page.mouse.click(30, 600);
    await H.activate(page);
    await expect(page.locator('.cm-pin')).toHaveCount(1);
    await page.reload(); await H.deactivate(page).catch(() => {});
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('.cm-panel-item')).toHaveCount(1);              // préférence mémorisée
    await page.locator('.cm-hide-done').click();
    await expect(page.locator('.cm-panel-item')).toHaveCount(2);
    // tout traité + filtre → message
    await page.locator('.cm-panel-item').nth(1).locator('.st').click();
    await page.locator('.cm-hide-done').click();
    await expect(page.locator('.cm-panel-empty')).toContainText('Tout est traité');
  });

  test('le rapport texte mentionne les tickets traités', async ({ page }) => {
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    await page.locator('.cm-panel-item').nth(1).locator('.st').click();
    await page.locator('.cm-panel-foot button', { hasText: 'Copier' }).click();
    const txt = await page.evaluate(() => navigator.clipboard.readText());
    expect(txt).toMatch(/#1 \[.*\] — À classer\n/);
    expect(txt).toMatch(/#2 \[.*\] — À classer · TRAITÉ\n/);
  });

  test('suppression individuelle conservée, y compris d’un ticket traité', async ({ page }) => {
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    await page.locator('.cm-panel-item').nth(0).locator('.st').click();
    await page.locator('.cm-panel-item').nth(0).locator('.del').click();
    await expect(page.locator('.cm-panel-item')).toHaveCount(1);
    expect(await H.stored(page, KEY)).toHaveLength(1);
    await expect(page.locator('#cmPanelSub')).toContainText('1 restant(s)');
    await expect(page.locator('.cm-hide-done')).toHaveCount(0);
  });
});
