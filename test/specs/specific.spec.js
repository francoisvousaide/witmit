// Tests propres à certaines pages : étapes/onglets masqués, thème sombre, rapport multi-pages, double chargement.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

test.describe('Étapes et onglets masqués', () => {
  test('Proposer : la pastille d’une étape masquée disparaît puis revient', async ({ page }) => {
    await page.goto(H.fileUrl('tellus-proposer.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, '#stepPanel1 .fcard-title', 'Étape 1');
    await H.deactivate(page);
    await page.locator('.pdot[data-step="2"]').click();
    await expect(page.locator('#stepPanel2')).toBeVisible();
    await expect(page.locator('.cm-pin')).toHaveCount(0);
    await expect(page.locator('#cmCount')).toHaveText('1'); // toujours enregistré
    await page.locator('.pdot[data-step="1"]').click();
    await expect(page.locator('.cm-pin')).toHaveCount(1);
  });

  test('Kiosque : idem avec des onglets', async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, 'tbody tr:nth-child(2) td:nth-child(2)', 'Client en retard');
    await H.deactivate(page);
    await page.locator('#tabBtnForm').click();
    await expect(page.locator('.cm-pin')).toHaveCount(0);
    await page.locator('#tabBtnOrders').click();
    await expect(page.locator('.cm-pin')).toHaveCount(1);
  });
});

test('TellUs : le widget suit le thème sombre de la page hôte', async ({ page }) => {
  await page.goto(H.fileUrl('tellus-accueil.html'));
  await H.clearStorage(page); await page.reload();
  await page.locator('#themeBtn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await H.activate(page);
  await H.addPin(page, '.mcard.active .mcard-title', 'Sombre');
  await page.locator('.cm-pin').click();
  const bg = await page.locator('.cm-popup').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(21, 42, 49)'); // --surface sombre de TellUs
});

test('Rapport site-large : deux pages TellUs partagent le rapport, Kiosque non', async ({ page }) => {
  await page.goto(H.fileUrl('tellus-accueil.html'));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  await H.addPin(page, '.mcard.active .mcard-title', 'Depuis accueil');
  await page.goto(H.fileUrl('tellus-proposer.html'));
  await H.activate(page);
  await H.addPin(page, '#stepPanel1 .fcard-title', 'Depuis proposer');
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanelSub')).toHaveText('2 au total sur 2 page(s) du site');
  await expect(page.locator('.cm-panel-item')).toHaveCount(1); // la liste ne montre que la page courante
  await page.locator('.cm-panel-foot button', { hasText: 'Copier' }).click();
  const txt = await page.evaluate(() => navigator.clipboard.readText());
  expect(txt).toContain('=== ');
  expect(txt).toContain('#1 [');
  expect(txt).toContain('#2 ['); // numérotation continue sur tout le site
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanelSub')).toHaveText('0 au total sur 0 page(s) du site');
});

test('Charger le script deux fois n’installe le widget qu’une fois', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await page.addScriptTag({ path: require('path').resolve(__dirname, '../../src/annotate.js') });
  await expect(page.locator('#cmPill')).toHaveCount(1);
  await expect(page.locator('#cmToggleBtn')).toHaveCount(1);
});

test('Sans data-email, « Envoyer » explique quoi faire au lieu d’ouvrir un mail vide', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'x');
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await page.locator('.cm-panel-foot button', { hasText: 'Envoyer' }).click();
  await expect(page.locator('#cmStatus')).toContainText('data-email');
});
