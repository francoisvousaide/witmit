// Mode live (data-mode="live") : le widget est invisible par défaut sur un site en production. 0.4.0 (R27, f1) : ⌥+A
// (alt+A) ou ?witmit=on le montre (mémorisé), ⌥+A ou ?witmit=off le cache (oublié) ; ⌥ deux fois l'ouvre le temps d'un
// retour, sans rien mémoriser. « masquer witmit » a quitté la liste.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const PAGE = 'generic-dashboard-live.html';
const REVEAL_KEY = 'witmit_kiosque-live_reveal';
const revealed = (page) => page.evaluate((k) => localStorage.getItem(k), REVEAL_KEY);

test.beforeEach(async ({ page }) => {
  await page.goto(H.fileUrl(PAGE));
  await H.clearStorage(page);
  await page.reload();
});

test('1. caché par défaut : interface injectée mais aucune couche visible', async ({ page }) => {
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await expect(page.locator('#cmPanelBtn')).toHaveCount(1);
  await expect(page.locator('#cmPanelBtn')).toBeHidden();
  await expect(page.locator('.cm-fab')).toBeHidden();
  expect(await revealed(page)).toBeNull();
});

test('2. ⌥+A montre witmit : le bouton seul, liste fermée, mode éteint ; mémorisé', async ({ page }) => {
  await page.keyboard.press(H.CACHER);
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await expect(page.locator('#cmPanelBtn')).toBeVisible();
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  expect(await revealed(page)).toBe('1');
  // Après rechargement, il reste visible (mémorisé), toujours replié
  await page.reload();
  await expect(page.locator('#cmPanelBtn')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
});

test('3. ⌥ deux fois et ⌥+A ignorés pendant la saisie dans un champ : le widget reste caché', async ({ page }) => {
  await page.locator('#tabBtnForm').click();
  const input = page.locator('input[type="text"], input:not([type]), textarea').first();
  await input.click();
  await H.doubleAlt(page);
  await page.keyboard.press(H.CACHER);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
});

test('4. ?witmit=on révèle, mémorise et nettoie l’URL', async ({ page }) => {
  await page.goto(H.fileUrl(PAGE) + '?witmit=on&autre=1');
  await expect(page.locator('#cmPanelBtn')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  expect(await revealed(page)).toBe('1');
  expect(new URL(page.url()).search).toBe('?autre=1');
  await page.goto(H.fileUrl(PAGE));
  await expect(page.locator('#cmPanelBtn')).toBeVisible();
});

test('5. ⌥+A, witmit ouvert : cache, ferme tout et oublie ; plus de « masquer witmit » dans la liste', async ({ page }) => {
  await page.goto(H.fileUrl(PAGE) + '?witmit=on');
  await H.activate(page);
  await expect(page.locator('#cmHideBtn')).toHaveCount(0);
  await expect(page.locator('#cmPanel')).not.toContainText('masquer witmit');
  await page.keyboard.press(H.CACHER);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(page.locator('#cmPanelBtn')).toBeHidden();
  expect(await revealed(page)).toBeNull();
  await page.reload();
  await expect(page.locator('#cmPanelBtn')).toBeHidden();
});

test('6. ?witmit=off cache et oublie', async ({ page }) => {
  await page.goto(H.fileUrl(PAGE) + '?witmit=on');
  await expect(page.locator('#cmPanelBtn')).toBeVisible();
  await page.goto(H.fileUrl(PAGE) + '?witmit=off');
  await expect(page.locator('#cmPanelBtn')).toBeHidden();
  expect(await revealed(page)).toBeNull();
  expect(new URL(page.url()).search).toBe('');
});

test('7. les commentaires existants restent stockés mais invisibles tant que le widget est caché', async ({ page }) => {
  await page.goto(H.fileUrl(PAGE) + '?witmit=on');
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Ticket en mode live');
  await page.keyboard.press(H.CACHER);
  const data = await H.stored(page, 'witmit_kiosque-live_v1');
  expect(data).toHaveLength(1);
  await expect(page.locator('.cm-pin')).toBeHidden();
  await expect(page.locator('.cm-box-saved').first()).toBeHidden();
  // ⌥ deux fois : witmit apparaît et s'ouvre, le repère est de nouveau là
  await H.doubleAlt(page);
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await expect(page.locator('.cm-pin').first()).toBeVisible();
});

test('8. mode maquette (défaut) : montré par défaut ; ?witmit=off le cache aussi (0.4.0), ?witmit=on le rend', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page);
  await page.reload();
  await expect(page.locator('#cmPanelBtn')).toBeVisible();
  await page.goto(H.fileUrl('generic-dashboard.html') + '?witmit=off');
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await expect(page.locator('#cmPanelBtn')).toBeHidden();
  await page.goto(H.fileUrl('generic-dashboard.html') + '?witmit=on');
  await expect(page.locator('#cmPanelBtn')).toBeVisible();
});
