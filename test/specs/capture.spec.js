// Étape 5 : capture d'écran d'un encadré (html2canvas chargé à la demande), vignette, rapport, budget.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');
const KEY = 'annotate_kiosque_v1';

async function drawBox(page, selector, text) {
  const b = await H.visibleBox(page, selector);
  await H.drag(page, b.x - 6, b.y - 6, b.x + b.width + 6, b.y + b.height + 6);
  await page.locator('.cm-popup textarea').fill(text);
  await page.locator('.cm-popup textarea').press('Enter');
  return b;
}
async function waitShot(page, index = 0) {
  await expect.poll(async () => ((await H.stored(page, KEY))[index].shot || {}).dataUrl ? 'ok' : 'non', { timeout: 15000 }).toBe('ok');
  return (await H.stored(page, KEY))[index].shot;
}

test.describe('Capture (Kiosque)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
  });

  test('un encadré enregistré reçoit une capture JPEG réduite, visible dans la liste et en grand', async ({ page }) => {
    expect(await page.evaluate(() => !!window.html2canvas)).toBe(false); // pas chargée avant le premier encadré
    const b = await drawBox(page, '.kpi-row', 'Les trois tuiles');
    const shot = await waitShot(page);
    expect(shot.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(shot.width).toBeLessThanOrEqual(800);
    expect(Math.abs(shot.width / shot.height - (b.width + 12) / (b.height + 12))).toBeLessThan(0.1); // mêmes proportions
    expect(await page.evaluate(() => !!window.html2canvas)).toBe(true);
    await expect(page.locator('#cmStatus')).toContainText('Capture enregistrée');
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('.cm-panel-item img.cm-shot')).toBeVisible();
    await page.locator('.cm-panel-item img.cm-shot').click();
    await expect(page.locator('.cm-lightbox img')).toBeVisible();
    await page.locator('.cm-lightbox').click();
    await expect(page.locator('.cm-lightbox')).toHaveCount(0);
    // un clic simple (pastille) n'a pas de capture
    await page.mouse.click(30, 600); await H.activate(page);
    await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'clic');
    await page.waitForTimeout(400);
    expect((await H.stored(page, KEY))[1].shot).toBeUndefined();
  });

  test('la capture exclut nos calques, et est refaite si l’encadré est ajusté', async ({ page }) => {
    await drawBox(page, '.kpi-tile:nth-child(1)', 'tuile 1');
    const first = await waitShot(page);
    // image de la tuile : fond sombre (#313244), pas de trait orange de notre cadre
    const dark = await page.evaluate((url) => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, im.width, im.height).data; let orange = 0, n = 0; for (let i = 0; i < d.length; i += 16) { n++; if (d[i] > 200 && d[i + 1] > 90 && d[i + 1] < 170 && d[i + 2] < 60) orange++; } res({ orange, n }); }; im.src = url; }), first.dataUrl);
    expect(dark.orange / dark.n).toBeLessThan(0.01);
    // ajuster l'encadré via sa pastille → nouvelle capture, plus large
    await page.locator('.cm-pin').click();
    const h = await page.locator('.cm-handle-e').boundingBox();
    await H.drag(page, h.x + 4, h.y + 4, h.x + 4 + 300, h.y + 4);
    await page.locator('.cm-popup textarea').press('Enter');
    await expect.poll(async () => ((await H.stored(page, KEY))[0].shot || {}).at, { timeout: 15000 }).not.toBe(first.at);
    const second = (await H.stored(page, KEY))[0].shot;
    expect(second.width / second.height).toBeGreaterThan(first.width / first.height);
  });

  test('le rapport embarque l’image et la mentionne dans le JSON', async ({ page }) => {
    await drawBox(page, '.kpi-tile:nth-child(2)', 'tuile 2');
    await waitShot(page);
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    page.once('dialog', (d) => d.dismiss());
    await page.locator('.cm-panel-foot button', { hasText: 'Copier' }).click();
    const md = await page.evaluate(() => navigator.clipboard.readText());
    expect(md).toContain('![Capture de la zone](data:image/jpeg;base64,');
    expect(md).toMatch(/"capture": "image ci-dessus \(\d+×\d+\)"/);
  });

  test('budget d’images : les plus anciennes sont retirées, les tickets restent', async ({ page }) => {
    const big = 'data:image/jpeg;base64,' + 'A'.repeat(1.6 * 1024 * 1024);
    await page.evaluate(([k, big]) => {
      const mk = (i) => ({ id: 'old' + i, type: 'box', status: 'nouveau', page: 'generic-dashboard.html', zone: 'z' + i, text: 't' + i, date: '2026-09-0' + i + 'T10:00:00.000Z', anchor: { path: null, relX: 0.1, relY: 0.1, relW: 0.1, relH: 0.1 }, fallback: { x: 10, y: 10, w: 40, h: 40 }, shot: { dataUrl: big, width: 800, height: 400, at: '2026-09-0' + i + 'T10:00:00.000Z' } });
      localStorage.setItem(k, JSON.stringify([mk(1), mk(2)]));
    }, [KEY, big]);
    await page.reload(); await H.activate(page);
    await drawBox(page, '.kpi-tile:nth-child(3)', 'tuile 3');
    await waitShot(page, 2);
    const data = await H.stored(page, KEY);
    expect(data).toHaveLength(3);                       // aucun ticket perdu
    expect(data[0].shot.dropped).toBe(true);            // la plus ancienne image retirée
    expect(data[0].shot.dataUrl).toBeUndefined();
    expect(data[1].shot.dataUrl).toBeTruthy();          // 1,6 Mo + la nouvelle ≤ 3 Mo
    expect(data[2].shot.dataUrl).toBeTruthy();
  });
});

test('data-capture="false" : pas de capture, pas de chargement de bibliothèque', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard-nolines.html'));
  await H.clearStorage(page); await page.reload(); await H.activate(page);
  await drawBox(page, '.kpi-tile:nth-child(1)', 'sans capture');
  await page.waitForTimeout(600);
  expect((await H.stored(page, KEY))[0].shot).toBeUndefined();
  expect(await page.evaluate(() => !!window.html2canvas)).toBe(false);
});
