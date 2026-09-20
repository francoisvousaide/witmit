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

// La bulle ne recouvre jamais ce qu'elle commente, quel que soit le type et la place à l'écran.
function overlap(a, b) { return !(a.x + a.width <= b.x || a.x >= b.x + b.width || a.y + a.height <= b.y || a.y >= b.y + b.height); }

test.describe('Placement de la bulle (Kiosque)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
  });

  test('texte sélectionné : la bulle est à côté du surlignage, pas dessus', async ({ page }) => {
    const b = await H.visibleBox(page, 'tbody tr:first-child td:nth-child(2)');
    await page.mouse.dblclick(b.x + 12, b.y + b.height / 2);
    const mark = await page.locator('mark.cm-highlight').boundingBox();
    const pop = await page.locator('.cm-popup').boundingBox();
    expect(overlap(pop, mark)).toBe(false);
    expect(pop.y).toBeGreaterThan(mark.y + mark.height); // ici : dessous
  });

  test('clic sur un élément : la bulle ne recouvre pas son cadre', async ({ page }) => {
    const b = await H.visibleBox(page, '.kpi-tile:nth-child(2) .kpi-value');
    await page.mouse.click(b.x + 5, b.y + 5);
    const frame = await page.locator('.cm-box-editing').boundingBox();
    const pop = await page.locator('.cm-popup').boundingBox();
    expect(overlap(pop, frame)).toBe(false);
  });

  test('encadré : la bulle ne recouvre pas l’encadré, réouverture comprise', async ({ page }) => {
    const t = await H.visibleBox(page, '.kpi-tile:nth-child(3)');
    await H.drag(page, t.x - 4, t.y - 4, t.x + t.width + 4, t.y + t.height + 4);
    let box = await page.locator('.cm-box-editable').boundingBox();
    let pop = await page.locator('.cm-popup').boundingBox();
    expect(overlap(pop, box)).toBe(false);
    await page.locator('.cm-popup textarea').fill('x');
    await page.locator('.cm-popup textarea').press('Enter');
    await page.locator('.cm-pin').click();
    box = await page.locator('.cm-box-editable').boundingBox();
    pop = await page.locator('.cm-popup').boundingBox();
    expect(overlap(pop, box)).toBe(false);
  });

  test('cible en bas de l’écran : la bulle passe au-dessus et reste visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 520 });
    const b = await H.visibleBox(page, 'tbody tr:nth-child(3) td:nth-child(2)'); // dernière ligne, près du bas
    await page.mouse.click(b.x + 5, b.y + 5);
    const frame = await page.locator('.cm-box-editing').boundingBox();
    const pop = await page.locator('.cm-popup').boundingBox();
    expect(overlap(pop, frame)).toBe(false);
    expect(pop.y + pop.height).toBeLessThanOrEqual(520);
    expect(pop.y).toBeGreaterThanOrEqual(0);
  });
});
