// Mode live (data-mode="live") : le widget est invisible par défaut sur un site en production,
// révélé par Alt+A ou ?witmit=on (mémorisé), re-caché par le bouton du tiroir ou ?witmit=off.
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
  await expect(page.locator('#cmToggleBtn')).toHaveCount(1);
  await expect(page.locator('#cmToggleBtn')).toBeHidden();
  await expect(page.locator('#cmPanelBtn')).toBeHidden();
  await expect(page.locator('.cm-fab')).toBeHidden();
  expect(await revealed(page)).toBeNull();
});

test('2. Alt+A révèle le widget, entre en mode annotation et mémorise', async ({ page }) => {
  await page.keyboard.press(H.SHORTCUT);
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await expect(page.locator('#cmToggleBtn')).toBeVisible();
  expect(await revealed(page)).toBe('1');
  // Après rechargement, il reste visible (mémorisé) mais pas en mode annotation
  await page.reload();
  await expect(page.locator('#cmToggleBtn')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
});

test('3. Alt+A ignoré pendant la saisie dans un champ : le widget reste caché', async ({ page }) => {
  await page.locator('#tabBtnForm').click();
  const input = page.locator('input[type="text"], input:not([type]), textarea').first();
  await input.click();
  await page.keyboard.press(H.SHORTCUT);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
});

test('4. ?witmit=on révèle, mémorise et nettoie l’URL', async ({ page }) => {
  await page.goto(H.fileUrl(PAGE) + '?witmit=on&autre=1');
  await expect(page.locator('#cmToggleBtn')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  expect(await revealed(page)).toBe('1');
  expect(new URL(page.url()).search).toBe('?autre=1');
  await page.goto(H.fileUrl(PAGE));
  await expect(page.locator('#cmToggleBtn')).toBeVisible();
});

test('5. bouton « Masquer witmit » du tiroir : cache, ferme tout et oublie', async ({ page }) => {
  await page.goto(H.fileUrl(PAGE) + '?witmit=on');
  await H.activate(page);
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  const hideBtn = page.locator('#cmHideBtn');
  await expect(hideBtn).toBeVisible();
  await hideBtn.click();
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(page.locator('#cmToggleBtn')).toBeHidden();
  expect(await revealed(page)).toBeNull();
  await page.reload();
  await expect(page.locator('#cmToggleBtn')).toBeHidden();
});

test('6. ?witmit=off cache et oublie', async ({ page }) => {
  await page.goto(H.fileUrl(PAGE) + '?witmit=on');
  await expect(page.locator('#cmToggleBtn')).toBeVisible();
  await page.goto(H.fileUrl(PAGE) + '?witmit=off');
  await expect(page.locator('#cmToggleBtn')).toBeHidden();
  expect(await revealed(page)).toBeNull();
  expect(new URL(page.url()).search).toBe('');
});

test('7. les commentaires existants restent stockés mais invisibles tant que le widget est caché', async ({ page }) => {
  await page.goto(H.fileUrl(PAGE) + '?witmit=on');
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Ticket en mode live');
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await page.locator('#cmHideBtn').click();
  const data = await H.stored(page, 'witmit_kiosque-live_v1');
  expect(data).toHaveLength(1);
  await expect(page.locator('.cm-pin')).toBeHidden();
  await expect(page.locator('.cm-box-saved').first()).toBeHidden();
  // Re-révélé : le repère est de nouveau là
  await page.keyboard.press(H.SHORTCUT);
  await expect(page.locator('.cm-pin').first()).toBeVisible();
});

test('8. mode mock (défaut) : bouton « Masquer » absent, aucun effet de ?witmit=off', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html') + '?witmit=off');
  await expect(page.locator('#cmToggleBtn')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmHideBtn')).toBeHidden();
});
