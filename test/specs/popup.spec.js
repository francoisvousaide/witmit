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

  test('Échap annule la bulle ; un second Échap quitte le mode', async ({ page }) => {
    const b = await H.visibleBox(page, 'tbody tr:first-child td:nth-child(2)');
    await page.mouse.click(b.x + 5, b.y + 5);
    await page.locator('.cm-popup textarea').fill('brouillon');
    await page.keyboard.press('Escape');
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
    await expect(page.locator('.cm-popup .cm-zone')).toHaveText('zone encadrée : Chiffre du jour, 1 240 €');
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
    expect(data[0].zone).toBe('zone encadrée : Chiffre du jour, 1 240 €, Commandes (+1)');
    expect(data[0].fallback.w).toBeGreaterThan(t2.x + t2.width - t1.x - 10);
    // le repère rendu couvre bien les deux tuiles
    const saved = await page.locator('.cm-box-saved').boundingBox();
    expect(saved.x + saved.width).toBeGreaterThan(t2.x + t2.width);
  });

  test('encadré : déplacement au centre ; Annuler remet un encadré existant en place', async ({ page }) => {
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
    await page.locator('.cm-popup .cm-cancel').click();
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

  test('pastille de texte : en haut à gauche, au début du passage, sans cacher le texte', async ({ page }) => {
    const t = await H.visibleBox(page, 'tbody tr:nth-child(3) td:nth-child(2)');
    await H.drag(page, t.x + 2, t.y + 10, t.x + 120, t.y + 10, { shift: true });
    await page.locator('.cm-popup textarea').fill('x');
    await page.locator('.cm-popup textarea').press('Enter');
    const mark = await page.locator('mark.cm-highlight').first().boundingBox();
    const pin = await page.locator('.cm-pin').boundingBox();
    expect(pin.y + pin.height).toBeLessThanOrEqual(mark.y + 8); // au-dessus du texte (la pointe inclinée peut effleurer)
    expect(Math.abs(pin.x + pin.width / 2 - mark.x)).toBeLessThan(14); // au niveau du début du passage
    await page.reload(); await H.activate(page);
    const pin2 = await page.locator('.cm-pin').boundingBox();
    expect(Math.abs(pin2.x - pin.x)).toBeLessThan(3); // même position après rechargement
  });

  test('le raccourci est ignoré pendant la saisie dans un champ de la page', async ({ page }) => {
    await H.deactivate(page);
    await page.locator('#tabBtnForm').click();
    await page.locator('#client').click();
    await page.keyboard.press('Alt+KeyA');
    await expect(page.locator('body')).not.toHaveClass(/cm-active/);
    await page.locator('h1').click();
    await page.keyboard.press('Alt+KeyA');
    await expect(page.locator('body')).toHaveClass(/cm-active/);
  });
});

test('onde claire sur fond sombre (Kiosque), orange sur fond clair (TellUs)', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload(); await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'sombre');
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await page.locator('.cm-panel-item .body').click();
  await expect(page.locator('.cm-box-outline')).toHaveClass(/cm-ola-light/);
  await expect(page.locator('.cm-box-outline')).toHaveClass(/cm-focus-light/);
  await page.goto(H.fileUrl('tellus-accueil.html'));
  await H.clearStorage(page); await page.reload(); await H.activate(page);
  await H.addPin(page, '.mcard.active .mcard-title', 'clair');
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await page.locator('.cm-panel-item .body').click();
  await expect(page.locator('.cm-box-outline')).toHaveClass(/cm-ola(?!-light)/);
});

test('curseurs : main ouverte sur la poignée de la barre, flèche ailleurs, pointeur sur les boutons', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.activate(page);
  const cur = (sel) => page.locator(sel).evaluate((el) => getComputedStyle(el).cursor);
  expect(await cur('#cmPill .cm-drag-handle')).toBe('grab');
  expect(await cur('#cmPill')).toBe('default');
  expect(await cur('#cmPill button')).toBe('pointer');
  expect(await cur('#cmToggleBtn')).toBe('pointer');
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
    await expect(save.locator('svg[data-icone="ArrowElbowDownLeft"]'), nom).toHaveCount(1);
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

test('titre selon le type de cible ; tête-poignée, élément visé sur une ligne, croix « annuler »', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  const clic = async (sel) => { const b = await H.visibleBox(page, sel); await page.mouse.click(b.x + 4, b.y + 4); await expect(page.locator('.cm-popup')).toBeVisible(); };
  await clic('#tabBtnOrders');
  await expect(titre(page)).toHaveText('Ton retour sur ce bouton');
  // tête : poignée entière (info-bulle), élément visé en dessous (poignée, icône du type, libellé complet en info-bulle)
  await expect(page.locator('.cm-popup .cm-tete')).toHaveAttribute('title', 'glisse pour déplacer la fenêtre');
  await expect(page.locator('.cm-popup .cm-zone svg')).toHaveCount(2);
  await expect(page.locator('.cm-popup .cm-zone svg').first()).toHaveAttribute('data-icone', 'DotsSixVertical');
  await expect(page.locator('.cm-popup .cm-zone .cm-type')).toHaveAttribute('data-icone', 'CursorClick');
  await expect(page.locator('.cm-popup .cm-zone-txt')).toHaveAttribute('title', 'Commandes');
  expect(await page.locator('.cm-popup .cm-zone-txt').evaluate((el) => getComputedStyle(el.parentNode).whiteSpace + ' ' + getComputedStyle(el).textOverflow)).toBe('nowrap ellipsis');
  await expect(page.locator('.cm-popup .cm-fermer')).toHaveAccessibleName('annuler');
  await expect(page.locator('.cm-popup .cm-libelle').first()).toHaveText('ce que tu as remarqué');
  await expect(page.locator('.cm-popup textarea')).toHaveAccessibleName('ce que tu as remarqué');
  await expect(page.locator('.cm-popup textarea')).toHaveAttribute('placeholder', 'ta remarque, ta question ou ta critique… (maj+entrée : nouvelle ligne)');
  await expect(page.locator('.cm-popup .cm-libelle-cat')).toHaveText('catégorie');
  await expect(page.locator('.cm-popup .cm-cancel')).toHaveText('annuler');
  await expect(page.locator('.cm-popup .cm-aide-multi')).toBeHidden();
  await page.locator('.cm-popup .cm-fermer').click();       // la croix ferme comme échap
  await expect(page.locator('.cm-popup')).toHaveCount(0);
  await clic('nav a:first-child');
  await expect(titre(page)).toHaveText('Ton retour sur ce lien');
  await page.keyboard.press('Escape');
  await clic('.kpi-tile:nth-child(1) .kpi-value');
  await expect(titre(page)).toHaveText('Ton retour sur cet élément');
  // plusieurs éléments (⌘/ctrl+clic sur deux autres) : titre au nombre près, icône SelectionPlus, ligne d'aide
  const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
  for (const sel of ['.kpi-tile:nth-child(2) .kpi-value', '.kpi-tile:nth-child(3) .kpi-value']) {
    const r = await H.visibleBox(page, sel);
    await page.keyboard.down(MOD); await page.mouse.click(r.x + 5, r.y + 5); await page.keyboard.up(MOD);
  }
  await expect(titre(page)).toHaveText('Ton retour sur ces 3 éléments');
  await expect(page.locator('.cm-popup .cm-zone .cm-type')).toHaveAttribute('data-icone', 'SelectionPlus');
  await expect(page.locator('.cm-popup .cm-aide-multi')).toBeVisible();
  await expect(page.locator('.cm-popup .cm-aide-multi')).toHaveText(process.platform === 'darwin' ? 'cmd+clic : ajouter ou retirer un élément' : 'ctrl+clic : ajouter ou retirer un élément');
  await page.keyboard.press('Escape');
  // une zone encadrée, un passage de texte
  const t = await H.visibleBox(page, '.kpi-tile:nth-child(1)');
  await H.drag(page, t.x - 4, t.y - 4, t.x + t.width + 4, t.y + t.height + 4);
  await expect(titre(page)).toHaveText('Ton retour sur cette zone');
  await expect(page.locator('.cm-popup .cm-zone .cm-type')).toHaveAttribute('data-icone', 'BoundingBox');
  await page.keyboard.press('Escape');
  const c = await H.visibleBox(page, 'tbody tr:nth-child(3) td:nth-child(2)');
  await page.mouse.dblclick(c.x + 12, c.y + c.height / 2);
  await expect(titre(page)).toHaveText('Ton retour sur ce texte');
  await expect(page.locator('.cm-popup .cm-zone .cm-type')).toHaveAttribute('data-icone', 'TextT');
  await page.keyboard.press('Escape');
  // un champ du site (onglet « Nouvelle commande »)
  await H.deactivate(page);
  await page.locator('#tabBtnForm').click();
  await H.activate(page);
  await clic('#client');
  await expect(titre(page)).toHaveText('Ton retour sur ce champ');
  await expect(page.locator('.cm-popup .cm-zone-txt')).toHaveText('champ Nom du client');
});

test('champ : anneau de la charte au focus, aucune règle de focus de la page hôte, pas de poignée rognée', async ({ page }) => {
  await page.goto(H.fileUrl('tellus-accueil.html'));          // la page pose « :focus-visible { box-shadow } »
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  const b = await H.visibleBox(page, '.mcard.active .mcard-title');
  await page.mouse.click(b.x + 5, b.y + 5);
  const ta = page.locator('.cm-popup textarea');
  await expect(ta).toBeFocused();
  const st = await ta.evaluate((el) => {
    const cs = getComputedStyle(el), anneau = getComputedStyle(el.parentNode, '::after');
    return { ombre: cs.boxShadow, contour: cs.outlineStyle, resize: cs.resize, police: cs.fontFamily, coupe: cs.clipPath, anneau: anneau.content, anneauClip: anneau.clipPath };
  });
  expect(st.ombre).toBe('none');
  expect(st.contour).toBe('none');
  expect(st.resize).toBe('none');
  expect(st.police).toContain('Syne');
  expect(st.coupe).toContain('polygon');
  expect(st.anneau).not.toBe('none');                          // l'anneau de la charte (fiche Etats), qui suit les coins
  expect(st.anneauClip).toContain('polygon');
  // Le champ grandit avec le texte au lieu d'une poignée
  const h0 = (await ta.boundingBox()).height;
  await ta.fill('une ligne\nune autre\nencore une\net une quatrième\net une cinquième');
  expect((await ta.boundingBox()).height).toBeGreaterThan(h0);
});
