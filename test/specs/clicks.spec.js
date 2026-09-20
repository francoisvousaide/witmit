// Double-clic = mot, triple-clic = paragraphe ; variante avec délai avant la bulle du clic simple.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');
const KEY = 'annotate_kiosque_v1';

test.describe('Double et triple clic (Kiosque)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
  });

  test('double-clic sur un mot → ce mot surligné, accents compris', async ({ page }) => {
    const b = await H.visibleBox(page, 'tbody tr:nth-child(3) td:nth-child(2)'); // "Épicerie Lila"
    await page.mouse.dblclick(b.x + 12, b.y + b.height / 2);
    await expect(page.locator('.cm-popup .cm-zone')).toHaveText('✏️ « Épicerie »');
    await expect(page.locator('mark.cm-highlight')).toHaveText('Épicerie');
    await page.locator('.cm-popup textarea').fill('mot');
    await page.locator('.cm-popup textarea').press('Enter');
    const data = await H.stored(page, KEY);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ type: 'text', quote: 'Épicerie' });
  });

  test('triple-clic → tout le paragraphe (ici la cellule)', async ({ page }) => {
    const b = await H.visibleBox(page, 'tbody tr:nth-child(3) td:nth-child(2)');
    await page.mouse.click(b.x + 12, b.y + b.height / 2, { clickCount: 3 });
    await expect(page.locator('.cm-popup .cm-zone')).toHaveText('✏️ « Épicerie Lila »');
    await page.locator('.cm-popup textarea').fill('cellule');
    await page.locator('.cm-popup textarea').press('Enter');
    expect((await H.stored(page, KEY))[0].quote).toBe('Épicerie Lila');
  });

  test('double-clic sur un espace ou hors texte → comportement du clic simple', async ({ page }) => {
    const b = await H.visibleBox(page, '.kpi-tile:first-child');
    await page.mouse.dblclick(b.x + b.width - 6, b.y + b.height - 6); // marge de la tuile
    await expect(page.locator('.cm-popup .cm-zone')).toHaveText('📍 Chiffre du jour');
  });
});

test.describe('Variante délai 250 ms', () => {
  test('clic simple : la bulle attend ~250 ms ; double-clic : pas de bulle intermédiaire', async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard-delai250.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    const b = await H.visibleBox(page, 'tbody tr:nth-child(1) td:nth-child(2)');
    await page.mouse.click(b.x + 12, b.y + b.height / 2);
    await page.waitForTimeout(80);
    await expect(page.locator('.cm-popup')).toHaveCount(0);
    await expect(page.locator('.cm-popup')).toBeVisible({ timeout: 1000 });
    await page.keyboard.press('Escape');
    // double-clic : on surveille qu'aucune bulle "📍" n'apparaisse avant la bulle "✏️"
    const seen = [];
    await page.exposeFunction('cmSeen', (t) => seen.push(t));
    await page.evaluate(() => new MutationObserver(() => { const z = document.querySelector('.cm-popup .cm-zone'); if (z) window.cmSeen(z.textContent.slice(0, 2)); }).observe(document.body, { childList: true, subtree: true }));
    await page.mouse.dblclick(b.x + 12, b.y + b.height / 2);
    await expect(page.locator('.cm-popup .cm-zone')).toHaveText('✏️ « Boulangerie »');
    await page.waitForTimeout(400);
    expect(seen.filter((t) => t.startsWith('📍'))).toHaveLength(0);
  });
});
