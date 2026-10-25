// Accessibilité de ce que witmit dessine (WCAG 4.1.2, 2.5.8 ; textes de Léa 3.1 à 3.3, décisions 46 et 47).
// Lot 3 : les deux boutons, le voyant, les zones cliquables, Échap, la touche « nouveau retour ».
// Lot 4 : test 11 (largeur de la fenêtre de saisie). Les tests 4 et 7 à 10 (focus, taille de texte, émojis, contraste,
// toasts) et la partie « tiroir » du test 11 viennent aux lots suivants.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const MAQUETTE = 'generic-dashboard.html';
const CIBLE = 'tbody tr:first-child td:nth-child(2)';
const CIBLE2 = 'tbody tr:nth-child(2) td:nth-child(2)';

test.beforeEach(async ({ page }) => {
  await page.goto(H.fileUrl(MAQUETTE));
  await H.clearStorage(page);
  await page.reload();
});

test('1. boutons : nom, état et raccourci ; le bouton du mode suit le mode quel que soit le geste', async ({ page }) => {
  const witmit = page.locator('#cmPanelBtn'), mode = page.locator('#cmToggleBtn');
  // Bouton witmit : « witmit » ; avec du nouveau, « witmit, 2 nouveaux retours » ; aria-expanded, plus d'aria-pressed.
  await expect(witmit).toHaveAccessibleName('witmit');
  await expect(witmit).toHaveAttribute('aria-expanded', 'false');
  await expect(witmit).toHaveAttribute('aria-controls', 'cmPanel');
  await expect(witmit).not.toHaveAttribute('aria-pressed', /.*/);
  // (déclencheur provisoire du voyant jusqu'au lot 5 : les retours encore à suivre sur la page)
  await H.activate(page);
  await H.addPin(page, CIBLE, 'Premier');
  await expect(witmit).toHaveAccessibleName('witmit, 1 nouveau retour');
  await H.addPin(page, CIBLE2, 'Second');
  await expect(witmit).toHaveAccessibleName('witmit, 2 nouveaux retours');
  await H.deactivate(page);
  await witmit.click();
  await expect(witmit).toHaveAttribute('aria-expanded', 'true');
  await witmit.click();
  await expect(witmit).toHaveAttribute('aria-expanded', 'false');
  await expect(witmit).not.toHaveAttribute('aria-pressed', /.*/);
  // Bouton du mode : nom fixe, état en aria-pressed, raccourci annoncé.
  await expect(mode).toHaveAccessibleName('mode annotation');
  await expect(mode).toHaveAttribute('aria-keyshortcuts', 'Alt+A');
  const etat = (v) => expect(mode).toHaveAttribute('aria-pressed', v);
  await etat('false');
  await mode.click(); await etat('true');                              // bouton
  await expect(mode).toHaveAccessibleName('mode annotation');          // le nom ne change pas avec l'état
  await mode.click(); await etat('false');
  await page.keyboard.press(H.ANNOTER); await etat('true');            // ⌥+A
  await page.keyboard.press('Escape'); await etat('false');            // Échap
  await witmit.click(); await page.keyboard.press('n'); await etat('true');   // N
  await page.locator('#cmPill .wm-touche', { hasText: /terminer/i }).click(); await etat('false');   // « terminer »
  await witmit.click();
  await page.locator('.cm-panel-item .body').first().click(); await etat('true');   // clic sur une ligne de la liste
});

test('2. voyant : visible seulement s’il y a du nouveau', async ({ page }) => {
  const voyant = page.locator('#cmPanelBtn #cmCount');
  await expect(voyant).toBeHidden();
  // (déclencheur provisoire jusqu'au lot 5 : les retours encore à suivre sur la page)
  await H.activate(page);
  await H.addPin(page, CIBLE, 'Du nouveau');
  await expect(voyant).toBeVisible();
  const b = await voyant.boundingBox();
  expect([b.width, b.height]).toEqual([7, 7]);
});

test('3. zones d’au moins 44 × 44 px : bouton witmit, bouton du mode, croix et icônes seules', async ({ page }) => {
  // Bouton witmit : 52 px dessinés, zone comprise.
  const w = await page.locator('#cmPanelBtn').boundingBox();
  expect([w.width, w.height]).toEqual([52, 52]);
  // Bouton du mode : 40 px dessinés, 44 px cliquables (::before) ; à 21 px du centre, le clic le touche encore.
  const m = await page.locator('#cmToggleBtn').evaluate((el) => {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const touche = (x, y) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('#cmToggleBtn')); };
    return { w: r.width, h: r.height, gauche: touche(cx - 21, cy), haut: touche(cx, cy - 21), bas: touche(cx, cy + 21), loin: touche(cx - 24, cy) };
  });
  expect(m).toEqual({ w: 40, h: 40, gauche: true, haut: true, bas: true, loin: false });
  // Les zones des deux boutons ne se chevauchent pas : 8 px entre les contours.
  const t = await page.locator('#cmToggleBtn').boundingBox();
  expect(Math.round(w.x - (t.x + t.width))).toBe(8);
  expect(Math.round(t.y + t.height / 2)).toBe(Math.round(w.y + w.height / 2));
  // Croix de la liste et icônes seules (cercles de 30 px) : zone de 44 px par ::before.
  await page.locator('#cmPanelBtn').click();
  await H.activate(page);
  await H.addPin(page, CIBLE, 'Retour');
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await page.waitForTimeout(400);                                       // fin du glissement de la liste
  const cercles = await page.evaluate(() => Array.from(document.querySelectorAll('#cmPanel .wm-cercle')).filter((el) => el.offsetParent).map((el) => {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const e = document.elementFromPoint(cx + 21, cy);
    return { nom: el.getAttribute('aria-label'), touche: !!(e && (e === el || el.contains(e))) };
  }));
  expect(cercles.length).toBeGreaterThan(1);
  for (const c of cercles) expect(c.touche, c.nom).toBe(true);
});

test('5. Échap : la fenêtre, puis la liste, puis le mode ; à la fin, les deux boutons relâchés', async ({ page }) => {
  await H.activate(page);
  const box = await H.visibleBox(page, CIBLE);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.cm-popup')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.cm-popup')).toHaveCount(0);
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await page.locator('#cmPanelBtn').click();                          // le mode continue
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  await expect(page.locator('#cmToggleBtn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#cmPanelBtn')).toHaveAttribute('aria-expanded', 'false');
});

test('6. touche « nouveau retour » : raccourci N annoncé ; elle ferme la liste et lance le mode', async ({ page }) => {
  await page.locator('#cmPanelBtn').click();
  const nouveau = page.locator('#cmNewBtn');
  await expect(nouveau).toHaveAttribute('aria-keyshortcuts', 'N');
  await expect(nouveau).toHaveAccessibleName('nouveau retour');
  await nouveau.click();
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await expect(page.locator('#cmToggleBtn')).toHaveAttribute('aria-pressed', 'true');
});

// ---------- Lot 4 : largeur de la fenêtre de saisie (M1). Le tiroir pleine largeur vient au lot 5. ----------

test('11. largeurs : à 375 px, la fenêtre de saisie tient dans l’écran, catégories dépliées comprises', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const [nom, cible] of [[MAQUETTE, CIBLE], [MAQUETTE, '.kpi-tile:nth-child(3) .kpi-value'], ['tellus-accueil.html', '.mcard.active .mcard-title']]) {
    await page.goto(H.fileUrl(nom));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    const b = await H.visibleBox(page, cible);
    await page.mouse.click(b.x + 4, b.y + 4);
    await expect(page.locator('.cm-popup')).toBeVisible();
    await page.locator('.cm-popup .cm-cat').click();
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const p = document.querySelector('.cm-popup').getBoundingClientRect();
      const dedans = Array.from(document.querySelectorAll('.cm-popup .cm-tete, .cm-popup .cm-corps > *, .cm-popup .cm-cat-choix, .cm-popup .cm-save'))
        .every((el) => { const q = el.getBoundingClientRect(); return !q.width || (q.left >= p.left - 0.5 && q.right <= p.right + 0.5); });
      return { vw, left: p.left, right: p.right, width: p.width, dedans };
    });
    expect(r.left, `${nom} ${cible}`).toBeGreaterThanOrEqual(8);
    expect(r.right, `${nom} ${cible}`).toBeLessThanOrEqual(r.vw - 8 + 0.5);
    expect(r.width, `${nom} ${cible}`).toBeGreaterThan(300);
    expect(r.dedans, `${nom} ${cible}`).toBe(true);
    await page.keyboard.press('Escape');
  }
  // Sur ordinateur, la fenêtre fait 380 px.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(H.fileUrl(MAQUETTE));
  await H.activate(page);
  const b = await H.visibleBox(page, CIBLE);
  await page.mouse.click(b.x + 4, b.y + 4);
  expect((await page.locator('.cm-popup').boundingBox()).width).toBe(380);
});
