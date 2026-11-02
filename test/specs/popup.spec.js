// Retours du 20/09 (2e série) : Échap, bulle déplaçable, encadré ajustable, position de la pastille de texte.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');
const KEY = 'witmit_kiosque_v1';

test.describe('Bulle et encadré (Kiosque)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
  });

  // 0.4.0 (h1) : champ rempli, Échap pose « abandonner ce retour ? » ; « abandonner » ferme sans rien enregistrer.
  test('Échap, champ rempli : « abandonner ce retour ? » ; abandonner ferme la bulle ; un second Échap quitte le mode', async ({ page }) => {
    const b = await H.visibleBox(page, 'tbody tr:first-child td:nth-child(2)');
    await page.mouse.click(b.x + 5, b.y + 5);
    await page.locator('.cm-popup textarea').fill('brouillon');
    await page.keyboard.press('Escape');
    await expect(page.locator('.cm-popup .cm-abandon')).toBeVisible();
    await page.locator('.cm-popup .cm-abandonner').click();
    await expect(page.locator('.cm-popup')).toHaveCount(0);
    await expect(page.locator('body')).toHaveClass(/cm-active/);
    expect(await H.stored(page, KEY)).toHaveLength(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  });

  test('la bulle se déplace par son bandeau, puis s’enregistre normalement', async ({ page }) => {
    const b = await H.visibleBox(page, 'tbody tr:first-child td:nth-child(2)');
    await page.mouse.click(b.x + 5, b.y + 5);
    const pop = page.locator('.cm-popup');
    const before = await pop.boundingBox();
    const zone = await pop.locator('.cm-zone').boundingBox();
    await H.drag(page, zone.x + 20, zone.y + 6, zone.x + 20 + 150, zone.y + 6 + 120);
    const after = await pop.boundingBox();
    expect(after.x - before.x).toBeGreaterThan(120);
    expect(after.y - before.y).toBeGreaterThan(90);
    await pop.locator('textarea').fill('déplacée');
    await pop.locator('textarea').press('Enter');
    expect(await H.stored(page, KEY)).toHaveLength(1);
  });

  test('encadré : poignées visibles, redimensionnement, libellé et ancrage recalculés', async ({ page }) => {
    const t1 = await H.visibleBox(page, '.kpi-tile:nth-child(1)');
    const t2 = await H.visibleBox(page, '.kpi-tile:nth-child(2)');
    await H.drag(page, t1.x - 4, t1.y - 4, t1.x + t1.width + 4, t1.y + t1.height + 4);
    await expect(page.locator('.cm-popup .cm-titre')).toHaveText('zone');   // 0.4.0 : le type en titre, les textes contenus dessous
    await expect(page.locator('.cm-popup .cm-zone')).toHaveText('Chiffre du jour, 1 240 € · dans « Tableau de bord »');
    await expect(page.locator('.cm-box-editable .cm-handle')).toHaveCount(8);
    // on tire la poignée "e" (côté droit) jusqu'à couvrir la 2e tuile
    const h = await page.locator('.cm-handle-e').boundingBox();
    await H.drag(page, h.x + 5, h.y + 5, t2.x + t2.width + 4, h.y + 5);
    const box = await page.locator('.cm-box-editable').boundingBox();
    expect(box.x + box.width).toBeGreaterThan(t2.x + t2.width);
    await page.locator('.cm-popup textarea').fill('deux tuiles');
    await page.locator('.cm-popup textarea').press('Enter');
    await expect(page.locator('.cm-handle')).toHaveCount(0); // poignées retirées après enregistrement
    const data = await H.stored(page, KEY);
    expect(data[0].zone).toBe('zone « Chiffre du jour, 1 240 €, Commandes (+1) » · dans « Tableau de bord »');
    expect(data[0].fallback.w).toBeGreaterThan(t2.x + t2.width - t1.x - 10);
    // le repère rendu couvre bien les deux tuiles
    const saved = await page.locator('.cm-box-saved').boundingBox();
    expect(saved.x + saved.width).toBeGreaterThan(t2.x + t2.width);
  });

  test('encadré : déplacement au centre ; fermer (sans changer le texte) remet un encadré existant en place', async ({ page }) => {
    const t1 = await H.visibleBox(page, '.kpi-tile:nth-child(1)');
    await H.drag(page, t1.x - 4, t1.y - 4, t1.x + t1.width + 4, t1.y + t1.height + 4);
    await page.locator('.cm-popup textarea').fill('à déplacer');
    await page.locator('.cm-popup textarea').press('Enter');
    const before = await page.locator('.cm-box-saved').boundingBox();
    // réouverture via la pastille → l'encadré redevient ajustable
    await page.locator('.cm-pin').click();
    await expect(page.locator('.cm-box-editable .cm-handle')).toHaveCount(8);
    const c = await page.locator('.cm-box-editable').boundingBox();
    await H.drag(page, c.x + c.width / 2, c.y + c.height / 2, c.x + c.width / 2 + 200, c.y + c.height / 2 + 150);
    const moved = await page.locator('.cm-box-editable').boundingBox();
    expect(moved.x - before.x).toBeGreaterThan(150);
    await page.locator('.cm-popup .cm-fermer').click();   // 0.4.0 : plus d'« annuler » ; la croix
    const restored = await page.locator('.cm-box-saved').boundingBox();
    expect(Math.abs(restored.x - before.x)).toBeLessThan(3);
    expect(Math.abs(restored.y - before.y)).toBeLessThan(3);
    // rééditer, déplacer, Enregistrer → la nouvelle position est conservée après rechargement
    await page.locator('.cm-pin').click();
    const c2 = await page.locator('.cm-box-editable').boundingBox();
    await H.drag(page, c2.x + c2.width / 2, c2.y + c2.height / 2, c2.x + c2.width / 2 + 300, c2.y + c2.height / 2);
    await page.locator('.cm-popup textarea').press('Enter');
    await page.reload(); await H.activate(page);
    const afterReload = await page.locator('.cm-box-saved').boundingBox();
    expect(afterReload.x - before.x).toBeGreaterThan(250);
  });

  test('pastille de texte (0.4.0) : épingle de 18 px au bout du passage, sur le coin haut droit de sa dernière ligne, décalée de 0,40', async ({ page }) => {
    const t = await H.visibleBox(page, 'tbody tr:nth-child(3) td:nth-child(2)');
    await H.drag(page, t.x + 2, t.y + 10, t.x + 120, t.y + 10, { shift: true });
    await page.locator('.cm-popup textarea').fill('x');
    await page.locator('.cm-popup textarea').press('Enter');
    const fin = await page.locator('mark.cm-highlight').last().evaluate((m) => { const r = [...m.getClientRects()].pop(); return { r: r.right, t: r.top, b: r.bottom }; });
    const pin = await page.locator('.cm-pin').boundingBox();
    expect(pin.height).toBe(18);
    expect(Math.abs(pin.x + 9 - (fin.r + 7.2))).toBeLessThan(0.6);   // au bout du passage, 90 % hors du surlignage
    expect(Math.abs(pin.y + 9 - (fin.t - 7.2))).toBeLessThan(0.6);
    expect(pin.y + pin.height).toBeLessThanOrEqual(fin.t + 2);       // sans cacher le texte
    await page.reload(); await H.activate(page);
    const pin2 = await page.locator('.cm-pin').boundingBox();
    expect(Math.abs(pin2.x - pin.x)).toBeLessThan(3); // même position après rechargement
  });

  test('le raccourci est ignoré pendant la saisie dans un champ de la page', async ({ page }) => {
    await H.deactivate(page);
    await page.locator('#tabBtnForm').click();
    await page.locator('#client').click();
    await H.doubleAlt(page);                                            // 0.4.0 : ⌥ deux fois ouvre witmit… sauf dans un champ
    await page.keyboard.press('Alt+KeyA');                              // ⌥+A cache witmit… sauf dans un champ
    await expect(page.locator('body')).not.toHaveClass(/cm-active/);
    await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
    await page.locator('h1').click();
    await H.doubleAlt(page);
    await expect(page.locator('body')).toHaveClass(/cm-active/);
  });
});

test('onde claire sur fond sombre (Kiosque), orange sur fond clair (TellUs)', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload(); await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'sombre');
  await H.deactivate(page);
  await H.ouvrirListe(page);
  await page.locator('.cm-panel-item .body').click();
  await expect(page.locator('.cm-box-outline')).toHaveClass(/cm-ola-light/);
  await expect(page.locator('.cm-box-outline')).toHaveClass(/cm-focus-light/);
  await page.goto(H.fileUrl('tellus-accueil.html'));
  await H.clearStorage(page); await page.reload(); await H.activate(page);
  await H.addPin(page, '.mcard.active .mcard-title', 'clair');
  await H.deactivate(page);
  await H.ouvrirListe(page);
  await page.locator('.cm-panel-item .body').click();
  await expect(page.locator('.cm-box-outline')).toHaveClass(/cm-ola(?!-light)/);
});

test('curseurs : croix sur la page, flèche dans la liste, pointeur sur les boutons (0.4.0 : plus de bandeau)', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  expect(await page.locator('#cmPanelBtn').evaluate((el) => getComputedStyle(el).cursor)).toBe('pointer');
  await H.activate(page);
  const cur = (sel) => page.locator(sel).evaluate((el) => getComputedStyle(el).cursor);
  expect(await cur('body')).toBe('crosshair');
  expect(await cur('#cmPanel .cm-panel-head')).toBe('default');
  expect(await cur('#cmPanel .cm-panel-reduire')).toBe('pointer');
});

// ---------- Lot 4 : fenêtre de saisie (fiche Fenetre ; textes de Léa 3.7 et 3.8) ----------

const titre = (page) => page.locator('.cm-popup .cm-titre');

test('« envoyer » / « enregistrer » désactivée tant que le champ est vide ; entrée : une phrase, sans rouge', async ({ page }) => {
  for (const [nom, touche, phrase] of [['generic-dashboard.html', 'enregistrer', "écris ton retour avant d'enregistrer."],
                                       ['generic-dashboard-live.html', 'envoyer', "écris ton retour avant d'envoyer."]]) {
    await page.goto(H.fileUrl(nom));
    await H.clearStorage(page); await page.reload();
    if (nom.includes('live')) await H.montrer(page);
    await H.activate(page);
    const b = await H.visibleBox(page, 'tbody tr:first-child td:nth-child(2)');
    await page.mouse.click(b.x + 5, b.y + 5);
    const ta = page.locator('.cm-popup textarea'), save = page.locator('.cm-popup .cm-save'), refus = page.locator('.cm-popup .cm-refus');
    await expect(save, nom).toHaveText(touche);
    await expect(save.locator('svg[data-icone="ArrowElbowDownLeft"], .wm-repere'), nom).toHaveCount(0);   // V2 : plus de repère ↵ dans le bouton
    await expect(save, nom).toHaveAttribute('aria-keyshortcuts', 'Enter');                               // le raccourci reste dans le nom accessible
    await expect(save, nom).toBeDisabled();
    await expect(refus, nom).toBeHidden();
    await ta.press('Enter');                                   // rien ne part, la fenêtre reste ouverte
    await expect(page.locator('.cm-popup'), nom).toHaveCount(1);
    await expect(refus, nom).toBeVisible();
    await expect(refus, nom).toHaveText(phrase);
    await expect(refus.locator('svg[data-icone="Info"]'), nom).toHaveCount(1);
    const couleurs = await page.evaluate(() => {
      const r = document.querySelector('.cm-popup .cm-refus'), cs = getComputedStyle(r);
      const ink = getComputedStyle(document.querySelector('.cm-popup')).getPropertyValue('--wm-ink').trim();
      const t = document.createElement('span'); t.style.color = ink; r.appendChild(t); const attendu = getComputedStyle(t).color; t.remove();
      return { texte: cs.color, icone: getComputedStyle(r.querySelector('svg')).color, attendu };
    });
    expect(couleurs.texte, nom).toBe(couleurs.attendu);       // encre de la fenêtre, jamais le rouge signal
    expect(couleurs.icone, nom).toBe(couleurs.attendu);
    expect(await H.stored(page, nom.includes('live') ? 'witmit_kiosque-live_v1' : KEY), nom).toHaveLength(0);
    await ta.pressSequentially('x');                           // la phrase disparaît dès la première lettre
    await expect(refus, nom).toBeHidden();
    await expect(save, nom).toBeEnabled();
    await ta.fill('   ');
    await expect(save, nom).toBeDisabled();                    // des espaces seuls ne comptent pas
    await page.keyboard.press('Escape');
  }
});

// 0.4.0 (décision a2, fiche Fenetre, fiche Icones) : le type de l'élément en titre, avec son icône de 16 px ; « nom ·
// description » dessous, sur une ligne ; la tête entière déplace la fenêtre (plus de poignée à points) ; croix « fermer ».
test('type en titre selon la cible (a2) ; tête-poignée sans points, élément visé sur une ligne, croix « fermer »', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  const ico = () => page.locator('.cm-popup .cm-type-ico svg');
  const clic = async (sel) => { const b = await H.visibleBox(page, sel); await page.mouse.click(b.x + 4, b.y + 4); await expect(page.locator('.cm-popup')).toBeVisible(); };
  await clic('#tabBtnOrders');
  await expect(titre(page)).toHaveText('bouton');
  await expect(ico()).toHaveAttribute('data-icone', 'CursorClick');
  await expect(page.locator('.cm-popup .cm-tete')).toHaveAttribute('title', 'glisse pour déplacer la fenêtre');
  await expect(page.locator('.cm-popup [data-icone="DotsSixVertical"]')).toHaveCount(0);
  await expect(page.locator('.cm-popup .cm-zone-txt')).toHaveAttribute('title', 'Commandes');
  expect(await page.locator('.cm-popup .cm-zone-txt').evaluate((el) => getComputedStyle(el).whiteSpace + ' ' + getComputedStyle(el).textOverflow)).toBe('nowrap ellipsis');
  await expect(page.locator('.cm-popup .cm-fermer')).toHaveAccessibleName('fermer');
  await expect(page.locator('.cm-popup .cm-libelle, .cm-popup .cm-libelle-cat, .cm-popup .cm-cancel')).toHaveCount(0);
  await expect(page.locator('.cm-popup textarea')).toHaveAccessibleName('ce que tu as remarqué');
  await expect(page.locator('.cm-popup textarea')).toHaveAttribute('placeholder', 'ta remarque, ta question ou ta critique…');
  await expect(page.locator('.cm-popup .cm-aide-multi')).toBeHidden();
  await page.locator('.cm-popup .cm-fermer').click();       // la croix ferme comme échap (champ vide)
  await expect(page.locator('.cm-popup')).toHaveCount(0);
  await clic('nav a:last-child');
  await expect(titre(page)).toHaveText('lien');
  await expect(ico()).toHaveAttribute('data-icone', 'Link');
  await page.keyboard.press('Escape');
  await clic('.kpi-tile:nth-child(1) .kpi-value');
  await expect(titre(page)).toHaveText('texte');
  await expect(ico()).toHaveAttribute('data-icone', 'Highlighter');
  // plusieurs éléments (⌘/ctrl+clic sur deux autres) : icône SelectionPlus, ligne d'aide
  const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
  for (const sel of ['.kpi-tile:nth-child(2) .kpi-value', '.kpi-tile:nth-child(3) .kpi-value']) {
    const r = await H.visibleBox(page, sel);
    await page.keyboard.down(MOD); await page.mouse.click(r.x + 5, r.y + 5); await page.keyboard.up(MOD);
  }
  await expect(titre(page)).toHaveText('plusieurs éléments');
  await expect(ico()).toHaveAttribute('data-icone', 'SelectionPlus');
  await expect(page.locator('.cm-popup .cm-zone-txt')).toHaveText('1 240 €, 37, 33,5 € · 3 éléments');
  await expect(page.locator('.cm-popup .cm-aide-multi')).toBeVisible();
  await expect(page.locator('.cm-popup .cm-aide-multi')).toHaveText(process.platform === 'darwin' ? 'cmd+clic : ajouter ou retirer un élément' : 'ctrl+clic : ajouter ou retirer un élément');
  await page.keyboard.press('Escape');
  // une zone encadrée, un mot
  const t = await H.visibleBox(page, '.kpi-tile:nth-child(1)');
  await H.drag(page, t.x - 4, t.y - 4, t.x + t.width + 4, t.y + t.height + 4);
  await expect(titre(page)).toHaveText('zone');
  await expect(ico()).toHaveAttribute('data-icone', 'BoundingBox');
  await page.keyboard.press('Escape');
  const c = await H.visibleBox(page, 'tbody tr:nth-child(3) td:nth-child(2)');
  await page.mouse.dblclick(c.x + 12, c.y + c.height / 2);
  await expect(titre(page)).toHaveText('mot');
  await expect(ico()).toHaveAttribute('data-icone', 'TextAa');
  await page.keyboard.press('Escape');
  // un champ du site (onglet « Nouvelle commande »)
  await H.deactivate(page);
  await page.locator('#tabBtnForm').click();
  await H.activate(page);
  await clic('#client');
  await expect(titre(page)).toHaveText('champ');
  await expect(ico()).toHaveAttribute('data-icone', 'Textbox');
  await expect(page.locator('.cm-popup .cm-zone-txt')).toHaveText(/^Client · vide, texte grisé «\sNom du client\s»$/);   // R20 : le texte grisé du champ vide
});

test('champ : au clic, trait line-strong sans anneau ; au clavier, anneau de la charte ; rien du focus de la page hôte', async ({ page }) => {
  await page.goto(H.fileUrl('tellus-accueil.html'));          // la page pose « :focus-visible { box-shadow } »
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  const b = await H.visibleBox(page, '.mcard.active .mcard-title');
  await page.mouse.click(b.x + 5, b.y + 5);                   // fenêtre ouverte par un clic souris
  const ta = page.locator('.cm-popup textarea');
  await expect(ta).toBeFocused();
  const etat = () => ta.evaluate((el) => {
    const cs = getComputedStyle(el), anneau = getComputedStyle(el.parentNode, '::after');
    const t = document.createElement('span'); t.style.color = getComputedStyle(el).getPropertyValue('--wm-line-strong'); el.parentNode.appendChild(t);
    const fort = getComputedStyle(t).color; t.remove();
    return { ombre: cs.boxShadow, contour: cs.outlineStyle, resize: cs.resize, police: cs.fontFamily, coupe: cs.clipPath, rayon: cs.borderRadius,
      trait: cs.borderTopColor, fort, anneau: anneau.content, anneauClip: anneau.clipPath, anneauTrait: anneau.borderTopWidth, anneauRayon: anneau.borderRadius };
  });
  // 1. Après le clic : seulement le trait line-strong (fiche Etats : jamais d'anneau au clic souris).
  let st = await etat();
  expect(st.anneau).toBe('none');
  expect(st.trait).toBe(st.fort);
  expect(st.ombre).toBe('none');                               // aucune ombre de focus de la page hôte
  expect(st.contour).toBe('none');
  expect(st.resize).toBe('none');                              // pas de poignée rognée par le coin coupé
  expect(st.police).toMatch(/^-apple-system, /);                 // V2 : police système, texte de la personne compris
  expect(st.coupe).toBe('none');                               // V2 : plus d'angle cassé
  expect(st.rayon).toBe('5px');                                // arrondi radius-champ
  await ta.pressSequentially('du texte');                      // taper ne fait pas apparaître l'anneau
  expect((await etat()).anneau).toBe('none');
  // 2. Tab vers le bouton principal (0.4.0 : plus de catégorie), puis maj+Tab vers le champ : l'anneau de la charte.
  await page.keyboard.press('Tab');
  await expect(page.locator('.cm-popup .cm-save')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(ta).toBeFocused();
  st = await etat();
  expect(st.anneau).not.toBe('none');
  expect(st.anneauClip).toBe('none');                          // anneau arrondi : 2 px, à 2 px du champ (5 + 4 px)
  expect(st.anneauTrait).toBe('2px');
  expect(st.anneauRayon).toBe('9px');
  expect(st.ombre).toBe('none');
  // 3. Un nouveau clic dans le champ retire l'anneau.
  const r = await ta.boundingBox();
  await page.mouse.click(r.x + 20, r.y + 20);
  expect((await etat()).anneau).toBe('none');
  // Le champ grandit avec le texte au lieu d'une poignée.
  const h0 = (await ta.boundingBox()).height;
  await ta.fill('une ligne\nune autre\nencore une\net une quatrième\net une cinquième');
  expect((await ta.boundingBox()).height).toBeGreaterThan(h0);
});
