// Accessibilité de ce que witmit dessine (WCAG 4.1.2, 2.5.8 ; textes de Léa 3.1 à 3.3, décisions 46 et 47).
// Lot 3 : les deux boutons, le voyant, les zones cliquables, Échap, la touche « nouveau retour ».
// Lot 4 : test 11 (largeur de la fenêtre de saisie). Lot 5 : tests 1 et 2 sur la règle du voyant (C5), 5b (visionneuse),
// partie « tiroir » du test 11. Lot 7 : test 10 (messages passagers). Lot 8 : tests 4, 7, 8 et 9 (focus, taille de texte,
// émojis, contraste) sur toute l'interface, maquette et live.
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
  // Voyant (C5) : des retours tout juste écrits n'ont rien de nouveau ; l'équipe qui change leur statut, si.
  await H.activate(page);
  await H.addPin(page, CIBLE, 'Premier');
  await H.addPin(page, CIBLE2, 'Second');
  await expect(witmit).toHaveAccessibleName('witmit');
  await H.deactivate(page);
  const [a, b] = await H.stored(page, 'witmit_kiosque_v1');
  await H.retourColle(page, [a.id + ' pris_en_compte']);
  await expect(witmit).toHaveAccessibleName('witmit, 1 nouveau retour');
  await H.retourColle(page, [b.id + ' complement | Laquelle ?']);
  await expect(witmit).toHaveAccessibleName('witmit, 2 nouveaux retours');
  await expect(witmit).toHaveAttribute('aria-expanded', 'true');
  await witmit.click();                                                // fermer la liste après l'avoir vue : plus rien de nouveau
  await expect(witmit).toHaveAttribute('aria-expanded', 'false');
  await expect(witmit).toHaveAccessibleName('witmit');
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

test('2. voyant : visible seulement s’il y a du nouveau ; un retour tout juste écrit ne l’allume pas ; éteint après lecture', async ({ page }) => {
  const voyant = page.locator('#cmPanelBtn #cmCount');
  await expect(voyant).toBeHidden();
  await H.activate(page);
  await H.addPin(page, CIBLE, 'Écrit à l’instant');                   // condition de Léa : ce que la personne écrit n'allume rien
  await expect(voyant).toBeHidden();
  await H.deactivate(page);
  const [c] = await H.stored(page, 'witmit_kiosque_v1');
  await H.retourColle(page, [c.id + ' pris_en_compte | Vu, on regarde.']);
  await expect(voyant).toBeVisible();
  const b = await voyant.boundingBox();
  expect([b.width, b.height]).toEqual([7, 7]);
  // Sur la ligne : voyant et mot « nouveau » après le statut.
  await expect(page.locator('.cm-panel-item .cm-meta').first()).toContainText('pris en compte');
  await expect(page.locator('.cm-panel-item .cm-nouveau')).toHaveText('nouveau');
  await page.locator('#cmPanelBtn').click();                           // la liste se ferme : vu
  await expect(voyant).toBeHidden();
  await page.reload();
  await expect(voyant).toBeHidden();                                   // et ça reste vu
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('.cm-panel-item .cm-nouveau')).toHaveCount(0);
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
  // Épingle (F6) : 24 px dessinés, zone de 44 px par un ::after transparent ; à 10 px hors du dessin (9,5 px, pour
  // rester dans la zone malgré les positions au demi-pixel), le clic la touche encore ; à 14 px, plus.
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await page.waitForTimeout(400);
  const e = await page.locator('.cm-pin').first().evaluate((el) => {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const touche = (x, y) => { const t = document.elementFromPoint(x, y); return !!(t && t.closest('.cm-pin') === el); };
    return { w: r.width, h: r.height, gauche: touche(r.left - 9.5, cy), droite: touche(r.right + 9.5, cy), haut: touche(cx, r.top - 9.5), bas: touche(cx, r.bottom + 9.5), loin: touche(r.left - 14, cy) };
  });
  expect(e).toEqual({ w: 24, h: 24, gauche: true, droite: true, haut: true, bas: true, loin: false });
  // Bandeau (fiche Bandeau) : poignée de 20 × 44 px dans un bandeau qu'on attrape partout hors de sa touche (la zone
  // qu'on peut saisir fait donc au moins 44 × 44 px depuis la poignée) ; « terminer » : face de 32 px, zone de 44 px.
  const b = await page.evaluate(() => {
    const pill = document.getElementById('cmPill'), poignee = pill.querySelector('.wm-poignee'), fin = pill.querySelector('.wm-terminer');
    const rp = poignee.getBoundingClientRect(), rf = fin.getBoundingClientRect(), face = getComputedStyle(fin, '::before');
    const saisissable = (x, y) => { const el = document.elementFromPoint(x, y); return !!(el && pill.contains(el) && !el.closest('button')); };
    const touche = (x, y) => { const el = document.elementFromPoint(x, y); return !!(el && el.closest('.wm-terminer') === fin); };
    return {
      poignee: [rp.width, rp.height], saisie44: saisissable(rp.left + 1, rp.top + 1) && saisissable(rp.left + 43, rp.top + 1) && saisissable(rp.left + 1, rp.top + 43) && saisissable(rp.left + 43, rp.top + 43),
      terminer: rf.height, face: rf.height - parseFloat(face.top) - parseFloat(face.bottom), largeur: rf.width >= 44,
      haut: touche(rf.left + rf.width / 2, rf.top + 1), bas: touche(rf.left + rf.width / 2, rf.bottom - 1)
    };
  });
  expect(b).toEqual({ poignee: [20, 44], saisie44: true, terminer: 44, face: 32, largeur: true, haut: true, bas: true });
});

test('3b. bandeau : nom, gestes, « terminer » ; sur deux lignes à 760 px ; liste ouverte, il ne la recouvre pas', async ({ page }) => {
  await H.activate(page);
  const pill = page.locator('#cmPill');
  await expect(pill).toHaveAttribute('aria-label', 'witmit : mode annotation');
  await expect(pill.locator('.wm-bandeau-mode')).toHaveText('annotation');
  await expect(pill.locator('.wm-bandeau-mode .wm-voyant')).toHaveCount(1);       // le voyant jamais sans le mot
  const multi = H.IS_MAC ? 'cmd+clic : plusieurs' : 'ctrl+clic : plusieurs';
  await expect(pill.locator('.wm-gestes')).toHaveText('clic : élément · ' + multi + ' · glisser : zone · maj+glisser : texte');
  await expect(pill.locator('.wm-poignee')).toHaveAttribute('title', 'glisse pour déplacer le bandeau');
  await expect(pill.locator('.wm-terminer')).toHaveText('termineréchap');
  await expect(pill.locator('.wm-terminer')).toHaveAttribute('title', "terminer l'annotation · échap ou " + (H.IS_MAC ? '⌥+A' : 'alt+A'));
  // 1 280 px : une ligne de 44 px, centrée, à 12 px sous le haut (pas de barre de navigation sur cette page)
  const ecartAuCentre = () => page.evaluate(() => { const p = document.getElementById('cmPill').getBoundingClientRect(); return Math.round(Math.abs(p.left + p.width / 2 - document.documentElement.clientWidth / 2)); });
  await expect.poll(ecartAuCentre).toBeLessThanOrEqual(1);
  let r = await pill.boundingBox();
  expect(r.height).toBe(44);
  expect(r.y).toBe(12);
  // 760 px : deux lignes, chaque geste entier sur sa ligne (V2 : police système plus étroite, le bandeau tient sur une ligne à 900 px)
  await page.setViewportSize({ width: 760, height: 800 });
  await expect(pill).toHaveClass(/wm-deux-lignes/);
  r = await pill.boundingBox();
  expect(r.height).toBeGreaterThan(60);
  expect(r.x).toBeGreaterThanOrEqual(8);
  expect(r.x + r.width).toBeLessThanOrEqual(752);
  const gestesEntiers = await pill.locator('.wm-geste').evaluateAll((gs) => gs.every((g) => new Set([...g.getClientRects()].map((q) => Math.round(q.top))).size === 1));
  expect(gestesEntiers).toBe(true);
  // Liste ouverte en mode actif (1 280 px) : le bandeau se centre sur la page restante, à gauche de la liste
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await page.waitForTimeout(400);
  const place = await page.evaluate(() => {
    const p = document.getElementById('cmPill').getBoundingClientRect(), l = document.getElementById('cmPanel').getBoundingClientRect();
    return { droiteBandeau: p.right, gaucheListe: l.left, centre: p.left + p.width / 2, milieuLibre: l.left / 2 };
  });
  expect(place.droiteBandeau).toBeLessThanOrEqual(place.gaucheListe);
  expect(Math.abs(place.centre - place.milieuLibre)).toBeLessThanOrEqual(8);
  // Liste refermée : il revient au centre de l'écran
  await page.locator('#cmPanelBtn').click();
  await expect.poll(ecartAuCentre).toBeLessThanOrEqual(1);
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

test('5b. visionneuse : Échap, croix et clic à côté la ferment (le clic à côté ne fait rien d’autre), le focus revient à la vignette', async ({ page }) => {
  // Un retour avec une capture (image fabriquée : la capture réelle est testée dans capture.spec).
  await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 200;
    const g = cv.getContext('2d'); g.fillStyle = '#2e6f9e'; g.fillRect(0, 0, 400, 200);
    const now = new Date().toISOString();
    localStorage.setItem('witmit_kiosque_v1', JSON.stringify([{ id: 'v1', type: 'box', status: 'nouveau', page: 'generic-dashboard.html', zone: 'zone encadrée dans : Tableau', text: 'Capture', date: now, vuLe: now,
      anchor: { path: null, relX: 0.1, relY: 0.1, relW: 0.2, relH: 0.1 }, fallback: { x: 100, y: 100, w: 200, h: 80 }, category: 'a-classer', shot: { dataUrl: cv.toDataURL('image/jpeg', 0.8), width: 400, height: 200, at: now } }]));
  });
  await page.reload();
  await page.locator('#cmPanelBtn').click();
  const vignette = page.locator('.cm-panel-item .cm-vignette');
  await expect(vignette).toHaveAccessibleName('agrandir la capture');
  const ouvrir = async () => { await vignette.click(); await expect(page.locator('.cm-lightbox')).toHaveCount(1); };
  // Échap : la visionneuse seule ; le focus revient à la vignette, la liste reste ouverte.
  await ouvrir();
  await expect(page.locator('.cm-lightbox .cm-lb-fermer')).toBeFocused();
  await expect(page.locator('.cm-lightbox')).toContainText('Capture de la zone');
  await expect(page.locator('.cm-lightbox .cm-lb-meta')).toHaveText(/^retour 1 · zone · zone encadrée dans : Tableau · \d\d\/\d\d$/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.cm-lightbox')).toHaveCount(0);
  await expect(vignette).toBeFocused();
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  // Croix.
  await ouvrir();
  await page.locator('.cm-lightbox .cm-lb-fermer').click();
  await expect(page.locator('.cm-lightbox')).toHaveCount(0);
  await expect(vignette).toBeFocused();
  // Le clic sur l'image ne ferme plus ; le clic à côté ferme, et la liste reste ouverte (il ne fait rien d'autre).
  await ouvrir();
  await page.locator('.cm-lightbox img').click();
  await expect(page.locator('.cm-lightbox')).toHaveCount(1);
  await page.mouse.click(20, 400);
  await expect(page.locator('.cm-lightbox')).toHaveCount(0);
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await expect(vignette).toBeFocused();
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

test('10. messages passagers : role="status", un échec reste au moins 6 s, sur plusieurs lignes, sans dépasser 90vw', async ({ page }) => {
  test.setTimeout(30000);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  const toast = page.locator('#cmStatus');
  await expect(toast).toHaveAttribute('role', 'status');
  await expect(toast).toHaveAttribute('aria-live', 'polite');
  // Un échec (maquette sans adresse d'envoi : « envoyer par email » refusé) : icône WarningCircle en signal, phrase à l'encre.
  await H.activate(page);
  await H.addPin(page, CIBLE, 'Retour');
  await page.locator('#cmPanelBtn').click();
  await page.waitForTimeout(400);
  const depart = Date.now();
  await page.evaluate(() => document.querySelector('#cmReportFoot .wm-touche:last-child').click());
  await expect(toast).toBeVisible();
  await expect(toast).toHaveText("aucune adresse d'envoi prévue pour ce site : utilise « télécharger » ou « copier ».");
  const m = await toast.evaluate((el) => {
    const r = el.getBoundingClientRect(), t = el.querySelector('.wm-toast-texte'), ic = el.querySelector('svg[data-icone="WarningCircle"]');
    return { largeur: r.width, vw: document.documentElement.clientWidth, lignes: Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight)),
      icone: ic ? getComputedStyle(ic).color : null, signal: getComputedStyle(el).getPropertyValue('--wm-signal').trim(), encre: getComputedStyle(t).color === getComputedStyle(el).color };
  });
  expect(m.largeur).toBeLessThanOrEqual(m.vw * 0.9 + 0.5);
  expect(m.lignes).toBeGreaterThan(1);
  expect(m.icone).not.toBeNull();
  expect(m.encre).toBe(true);
  // un message réussi qui arrive pendant l'échec ne l'efface pas avant ses 6 s
  await page.evaluate(() => document.querySelector('#cmReportFoot .wm-touche').click());   // « télécharger » : message réussi
  await expect(toast).toHaveText("aucune adresse d'envoi prévue pour ce site : utilise « télécharger » ou « copier ».");
  await page.waitForTimeout(Math.max(0, 5600 - (Date.now() - depart)));
  await expect(toast).toBeVisible();
  await expect(toast).toHaveText("aucune adresse d'envoi prévue pour ce site : utilise « télécharger » ou « copier ».");
  // puis le message réussi prend sa place (icône Check)
  await expect(toast).toContainText('téléchargé', { timeout: 3000 });
  await expect(toast.locator('svg[data-icone="Check"]')).toHaveCount(1);
});

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
  // Tiroir (M1) : pleine largeur, en surimpression, sans pousser la page.
  await page.goto(H.fileUrl(MAQUETTE));
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await page.waitForTimeout(400);
  const t = await page.evaluate(() => {
    const p = document.getElementById('cmPanel').getBoundingClientRect();
    return { vw: document.documentElement.clientWidth, left: p.left, right: p.right, marge: document.documentElement.style.marginRight };
  });
  expect(t.left).toBeLessThanOrEqual(0.5);
  expect(t.right).toBeGreaterThanOrEqual(t.vw - 0.5);
  expect(t.marge).toBe('');                                            // la page n'est pas poussée
  // La fin de la liste défile au-dessus des deux boutons (règle M1, « seule la liste défile ») : marge basse de 76 px,
  // et la dernière ligne, une fois la liste au bout, n'est couverte par aucun bouton.
  await page.locator('#cmPanelBtn').click();
  await page.evaluate(() => {
    const now = new Date().toISOString();
    localStorage.setItem('witmit_kiosque_v1', JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ id: 'l' + i, type: 'pin', status: 'nouveau', page: 'generic-dashboard.html', zone: 'Cellule ' + i, text: 'Retour ' + i, date: now, vuLe: now, category: 'a-classer', fallback: { x: 40, y: 40 } }))));
  });
  await page.reload();
  await page.locator('#cmPanelBtn').click();
  await page.waitForTimeout(400);
  const bas = await page.evaluate(() => {
    const l = document.getElementById('cmList'); l.scrollTop = l.scrollHeight;
    const fab = document.querySelector('.cm-fab').getBoundingClientRect();
    const dernier = l.querySelector('.cm-panel-item:last-child').getBoundingClientRect();
    return { marge: getComputedStyle(l).paddingBottom, couvert: dernier.bottom > fab.top && dernier.top < fab.bottom };
  });
  expect(bas).toEqual({ marge: '76px', couvert: false });
  // Sur ordinateur, la fenêtre fait 380 px, le tiroir aussi.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(H.fileUrl(MAQUETTE));
  await H.activate(page);
  const b = await H.visibleBox(page, CIBLE);
  await page.mouse.click(b.x + 4, b.y + 4);
  expect((await page.locator('.cm-popup').boundingBox()).width).toBe(380);
  await page.keyboard.press('Escape');
  await page.locator('#cmPanelBtn').click();
  await page.waitForTimeout(400);
  expect((await page.locator('#cmPanel').boundingBox()).width).toBe(380);
});

// Lot 8 — tests 4, 7, 8 et 9 sur toute l'interface : chaque vérification passe par les mêmes étapes, en maquette (page
// sombre et page claire : tous les statuts, détails techniques, fenêtre de complément, fenêtre de modification, bandeau,
// message passager, visionneuse) et en live (marques d'envoi, fil, réponse refusée, champ « répondre »).
async function parcoursMaquette(page, nom, verifier) {
  const cibles = nom === 'tellus-accueil.html'
    ? ['.mcard.active .mcard-title', '.mcard:nth-child(2) .mcard-title', '.mcard:nth-child(3) .mcard-title', '.mcard:nth-child(4) .mcard-title', '.mcard:nth-child(5) .mcard-title']
    : ['tbody tr:nth-child(1) td:nth-child(2)', 'tbody tr:nth-child(2) td:nth-child(2)', 'tbody tr:nth-child(3) td:nth-child(2)', 'tbody tr:nth-child(1) td:nth-child(1)', 'tbody tr:nth-child(2) td:nth-child(1)'];
  const proj = nom === 'tellus-accueil.html' ? 'tellus' : 'kiosque';
  await page.goto(H.fileUrl(nom));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  await verifier('bandeau');
  for (const cel of cibles) await H.addPin(page, cel, 'Retour');
  await verifier('message passager');
  await page.evaluate((k) => {
    const a = JSON.parse(localStorage.getItem(k)), d = new Date().toISOString();
    Object.assign(a[1], { status: 'signale', signaledAt: d });
    Object.assign(a[2], { status: 'pris_en_compte', ackAt: d, feedbackMessage: 'Vu' });
    Object.assign(a[3], { status: 'complement', complementAt: d, complementMessage: 'Sur quelle page ?' });
    Object.assign(a[4], { status: 'resolu', resolvedAt: d, resolvedBy: 'moi', replies: [{ text: 'Réponse', date: d }] });
    localStorage.setItem(k, JSON.stringify(a));
  }, 'witmit_' + proj + '_v1');
  await page.reload();
  await H.activate(page);
  await page.locator('#cmPanelBtn').click();
  await page.waitForTimeout(400);
  await page.locator('.cm-panel-item details.cm-tech summary').first().click();
  await verifier('liste');
  await page.locator('.cm-pin').nth(3).click();                       // fenêtre d'un complément demandé
  await expect(page.locator('.cm-popup')).toBeVisible();
  await verifier('fenêtre de complément');
  await page.keyboard.press('Escape');
  await page.locator('.cm-pin').first().click();                      // fenêtre de modification
  await expect(page.locator('.cm-popup')).toBeVisible();
  await verifier('fenêtre de modification');
  await page.keyboard.press('Escape');
  // Zone encadrée avec capture (html2canvas local), puis sa visionneuse.
  if (nom === MAQUETTE) {
    if (await page.locator('#cmPanel').evaluate((p) => p.classList.contains('show'))) await page.locator('#cmPanelBtn').click();
    if ((await page.locator('#cmToggleBtn').getAttribute('aria-pressed')) !== 'true') await H.activate(page);
    await page.waitForTimeout(400);
    const b = await H.visibleBox(page, '.kpi-row');
    await H.drag(page, b.x - 6, b.y - 6, b.x + b.width + 6, b.y + b.height + 6);
    await page.locator('.cm-popup textarea').fill('Les trois tuiles');
    await page.locator('.cm-popup textarea').press('Enter');
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#cmPanel .cm-vignette')).toHaveCount(1, { timeout: 10000 });
    await page.locator('#cmPanel .cm-vignette').click();
    await expect(page.locator('.cm-lightbox')).toBeVisible();
    await verifier('visionneuse');
  }
}
async function parcoursLive(page, verifier) {
  const state = {};
  await H.mockSupabase(page, state);
  await page.goto(H.fileUrl('generic-dashboard-sync.html'));
  await H.clearStorage(page);
  await page.goto(H.fileUrl('generic-dashboard-sync.html') + '?witmit=on');
  await H.activate(page);
  await H.addPin(page, 'tbody tr:nth-child(1) td:nth-child(2)', 'Retour 1');
  await expect.poll(async () => (((await H.stored(page, 'witmit_kiosque-sync_v1'))[0] || {}).sync || {}).state, { timeout: 15000 }).toBe('sent');
  const t = (await H.stored(page, 'witmit_kiosque-sync_v1'))[0];
  state.rows.push({ id_local: t.id, statut: 'resolu', message_retour: 'Corrigé ?', mis_a_jour_le: '2026-09-28T10:00:00Z',
    messages: [{ de: 'equipe', texte: 'Corrigé ?', rouvre: false, cree_le: '2026-09-28T10:00:00Z' }, { de: 'auteur', texte: 'Non', rouvre: true, cree_le: '2026-09-29T10:00:00Z' }] });
  state.failNext = { status: 429, erreur: 'trop de tickets' };
  await H.addPin(page, 'tbody tr:nth-child(2) td:nth-child(2)', 'Retour 2');   // refusé : « à renvoyer »
  await expect(page.locator('#cmStatus')).toContainText('envoi impossible', { timeout: 15000 });
  await verifier('échec d’envoi');
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('.cm-msg')).toHaveCount(2, { timeout: 15000 });
  await page.waitForTimeout(400);
  await verifier('liste live');
  await page.locator('.cm-reopen-btn').click();
  await expect(page.locator('.cm-inline-reply')).toBeVisible();
  await verifier('champ rouvrir');
}

test('4. focus : au clavier, un contour visible sur chaque élément de witmit atteint par tab ; aucun au clic souris', async ({ page }) => {
  test.setTimeout(40000);
  // Contour : outline, ou anneau dessiné par ::after (touches, champs), ou ombre portée de focus.
  const contour = () => page.evaluate(() => {
    const el = document.activeElement;
    if (!el || !el.closest('.cm-ui, .cm-popup, .cm-lightbox')) return { hors: true, nom: el && (el.id || el.className || el.tagName) };
    const cs = getComputedStyle(el), apres = getComputedStyle(el, '::after');
    const champ = el.closest('.wm-champ'), anneauChamp = champ ? getComputedStyle(champ, '::after') : null;
    const visible = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (apres.content !== 'none' && apres.content !== 'normal' && parseFloat(apres.borderTopWidth) >= 2)
      || (anneauChamp && anneauChamp.content !== 'none' && anneauChamp.content !== 'normal') || (cs.boxShadow && cs.boxShadow !== 'none');
    return { hors: false, nom: el.getAttribute('aria-label') || (el.innerText || '').trim().slice(0, 30) || el.className || el.tagName, visible: !!visible, fv: el.matches(':focus-visible') };
  });
  const parcourir = async (depart, n) => {
    await page.locator(depart).first().focus();
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');   // le focus devient « clavier »
    const vus = [];
    for (let i = 0; i < n; i++) {
      const c = await contour();
      if (c.hors) break;
      vus.push(c.nom);
      expect(c.visible, 'contour au clavier : ' + c.nom).toBe(true);
      await page.keyboard.press('Tab');
    }
    return vus;
  };
  // maquette : liste ouverte (en-tête, lignes, pied), puis fenêtre de saisie
  await page.goto(H.fileUrl(MAQUETTE));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  await H.addPin(page, CIBLE, 'Retour');
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await page.waitForTimeout(400);
  const liste = await parcourir('#cmPanel .wm-cercle[aria-label="fermer"]', 40);
  expect(liste.length).toBeGreaterThan(8);
  await page.locator('#cmPanelBtn').click();
  await H.activate(page);
  await page.locator('.cm-pin').first().click();
  await expect(page.locator('.cm-popup textarea')).toBeVisible();
  const fenetre = await parcourir('.cm-popup textarea', 20);
  expect(fenetre.length).toBeGreaterThan(4);
  await page.keyboard.press('Escape');
  // bandeau du mode annotation : « terminer »
  await page.locator('#cmPill .wm-terminer').focus();
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  if (await page.locator('#cmPill .wm-terminer').evaluate((el) => el === document.activeElement)) expect((await contour()).visible, 'terminer').toBe(true);
  await H.deactivate(page);
  // au clic souris : aucun contour (ni :focus-visible) sur les boutons, les touches et les cercles
  await page.locator('#cmPanelBtn').click();
  await page.waitForTimeout(400);
  for (const sel of ['#cmPanelBtn', '#cmPanel .cm-panel-foot .wm-touche >> nth=0', '#cmPanel .wm-cercle >> nth=0']) {
    const loc = page.locator(sel);
    const b = await loc.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    const fv = await page.evaluate(() => { const el = document.activeElement; return { fv: el.matches(':focus-visible'), apres: getComputedStyle(el, '::after').content, outline: getComputedStyle(el).outlineStyle }; });
    await page.mouse.up();
    expect(fv.fv, 'focus au clic : ' + sel).toBe(false);
    expect(fv.outline, 'outline au clic : ' + sel).toBe('none');
    if (await page.locator('.cm-popup').count()) await page.keyboard.press('Escape');
    if (!(await page.locator('#cmPanel').evaluate((p) => p.classList.contains('show')))) { await page.locator('#cmPanelBtn').click(); await page.waitForTimeout(400); }
  }
});

// Texte visible de witmit, hors éléments fournis par la page.
const textesVisibles = (page) => page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.cm-ui, .cm-popup, .cm-lightbox').forEach((root) => {
    [root, ...root.querySelectorAll('*')].forEach((el) => {
      if (el.closest('[data-wm-fourni="page"]')) return;
      if (!Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.nodeValue.trim())) return;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;                                // texte réservé aux lecteurs d'écran (wm-lu) : 1 px
      if (r.width <= 1 && r.height <= 1) return;
      out.push({ texte: Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join('').trim().slice(0, 40), taille: parseFloat(getComputedStyle(el).fontSize), cls: (el.className && el.className.baseVal === undefined ? el.className : el.tagName) });
    });
  });
  return out;
});

test('7. taille de texte : aucun texte visible de witmit sous 12 px, en maquette (page sombre et claire) et en live', async ({ page }) => {
  test.setTimeout(60000);
  const verifier = async (etape) => {
    // taille 0 : chiffre gardé dans le voyant (#cmCount) mais jamais dessiné (le voyant est un disque, décision B)
    const tous = await textesVisibles(page);
    expect(tous.length, etape + ' : textes relevés').toBeGreaterThan(2);
    const petits = tous.filter((t) => t.taille > 0 && t.taille < 12);
    expect(petits, etape).toEqual([]);
  };
  await parcoursMaquette(page, MAQUETTE, verifier);
  await parcoursMaquette(page, 'tellus-accueil.html', verifier);
  await parcoursLive(page, verifier);
});

// Émojis et symboles dessinés (I3), comme charte 21a/21b ; ⌘ et ⌥ restent permis dans le texte courant.
const EMOJI = /[\p{Extended_Pictographic}️⠿✕✓✔↳▸▾]/u;
test('8. émojis : aucun dans les textes, title, aria-label, placeholder et alt de witmit, ni dans ses confirmations', async ({ page }) => {
  test.setTimeout(60000);
  const dialogues = [];
  page.on('dialog', (d) => { dialogues.push(d.message()); d.dismiss().catch(() => {}); });
  const verifier = async (etape) => {
    const fautes = await page.evaluate((src) => {
      const re = new RegExp(src, 'u'), out = [];
      document.querySelectorAll('.cm-ui, .cm-popup, .cm-lightbox').forEach((root) => {
        [root, ...root.querySelectorAll('*')].forEach((el) => {
          if (el.closest('[data-wm-fourni="page"]')) return;
          for (const n of el.childNodes) if (n.nodeType === 3 && re.test(n.nodeValue)) out.push(n.nodeValue.trim());
          for (const a of ['title', 'aria-label', 'placeholder', 'alt']) if (el.getAttribute(a) && re.test(el.getAttribute(a))) out.push(a + ' : ' + el.getAttribute(a));
        });
      });
      return out;
    }, EMOJI.source);
    expect(fautes, etape).toEqual([]);
  };
  await parcoursMaquette(page, MAQUETTE, verifier);
  // confirmations (fenêtres du navigateur) : effacer (page), vider tout (site), fermer une fenêtre écrite
  await page.keyboard.press('Escape');
  if (!(await page.locator('#cmPanel').evaluate((p) => p.classList.contains('show')))) await page.locator('#cmPanelBtn').click();
  await page.waitForTimeout(400);
  await page.locator('#cmClearPageBtn').click();
  await page.locator('#cmClearSiteBtn').click();
  await page.locator('#cmPanelBtn').click();
  await H.activate(page);
  const b = await H.visibleBox(page, CIBLE2);
  await page.mouse.click(b.x + 4, b.y + 4);
  await page.locator('.cm-popup textarea').fill('pas fini');
  await page.locator('#cmToggleBtn').click();
  await expect.poll(() => dialogues.length).toBeGreaterThanOrEqual(3);
  for (const m of dialogues) expect(EMOJI.test(m), m).toBe(false);
  await parcoursLive(page, verifier);
});

test('9. contraste (T12) : aucun texte en ink-faint hors champ, zone en creux ou désactivé, sur toute l’interface', async ({ page }) => {
  test.setTimeout(60000);
  const verifier = async (etape) => {
    const fautes = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.cm-ui, .cm-popup, .cm-lightbox').forEach((f) => {
        if (f.parentElement && f.parentElement.closest('.cm-ui, .cm-popup, .cm-lightbox')) return;   // racines seulement
        const probe = document.createElement('i'); probe.style.color = 'var(--wm-ink-faint)'; f.appendChild(probe);
        const faint = getComputedStyle(probe).color; probe.remove();
        [f, ...f.querySelectorAll('*')].forEach((el) => {
          if (el.closest('[data-wm-fourni="page"], textarea, input, select, .wm-champ, .cm-feedback, .cm-msg-equipe, details pre, [disabled], [aria-disabled="true"], .wm-inactif, .wm-contour')) return;
          const texte = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.nodeValue.trim());
          if (texte && getComputedStyle(el).color === faint) out.push((el.className && el.className.baseVal === undefined ? el.className : el.tagName) + ' « ' + el.textContent.trim().slice(0, 30) + ' »');
        });
      });
      return out;
    });
    expect(fautes, etape).toEqual([]);
  };
  await parcoursMaquette(page, MAQUETTE, verifier);
  await parcoursMaquette(page, 'tellus-accueil.html', verifier);
  await parcoursLive(page, verifier);
});
