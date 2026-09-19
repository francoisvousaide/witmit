// Petites fonctions partagées par les tests — toutes passent par de VRAIES actions souris/clavier.
const path = require('path');
const { expect } = require('@playwright/test');

const PAGES_DIR = path.resolve(__dirname, '..', 'pages');
const fileUrl = (name) => 'file://' + path.join(PAGES_DIR, name);

const IS_MAC = process.platform === 'darwin';
const SHORTCUT = IS_MAC ? 'Alt+Shift+KeyC' : 'Alt+KeyC';

async function clearStorage(page) {
  await page.evaluate(() => localStorage.clear());
}
async function stored(page, key) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), key);
}
async function activate(page) {
  await page.locator('#cmToggleBtn').click();
  await expect(page.locator('body')).toHaveClass(/cm-active/);
}
async function deactivate(page) {
  await page.locator('#cmToggleBtn').click();
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
}
// Clic au centre d'un élément (mode actif), saisie du texte, Entrée pour enregistrer.
async function addPin(page, selector, text) {
  const box = await visibleBox(page, selector);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const ta = page.locator('.cm-popup textarea');
  await expect(ta).toBeVisible();
  await ta.fill(text);
  await ta.press('Enter');
  await expect(page.locator('.cm-popup')).toHaveCount(0);
}
// Fait défiler jusqu'à l'élément (s'il est hors écran) et renvoie sa position à l'écran.
async function visibleBox(page, selector) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  return el.boundingBox();
}
// Glisser de (x1,y1) à (x2,y2) avec la souris — éventuellement Maj enfoncée.
async function drag(page, x1, y1, x2, y2, { shift = false } = {}) {
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 10 });
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
}

module.exports = { fileUrl, visibleBox, IS_MAC, SHORTCUT, clearStorage, stored, activate, deactivate, addPin, drag };
