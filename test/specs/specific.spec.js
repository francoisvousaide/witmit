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
    await expect(page.locator('#cmPanelSub')).toContainText('1 à suivre'); // toujours enregistré (nombre « à suivre », Léa 2.1)
    await expect(page.locator('#cmCount')).toHaveAttribute('data-zero', '1');  // voyant éteint : l'équipe n'a rien écrit (C5)
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

test('TellUs : le widget prend le thème de la page hôte (V2)', async ({ page }) => {
  await page.goto(H.fileUrl('tellus-accueil.html'));
  await H.clearStorage(page); await page.reload();
  await expect.poll(() => page.getAttribute('body', 'data-wm-theme')).toBe('client-clair');
  await page.locator('#themeBtn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.getAttribute('body', 'data-wm-theme')).toBe('client-sombre');
  await H.activate(page);
  await H.addPin(page, '.mcard.active .mcard-title', 'Sombre');
  await page.locator('.cm-pin').click();
  // La matière est portée par la couche de verre (habiller, F2) : titane sombre à 70 % (client-sombre) sur un site sombre.
  const bg = await page.locator('.cm-popup .wm-verre').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgba(27, 27, 27, 0.7)');
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
  await expect(page.locator('#cmPanelSub')).toHaveText('1 à suivre — 2 retours sur 2 pages du site');
  await expect(page.locator('.cm-panel-item')).toHaveCount(1); // la liste ne montre que la page courante
  page.once('dialog', (d) => d.dismiss());
  await page.locator('.cm-panel-foot button', { hasText: 'Copier' }).click();
  const txt = await page.evaluate(() => navigator.clipboard.readText());
  expect(txt).toContain('## Page : ');
  expect(txt).toContain('### #1 · ');
  expect(txt).toContain('### #2 · '); // numérotation continue sur tout le site
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanelSub')).toBeHidden();             // aucun retour sur ce site : pas de ligne de compte
});

test('Charger le script deux fois n’installe le widget qu’une fois', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await page.addScriptTag({ path: require('path').resolve(__dirname, '../../src/witmit.js') });
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
  await page.locator('.cm-panel-foot button', { hasText: 'envoyer par email' }).click();
  await expect(page.locator('#cmStatus')).toContainText("aucune adresse d'envoi prévue pour ce site : utilise « télécharger » ou « copier ».");
});
