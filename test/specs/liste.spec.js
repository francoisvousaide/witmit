// Habillage V2, lot 4 : la liste (fiche Tiroir ; décisions de François du 26/10 : c1 pour les clics et le clavier,
// b3 pour l'état vide). La page rétrécit de 340 px à la manière de Claude in Chrome, un filet de 1 px la sépare de la
// liste, les retours sont réduits à deux lignes et la ligne choisie est grise.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const LONG = 'Le titre est trop collé au menu, il manque de l’air au-dessus et la ligne déborde largement de la liste';
function retour(id, page, extra) {
  const now = new Date().toISOString();
  return Object.assign({ id, type: 'pin', status: 'nouveau', page, zone: 'Cellule ' + id, text: LONG + ' (' + id + ')', date: now, vuLe: now,
    category: 'a-classer', fallback: { x: 40, y: 40 } }, extra || {});
}
// Pose des retours dans le stockage de la page, puis recharge.
async function semer(page, nom, cle, retours) {
  await page.goto(H.fileUrl(nom));
  await page.evaluate(([k, l]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(l)); }, [cle, retours]);
  await page.reload();
}
async function ouvrirListe(page) {
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await page.waitForTimeout(400);
}
const ligne = (page, i) => page.locator('.cm-panel-item').nth(i);
const fondLigne = (loc) => loc.evaluate((el) => getComputedStyle(el, '::before').backgroundColor);

for (const [nom, filet] of [['tellus-accueil.html', 'rgba(0, 0, 0, 0.12)'], ['generic-dashboard.html', 'rgba(255, 255, 255, 0.12)']]) {
  test(`L1. liste de 340 px : la page rétrécit de 340 px puis retrouve sa largeur ; filet de 1 px à 12 %, ni ombre ni filets dedans ; contour et halo suivent la page (${nom})`, async ({ page }) => {
    await page.goto(H.fileUrl(nom));
    await H.clearStorage(page); await page.reload();
    const mesure = () => page.evaluate(() => {
      const p = document.getElementById('cmPanel').getBoundingClientRect();
      const f = document.getElementById('cmFrame').getBoundingClientRect();
      return { vw: document.documentElement.clientWidth, largeur: p.width, gauche: p.left, marge: document.documentElement.style.marginRight,
        corps: document.body.getBoundingClientRect().width, cadreGauche: f.left, cadreDroite: f.right };
    });
    const avant = await mesure();
    expect(avant.cadreDroite).toBe(avant.vw);
    await H.activate(page);
    await ouvrirListe(page);
    const ouverte = await mesure();
    expect(ouverte.largeur).toBe(340);
    expect(ouverte.marge).toBe('340px');
    expect(ouverte.gauche).toBeCloseTo(avant.vw - 340, 0);
    expect(avant.corps - ouverte.corps).toBeCloseTo(340, 0);           // la page rétrécit d'autant
    expect(ouverte.cadreGauche).toBe(0);
    expect(ouverte.cadreDroite).toBeCloseTo(avant.vw - 340, 0);        // le contour orange et le halo s'arrêtent au bord de la liste
    const matiere = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const bords = ['.cm-panel-head', '#cmList', '#cmPanelPied', '#cmFeedbackBox', '#cmReportFoot']
        .map((s) => { const cs = getComputedStyle(q(s)); return [cs.borderTopWidth, cs.borderBottomWidth, cs.borderLeftWidth, cs.borderRightWidth].join(' '); });
      return { filet: getComputedStyle(q('#cmPanel > .wm-verre')).boxShadow, ombre: getComputedStyle(q('#cmPanel > .wm-ombre')).display,
        halo: getComputedStyle(q('#cmFrame'), '::after').boxShadow, bords };
    });
    expect(matiere.filet).toBe(`${filet} 1px 0px 0px 0px inset`);     // un seul filet, côté page ; ni contour sur quatre côtés ni ombre de contact
    expect(matiere.ombre).toBe('none');                                 // ni ombre ni lueur
    expect(matiere.halo).toContain('inset');
    for (const b of matiere.bords) expect(b).toBe('0px 0px 0px 0px');   // plus aucun filet dans la liste
    await page.locator('#cmPanel .cm-panel-fermer').click();
    await page.waitForTimeout(400);
    const apres = await mesure();
    expect(apres.marge).toBe('');
    expect(Math.abs(apres.corps - avant.corps)).toBeLessThan(1);       // la page retrouve sa largeur
    expect(apres.cadreDroite).toBe(avant.vw);
    await expect(page.locator('body')).toHaveClass(/cm-active/);        // le mode continue
  });
}

test('L2. retours réduits à deux lignes (texte 14 px puis élément visé 13 px), sans filets ; ni compteur ni chiffre à côté du titre', async ({ page }) => {
  await semer(page, 'tellus-accueil.html', 'witmit_tellus_v1', ['a', 'b', 'c'].map((id) => retour(id, 'tellus-accueil.html')));
  await ouvrirListe(page);
  await expect(page.locator('.cm-panel-item')).toHaveCount(3);
  await expect(page.locator('#cmPanelCount')).toHaveCount(0);
  await expect(page.locator('#cmPanel .cm-panel-head-row')).toHaveText('En marge de cette page');
  const r = await ligne(page, 0).evaluate((it) => {
    const txt = it.querySelector('.txt'), zone = it.querySelector('.zone');
    const vus = Array.from(it.querySelectorAll('.body > *')).filter((e) => e.getClientRects().length).map((e) => e.className);
    return { vus, ordre: txt.getBoundingClientRect().top < zone.getBoundingClientRect().top, txt: getComputedStyle(txt).fontSize, zone: getComputedStyle(zone).fontSize,
      coupe: txt.scrollWidth > txt.clientWidth, uneLigne: txt.getBoundingClientRect().height < 22, actions: it.querySelector('.cm-item-actions').getClientRects().length,
      bord: getComputedStyle(it).borderBottomWidth, rayon: getComputedStyle(it, '::before').borderRadius };
  });
  expect(r).toEqual({ vus: ['txt', 'zone'], ordre: true, txt: '14px', zone: '13px', coupe: true, uneLigne: true, actions: 0, bord: '0px', rayon: '6px' });
  // Le bloc intérieur, même matière que celui de la fenêtre : à 10 px des bords, arrondi de 7 px.
  const bloc = await page.evaluate(() => {
    const l = document.getElementById('cmList'), p = document.getElementById('cmPanel').getBoundingClientRect(), b = l.getBoundingClientRect(), cs = getComputedStyle(l);
    return { gauche: Math.round(b.left - p.left), droite: Math.round(p.right - b.right), rayon: cs.borderRadius, fond: cs.backgroundColor, padding: cs.padding, defile: cs.overflowY };
  });
  expect(bloc).toEqual({ gauche: 10, droite: 10, rayon: '7px', fond: 'rgba(0, 0, 0, 0.027)', padding: '4px', defile: 'auto' });
});

for (const [nom, cle, gris] of [['tellus-accueil.html', 'witmit_tellus_v1', 'rgba(0, 0, 0, 0.07)'], ['generic-dashboard.html', 'witmit_kiosque_v1', 'rgba(255, 255, 255, 0.09)']]) {
  test(`L3. c1 au clic : un clic choisit (gris, jamais orange), un deuxième ouvre, un troisième referme ; un seul ouvert (${nom})`, async ({ page }) => {
    await semer(page, nom, cle, ['a', 'b'].map((id) => retour(id, nom)));
    await ouvrirListe(page);
    const [a, b] = [ligne(page, 0), ligne(page, 1)];
    await a.locator('.zone').click();                                    // 1er clic : choisi
    await expect(a).toHaveClass(/cm-current/);
    await expect(a).not.toHaveClass(/wm-ouvert/);
    await expect(page.locator('body')).toHaveClass(/cm-active/);        // son repère est allumé sur la page (mode annotation)
    await expect(page.locator('.cm-pin[data-id="a"]')).toHaveClass(/cm-focus/);
    expect(await fondLigne(a)).toBe(gris);
    expect(await fondLigne(a)).not.toContain('247, 130');
    const num = await a.locator('.num').evaluate((n) => [getComputedStyle(n).backgroundColor, getComputedStyle(n).color]);
    expect(num[1]).toBe(nom === 'tellus-accueil.html' ? 'rgb(250, 250, 250)' : 'rgb(27, 27, 27)');   // chiffre dans la couleur du fond de la liste
    await expect(a.locator('.cm-item-actions')).toBeHidden();
    await a.locator('.zone').click();                                    // 2e clic : ouvert en entier
    await expect(a).toHaveClass(/wm-ouvert/);
    await expect(a.locator('.cm-inline-edit')).toBeFocused();           // modifiable : son texte s'ouvre en place, en entier
    await expect(a.locator('.cm-inline-edit')).toHaveValue(LONG + ' (a)');
    await expect(a.locator('.cm-meta').first()).toBeVisible();
    await expect(a.locator('button.st')).toBeVisible();
    await a.locator('.num').click();                                     // 3e clic : refermé, toujours choisi
    await expect(a).not.toHaveClass(/wm-ouvert/);
    await expect(a).toHaveClass(/cm-current/);
    await expect(a.locator('.cm-inline-edit')).toHaveCount(0);
    await expect(a.locator('.txt')).toHaveText(LONG + ' (a)');
    await a.locator('.zone').click();                                    // rouvert…
    await expect(a).toHaveClass(/wm-ouvert/);
    await b.locator('.zone').click();                                    // …un clic sur un autre : l'autre est choisi, le premier refermé
    await expect(b).toHaveClass(/cm-current/);
    await expect(a).not.toHaveClass(/cm-current|wm-ouvert/);
    await b.locator('.zone').click();
    await expect(page.locator('.cm-panel-item.wm-ouvert')).toHaveCount(1);
    await expect(page.locator('.cm-panel-item.cm-current')).toHaveCount(1);
    await a.locator('.zone').click();
    await expect(page.locator('.cm-panel-item.wm-ouvert')).toHaveCount(0);   // un seul ouvert à la fois : celui qui est choisi
    expect(await fondLigne(b)).toBe('rgba(0, 0, 0, 0)');
  });
}

test('L4. c1 au clavier : flèches haut et bas, Entrée pour ouvrir ou refermer, Échap referme le retour ouvert, puis la liste', async ({ page }) => {
  const nom = 'tellus-accueil.html';
  await semer(page, nom, 'witmit_tellus_v1', [retour('a', nom), retour('b', nom, { status: 'signale', signaledAt: new Date().toISOString() }), retour('c', nom)]);
  await ouvrirListe(page);                                                // le focus est resté sur le bouton witmit
  const courante = () => page.locator('.cm-panel-item.cm-current').getAttribute('data-id');
  await page.keyboard.press('ArrowDown');
  expect(await courante()).toBe('a');
  await expect(ligne(page, 0)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  expect(await courante()).toBe('b');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');                                // au bout : reste sur le dernier
  expect(await courante()).toBe('c');
  await page.keyboard.press('ArrowUp');
  expect(await courante()).toBe('b');
  await expect(page.locator('.cm-panel-item.wm-ouvert')).toHaveCount(0);
  await page.keyboard.press('Enter');                                    // ouvre (verrouillé : en lecture)
  await expect(ligne(page, 1)).toHaveClass(/wm-ouvert/);
  await expect(ligne(page, 1).locator('textarea')).toHaveCount(0);
  await page.keyboard.press('Enter');                                    // referme
  await expect(ligne(page, 1)).not.toHaveClass(/wm-ouvert/);
  await page.keyboard.press('Enter');
  await expect(ligne(page, 1)).toHaveClass(/wm-ouvert/);
  await page.keyboard.press('ArrowUp');                                  // changer de retour choisi referme l'ouvert
  expect(await courante()).toBe('a');
  await expect(page.locator('.cm-panel-item.wm-ouvert')).toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(ligne(page, 1)).toHaveClass(/wm-ouvert/);
  await page.keyboard.press('Escape');                                   // Échap : le retour ouvert d'abord…
  await expect(ligne(page, 1)).not.toHaveClass(/wm-ouvert/);
  await expect(ligne(page, 1)).toHaveClass(/cm-current/);
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await page.keyboard.press('Escape');                                   // …puis la liste
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  // Retour modifiable : Entrée l'ouvre dans son champ ; Échap annule et le referme ; Entrée dans le champ enregistre et le referme.
  await ouvrirListe(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(ligne(page, 0).locator('.cm-inline-edit')).toBeFocused();
  await page.keyboard.type(' !');
  await page.keyboard.press('Escape');
  await expect(ligne(page, 0)).not.toHaveClass(/wm-ouvert/);
  await expect(ligne(page, 0).locator('.txt')).toHaveText(LONG + ' (a)');
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await page.keyboard.press('Enter');
  await page.keyboard.type(' !');
  await page.keyboard.press('Enter');
  await expect(ligne(page, 0)).not.toHaveClass(/wm-ouvert/);
  await expect(ligne(page, 0)).toHaveClass(/cm-current/);
  await expect(ligne(page, 0).locator('.txt')).toHaveText(LONG + ' (a) !');
  await page.keyboard.press('Escape');
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
});

for (const [plateforme, multi] of [['MacIntel', '⌘'], ['Win32', 'ctrl']]) {
  test(`L5. état vide de la décision b3, mot pour mot, avec « ${multi}+clic » (${plateforme}) ; puis le bouton « nouveau retour » du pied`, async ({ page }) => {
    await page.addInitScript((p) => {
      Object.defineProperty(Navigator.prototype, 'platform', { configurable: true, get: () => p });
      Object.defineProperty(Navigator.prototype, 'userAgentData', { configurable: true, get: () => ({ platform: p === 'Win32' ? 'Windows' : 'macOS' }) });
    }, plateforme);
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.clearStorage(page); await page.reload();
    await ouvrirListe(page);
    const vide = page.locator('#cmList .cm-panel-empty');
    await expect(vide.locator('p')).toHaveText(["aucun retour sur cette page pour l'instant.", 'pour en laisser un, appuie sur « nouveau retour », puis :']);
    await expect(vide.locator('li')).toHaveText(['clic : un élément', multi + '+clic : plusieurs', 'glisser : une zone', 'maj+glisser : un passage de texte']);
    const touches = await vide.locator('.wm-repere').evaluateAll((els) => els.map((e) => [e.textContent, getComputedStyle(e).fontFamily.split(',')[0].trim(), getComputedStyle(e).borderTopLeftRadius]));
    expect(touches).toEqual([[multi, 'ui-monospace', '4px'], ['maj', 'ui-monospace', '4px']]);
    const gestes = await vide.locator('li').evaluateAll((els) => els.map((e) => [getComputedStyle(e).whiteSpace, getComputedStyle(e.querySelector('b')).fontWeight]));
    for (const g of gestes) expect(g).toEqual(['nowrap', '500']);
    await expect(page.locator('#cmNewAide')).toHaveCount(0);            // plus d'autre aide sous le bouton
    await expect(page.locator('#cmPanel button', { hasText: 'nouveau retour' })).toHaveCount(1);
    const pied = await page.evaluate(() => {
      const v = document.querySelector('#cmList .cm-panel-empty').getBoundingClientRect(), n = document.getElementById('cmNewBtn').getBoundingClientRect();
      return n.top > v.bottom;
    });
    expect(pied).toBe(true);
  });
}

test('L6. pied à droite : « nouveau retour » orange à sa largeur, les autres boutons à droite ; zones de 44 px sans recouvrement (14 px entre deux rangées)', async ({ page }) => {
  await semer(page, 'tellus-accueil.html', 'witmit_tellus_v1', [retour('a', 'tellus-accueil.html'), retour('b', 'tellus-accueil.html')]);
  await ouvrirListe(page);
  const r = await page.evaluate(() => {
    const p = document.getElementById('cmPanel').getBoundingClientRect();
    const bord = p.right - 24;
    const zone = (el) => {
      const b = el.getBoundingClientRect();
      if (el.classList.contains('cm-outil')) return { haut: b.top - 6, bas: b.bottom + 6, gauche: b.left, droite: b.right };
      if (el.classList.contains('cm-scope')) return { haut: b.top - 7, bas: b.bottom + 7, gauche: b.left, droite: b.right };
      return { haut: b.top, bas: b.bottom, gauche: b.left, droite: b.right };
    };
    const vus = Array.from(document.querySelectorAll('#cmPanelPied .cm-outil, #cmPanelPied .cm-scope, #cmPanelPied .wm-touche')).filter((e) => e.getClientRects().length);
    const zones = vus.map((e) => Object.assign({ nom: e.textContent.trim() }, zone(e)));
    const recouvre = [];
    zones.forEach((a, i) => zones.slice(i + 1).forEach((b) => {
      if (a.gauche < b.droite - 0.5 && b.gauche < a.droite - 0.5 && a.haut < b.bas - 0.5 && b.haut < a.bas - 0.5) recouvre.push(a.nom + ' / ' + b.nom);
    }));
    const n = document.getElementById('cmNewBtn'), nb = n.getBoundingClientRect(), face = getComputedStyle(n, '::before').backgroundColor;
    // Rangées : les boutons groupés par leur haut ; la plus à droite de chaque rangée touche le bord du pied.
    const rangees = {};
    vus.filter((e) => !e.classList.contains('cm-scope') && e !== n).forEach((e) => { const b = e.getBoundingClientRect(); const k = Math.round(b.top); rangees[k] = Math.max(rangees[k] || 0, b.right); });
    const tops = Object.keys(rangees).map(Number).sort((x, y) => x - y);
    const outils = Array.from(document.querySelectorAll('#cmPanelTools .cm-outil')).filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().top));
    const rapport = Array.from(document.querySelectorAll('#cmReportFoot .wm-touche')).map((e) => Math.round(e.getBoundingClientRect().top));
    return { recouvre, hauteurs: zones.map((z) => Math.round(z.bas - z.haut)), droiteNouveau: nb.right - bord, largeurNouveau: nb.width, face,
      droites: tops.map((t) => Math.round(rangees[t] - bord)), ecartOutils: [...new Set(outils)], ecartRapport: [...new Set(rapport)],
      scope: Math.round(document.querySelector('#cmReportFoot .cm-scope .wm-case').getBoundingClientRect().right - bord) };
  });
  expect(r.recouvre).toEqual([]);
  for (const h of r.hauteurs) expect(h).toBeGreaterThanOrEqual(44);
  expect(Math.abs(r.droiteNouveau)).toBeLessThan(1);                     // à droite, aligné sur la marge du pied
  expect(r.largeurNouveau).toBeLessThan(200);                            // à sa largeur, jamais sur toute la largeur
  expect(r.face).toBe('rgb(247, 130, 26)');
  for (const d of r.droites) expect(Math.abs(d)).toBeLessThanOrEqual(1);   // chaque rangée de boutons calée à droite
  // 14 px entre deux rangées repliées : faces de 32 px (outils) et de 30 px (rapport, zone de 44 px).
  if (r.ecartOutils.length > 1) expect(r.ecartOutils[1] - r.ecartOutils[0]).toBe(32 + 14);
  expect(r.ecartRapport.length).toBe(2);                                 // à 340 px, « envoyer par email » passe à la ligne
  expect(r.ecartRapport[1] - r.ecartRapport[0]).toBe(30 + 14);
  expect(r.scope).toBeLessThanOrEqual(0);
});

test('L7. aide du champ de réponse du fil : au moins 4,6:1 sur la ligne choisie de la liste mate, en clair et en sombre', async ({ page }) => {
  const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contraste = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  for (const [nom, cle, encre] of [['tellus-accueil.html', 'witmit_tellus_v1', [20, 20, 20]], ['generic-dashboard.html', 'witmit_kiosque_v1', [255, 255, 255]]]) {
    const now = new Date().toISOString();
    await semer(page, nom, cle, [retour('q', nom, { status: 'complement', complementMessage: 'Tu peux préciser ?', complementAt: now, signaledAt: now })]);
    await ouvrirListe(page);
    await ligne(page, 0).locator('.zone').click();
    await ligne(page, 0).locator('.zone').click();                       // ouvert : le champ de réponse au complément
    const ta = page.locator('.cm-panel-item textarea.cm-inline-reply');
    await expect(ta).toBeFocused();
    expect(await ta.evaluate((t) => getComputedStyle(t, '::placeholder').color)).toBe(encre[0] === 20 ? 'rgba(20, 20, 20, 0.6)' : 'rgba(255, 255, 255, 0.6)');
    await page.mouse.move(2, 2);
    await ta.evaluate((t) => { t.placeholder = ''; });                   // la face nue du champ, focus compris
    await page.waitForTimeout(200);
    const b = await ta.boundingBox();
    const png = await page.screenshot({ clip: { x: b.x + 2, y: b.y + 2, width: b.width - 4, height: b.height - 4 } });
    const pixels = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, img.width, img.height).data, out = [];
      for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2]]);
      return out;
    }, png.toString('base64'));
    const pire = Math.min(...pixels.map((f) => contraste([0, 1, 2].map((i) => encre[i] * 0.6 + f[i] * 0.4), f)));
    expect(pire, `${nom} : ${pire.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.6);
  }
});

test('L8. coins arrondis de la liste côté page (9 px) : on y voit la page, rien de witmit', async ({ page }) => {
  await page.goto(H.fileUrl('tellus-accueil.html'));
  await H.clearStorage(page); await page.reload();
  await ouvrirListe(page);
  const r = await page.evaluate(() => {
    const v = getComputedStyle(document.querySelector('#cmPanel > .wm-verre'));
    return [v.borderTopLeftRadius, v.borderTopRightRadius, v.borderBottomRightRadius, v.borderBottomLeftRadius];
  });
  expect(r).toEqual(['9px', '0px', '0px', '9px']);
  const p = await page.locator('#cmPanel').boundingBox();
  // Le pixel du tout coin haut gauche de la liste : celui du fond de la page (la marge de <html>), pas celui de la liste.
  const png = await page.screenshot({ clip: { x: p.x, y: p.y, width: 1, height: 1 } });
  const coin = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = 1; c.height = 1; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    return Array.from(x.getImageData(0, 0, 1, 1).data.slice(0, 3));
  }, png.toString('base64'));
  expect(coin).not.toEqual([250, 250, 250]);
});

// Relecture de Léa (lot 4) : accessibilité de la liste.
test('L9 (É1). lecteur d’écran : liste nommée, retours en éléments de liste avec leur position ; le choisi porte aria-current, son état se lit (« choisi, ouvert » ou « réduit »)', async ({ page }) => {
  const nom = 'tellus-accueil.html';
  await semer(page, nom, 'witmit_tellus_v1', ['a', 'b', 'c'].map((id) => retour(id, nom)));
  await ouvrirListe(page);
  const liste = page.locator('#cmList');
  await expect(liste).toHaveAttribute('role', 'list');
  await expect(liste).toHaveAccessibleName('tes retours sur cette page');
  const etat = () => page.locator('#cmList .cm-panel-item').evaluateAll((els) => els.map((e) => [e.getAttribute('role'), e.getAttribute('aria-posinset'), e.getAttribute('aria-setsize'),
    e.getAttribute('aria-current'), e.querySelector(':scope > .cm-etat-lu').textContent]));
  expect(await etat()).toEqual([['listitem', '1', '3', null, ', réduit'], ['listitem', '2', '3', null, ', réduit'], ['listitem', '3', '3', null, ', réduit']]);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  expect((await etat())[1]).toEqual(['listitem', '2', '3', 'true', ', choisi, réduit']);
  expect((await etat())[0][3]).toBe(null);
  // Ce qu'on entend sur la ligne qui a le focus : la position, le texte, puis l'état.
  const lu = await ligne(page, 1).evaluate((e) => e.textContent.replace(/\s+/g, ' ').trim());
  expect(lu.startsWith('2')).toBe(true);
  expect(lu).toContain(LONG + ' (b)');
  expect(lu.endsWith(', choisi, réduit')).toBe(true);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');                                   // (le champ s'est ouvert : Échap le referme)
  await page.keyboard.press('Enter');
  expect((await etat())[1][4]).toBe(', choisi, ouvert');
  // État vide : pas de rôle de liste (aucun élément).
  await page.goto(H.fileUrl(nom)); await H.clearStorage(page); await page.reload();
  await ouvrirListe(page);
  await expect(page.locator('#cmList')).not.toHaveAttribute('role', /.+/);
});

test('L10 (É2). un seul arrêt de tabulation pour la liste : la ligne choisie, sinon la première ; mis à jour quand le choix change', async ({ page }) => {
  const nom = 'tellus-accueil.html';
  await semer(page, nom, 'witmit_tellus_v1', ['a', 'b', 'c'].map((id) => retour(id, nom)));
  await ouvrirListe(page);
  const arrets = () => page.locator('#cmList .cm-panel-item').evaluateAll((els) => els.map((e) => e.getAttribute('tabindex')));
  expect(await arrets()).toEqual(['0', '-1', '-1']);
  // Au clavier : depuis « masquer les terminés », Tab arrive sur la liste (sa première ligne), puis Tab en sort.
  await page.locator('#cmPanel .cm-hide-done').focus();
  await page.keyboard.press('Tab');
  await expect(ligne(page, 0)).toBeFocused();
  await page.keyboard.press('ArrowDown');                                // rien de choisi : la ligne qui a le focus est choisie
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  expect(await arrets()).toEqual(['-1', '-1', '0']);
  await expect(ligne(page, 2)).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('.cm-panel-item'))).toBe(false);
  await page.keyboard.press('Shift+Tab');
  await expect(ligne(page, 2)).toBeFocused();                            // retour sur la ligne choisie
  await ligne(page, 1).locator('.zone').click();                         // un clic change le choix : l'arrêt suit
  expect(await arrets()).toEqual(['-1', '0', '-1']);
});

test('L11 (É3). fermer la liste quand le focus y est (Échap, Échap ; croix ; « nouveau retour ») rend le focus au bouton witmit', async ({ page }) => {
  const nom = 'tellus-accueil.html';
  await semer(page, nom, 'witmit_tellus_v1', [retour('a', nom, { status: 'signale', signaledAt: new Date().toISOString() })]);
  await ouvrirListe(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(ligne(page, 0)).toHaveClass(/wm-ouvert/);
  await page.keyboard.press('Escape');                                   // le retour ouvert
  await page.keyboard.press('Escape');                                   // puis la liste
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(page.locator('#cmPanelBtn')).toBeFocused();
  await ouvrirListe(page);
  await page.locator('#cmPanel .cm-panel-fermer').click();               // la croix
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(page.locator('#cmPanelBtn')).toBeFocused();
  await ouvrirListe(page);
  await page.locator('#cmNewBtn').focus();
  await page.keyboard.press('Enter');                                    // « nouveau retour » au clavier
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(page.locator('#cmPanelBtn')).toBeFocused();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
});

test('L12. état vide : « nouveau retour » ne se coupe pas (espace insécable), à 340 px', async ({ page }) => {
  await page.goto(H.fileUrl('tellus-accueil.html'));
  await H.clearStorage(page); await page.reload();
  await ouvrirListe(page);
  const p = page.locator('#cmList .cm-vide-mode');
  expect(await p.evaluate((e) => e.textContent)).toBe('pour en laisser un, appuie sur « nouveau retour », puis :');
  const coupe = await p.evaluate((e) => {
    const t = e.firstChild, i = t.data.indexOf('nouveau'), r = document.createRange();
    r.setStart(t, i); r.setEnd(t, i + 'nouveau retour'.length);
    return r.getClientRects().length;
  });
  expect(coupe).toBe(1);                                                 // un seul morceau : jamais coupé
});
