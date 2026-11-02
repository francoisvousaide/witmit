// Lot 2 de la course 0.4.0 : sélection (règle simple et étau, crochets G, M et P, point, zone et R23), présélection au
// survol, épingles de 24 et 18 px (ZB-304), passage de texte surligné (fiches Selection, Reperes, Epingle du design
// system version 7 ; valeurs dessinées : selection4.js). Page : test/pages/selection.html, en clair, à 1 280 px.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const PAGE = 'selection.html';
const KEY = 'witmit_selection_v1';

async function ouvrir(page) {
  await page.goto(H.fileUrl(PAGE));
  await H.clearStorage(page);
  await page.reload();
  await H.activate(page);
}
// Boîte (écran) d'un élément de la page.
const boite = (page, sel) => page.locator(sel).evaluate((el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; });
// Trait d'un crochet (ombre intérieure « inset X Y 0 0 couleur ») : sa largeur et sa couleur.
const traitOmbre = (o) => { const m = /(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px/.exec(o) || []; return { couleur: m[1], x: Math.abs(parseFloat(m[2])), y: Math.abs(parseFloat(m[3])) }; };
// Cadre de sélection : la boîte .cm-box, son dessin .wm-cadre et le crochet haut gauche (::before) et bas droit (::after).
function mesureCadre(page, sel) {
  return page.locator(sel).first().evaluate((b) => {
    const c = b.querySelector(':scope > .wm-cadre'), r = c.getBoundingClientRect(), av = getComputedStyle(c, '::before'), ap = getComputedStyle(c, '::after');
    return {
      l: r.left, t: r.top, r: r.right, b: r.bottom, rayon: getComputedStyle(c).borderTopLeftRadius,
      etau: b.classList.contains('wm-etau'), m: b.classList.contains('wm-crochet-m'),
      hg: { gauche: parseFloat(av.left), haut: parseFloat(av.top), bras: parseFloat(av.width), ombre: av.boxShadow, coude: av.borderTopLeftRadius },
      bd: { droite: parseFloat(ap.right), bas: parseFloat(ap.bottom), bras: parseFloat(ap.width), ombre: ap.boxShadow, coude: ap.borderBottomRightRadius }
    };
  }).then((m) => {
    for (const k of ['hg', 'bd']) { const t = traitOmbre(m[k].ombre); m[k].trait = t.x === t.y ? t.x : NaN; m[k].encre = t.couleur; delete m[k].ombre; }
    return m;
  });
}
// Épingle principale d'un retour : centre, taille, forme, chiffre, et son ::before (plus de crochets).
function mesureEpingle(page, n = 0) {
  return page.locator('.cm-pin:not(.cm-pin-secondary)').nth(n).evaluate((p) => {
    const r = p.getBoundingClientRect(), cs = getComputedStyle(p), av = getComputedStyle(p, '::before'), ap = getComputedStyle(p, '::after');
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height, rayon: cs.borderTopLeftRadius, police: cs.fontSize, graisse: cs.fontWeight,
      marges: cs.paddingLeft + ' ' + cs.paddingRight, crochets: av.content, clicL: parseFloat(ap.width), clicH: parseFloat(ap.height), basGauche: p.classList.contains('wm-bas-gauche') };
  });
}
// Clic simple sur un point précis de l'écran, puis enregistrement du retour.
async function viserEtEnregistrer(page, x, y, texte) {
  await page.mouse.click(x, y);
  const ta = page.locator('.cm-popup textarea');
  await expect(ta).toBeVisible();
  await ta.fill(texte);
  await ta.press('Enter');
  await expect(page.locator('.cm-popup')).toHaveCount(0);
  await page.waitForTimeout(1400);   // l'onde du retour enregistré, puis le repos
}
const pres = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;

test('1. règle simple (carte) : cadre collé sans marge, crochets G dedans à 4 px, épingle de 24 px à cheval, sans crochets', async ({ page }) => {
  await ouvrir(page);
  const e = await boite(page, '#carte');
  await page.mouse.click(e.l + 6, e.t + 6);   // dans la marge intérieure de la carte : la carte elle-même
  await expect(page.locator('.cm-box-editing')).toHaveCount(1);
  const a = await mesureCadre(page, '.cm-box-editing');
  expect([a.l, a.t, a.r, a.b].map(Math.round)).toEqual([e.l, e.t, e.r, e.b].map(Math.round));
  expect(a.etau).toBe(false);
  expect(a.rayon).toBe('6px');
  expect(a.hg).toMatchObject({ gauche: 4, haut: 4, bras: 12, trait: 2, coude: '3px' });
  expect(a.bd).toMatchObject({ droite: 4, bas: 4, bras: 12, trait: 2, coude: '3px' });
  expect([a.hg.encre, a.bd.encre]).toEqual(['rgb(20, 20, 20)', 'rgb(20, 20, 20)']);   // #141414 sur fond clair
  await page.locator('.cm-popup textarea').fill('la carte');
  await page.locator('.cm-popup textarea').press('Enter');
  await page.waitForTimeout(1400);
  const c = await mesureCadre(page, '.cm-box-outline');
  expect([c.l, c.t, c.r, c.b].map(Math.round)).toEqual([e.l, e.t, e.r, e.b].map(Math.round));
  const p = await mesureEpingle(page);
  expect(p.h).toBe(24); expect(p.w).toBe(24);
  expect(pres(p.cx, c.r) && pres(p.cy, c.t)).toBe(true);                      // à cheval : son centre sur le coin haut droit
  expect(p.rayon).toBe('6px'); expect(p.police).toBe('13px'); expect(p.graisse).toBe('500'); expect(p.marges).toBe('7px 7px');
  expect(p.crochets).toBe('none');                                             // plus de crochets dans l'épingle
});

test('2. étau par la taille (pastille 18 px, case 16 px, icône 24 px) : crochets M 1 px dehors, cadre 3 px au-delà, épingle de 18 px décalée', async ({ page }) => {
  await ouvrir(page);
  for (const [sel, dehors] of [['#pastille', 0.30], ['#case', 0.30], ['#iconeMini', 0.25]]) {
    const e = await boite(page, sel);
    await viserEtEnregistrer(page, e.l + e.w / 2, e.t + e.h / 2, 'petit ' + sel);
  }
  const cadres = page.locator('.cm-box-outline');
  await expect(cadres).toHaveCount(3);
  for (const [k, sel, dehors] of [[0, '#pastille', 0.30], [1, '#case', 0.30], [2, '#iconeMini', 0.25]]) {
    const e = await boite(page, sel), c = await mesureCadre(page, `.cm-box-outline >> nth=${k}`);
    expect(c.etau && c.m, sel).toBe(true);
    // écart élément → cadre : 1 + trait 1,5 + 3 = 5,5 px de chaque côté
    expect(pres(c.l, e.l - 5.5) && pres(c.t, e.t - 5.5) && pres(c.r, e.r + 5.5) && pres(c.b, e.b + 5.5), sel).toBe(true);
    expect(c.hg, sel).toMatchObject({ gauche: 3, haut: 3, bras: 8, trait: 1.5, coude: '2px' });
    expect(c.bd, sel).toMatchObject({ droite: 3, bas: 3, bras: 8, trait: 1.5, coude: '2px' });
    // le trait du crochet s'arrête à 1 px de l'élément : jamais dessus
    expect(c.l + c.hg.gauche + c.hg.trait).toBeLessThanOrEqual(e.l - 1 + 0.01);
    const p = await mesureEpingle(page, k);
    expect(p.h, sel).toBe(18); expect(p.w, sel).toBe(18);
    expect(pres(p.cx, c.r + dehors * 18) && pres(p.cy, c.t - dehors * 18), sel + ' ' + JSON.stringify(p)).toBe(true);
    expect(p.rayon).toBe('5px'); expect(p.police).toBe('11px'); expect(p.marges).toBe('5px 5px');
  }
});

test('3. étau par l’arrondi (carte arrondie de 24 px, bouton rond de 40 px) : crochets G 1 px dehors, épingle de 24 px à cheval', async ({ page }) => {
  await ouvrir(page);
  for (const sel of ['#carteRonde', '#boutonRond']) {
    const e = await boite(page, sel);
    await viserEtEnregistrer(page, sel === '#carteRonde' ? e.l + 10 : e.l + e.w / 2, sel === '#carteRonde' ? e.b - 10 : e.t + e.h / 2, 'rond ' + sel);
  }
  for (const [k, sel] of [[0, '#carteRonde'], [1, '#boutonRond']]) {
    const e = await boite(page, sel), c = await mesureCadre(page, `.cm-box-outline >> nth=${k}`);
    expect(c.etau, sel).toBe(true); expect(c.m, sel).toBe(false);
    expect(pres(c.l, e.l - 6) && pres(c.t, e.t - 6) && pres(c.r, e.r + 6) && pres(c.b, e.b + 6), sel).toBe(true);   // 1 + 2 + 3
    expect(c.hg, sel).toMatchObject({ gauche: 3, haut: 3, bras: 12, trait: 2, coude: '3px' });
    const p = await mesureEpingle(page, k);
    expect(p.h).toBe(24);
    expect(pres(p.cx, c.r) && pres(p.cy, c.t), sel).toBe(true);
  }
});

test('4. seuils : 31 px de côté → étau, 32 px → règle simple ; arrondi de 16 px → règle simple, 17 px → étau ; champ et liste de 36 px → règle simple', async ({ page }) => {
  await ouvrir(page);
  const essai = async (sel, style) => {
    await page.locator(sel).evaluate((el, s) => Object.assign(el.style, s), style);
    const e = await boite(page, sel);
    await page.mouse.click(e.l + 5, e.t + e.h / 2);
    await expect(page.locator('.cm-box-editing')).toHaveCount(1);
    const c = await mesureCadre(page, '.cm-box-editing');
    await page.keyboard.press('Escape');
    await expect(page.locator('.cm-popup')).toHaveCount(0);
    return c.etau;
  };
  expect(await essai('#champ', { height: '31px' })).toBe(true);
  expect(await essai('#champ', { height: '32px' })).toBe(false);
  expect(await essai('#carte', { borderRadius: '16px' })).toBe(false);
  expect(await essai('#carte', { borderRadius: '17px' })).toBe(true);
  expect(await essai('#champ', { height: '36px' })).toBe(false);
  expect(await essai('#liste', {})).toBe(false);
});

test('5. point (clic sans élément) : étau autour d’un point invisible de 8 px, crochets M, épingle de 18 px décalée de 0,30', async ({ page }) => {
  await ouvrir(page);
  const x = 14, y = 420;   // marge du corps de la page : aucun élément
  await page.mouse.click(x, y);
  await expect(page.locator('.cm-box-editing.cm-box-point')).toHaveCount(1);
  const a = await mesureCadre(page, '.cm-box-editing');
  expect(a.etau && a.m).toBe(true);
  expect(pres(a.l, x - 4 - 5.5) && pres(a.t, y - 4 - 5.5) && pres(a.r, x + 4 + 5.5) && pres(a.b, y + 4 + 5.5)).toBe(true);
  await page.locator('.cm-popup textarea').fill('un point');
  await page.locator('.cm-popup textarea').press('Enter');
  await page.waitForTimeout(1400);
  const c = await mesureCadre(page, '.cm-box-outline.cm-box-point');
  expect(pres(c.l, x - 9.5) && pres(c.b, y + 9.5)).toBe(true);
  const p = await mesureEpingle(page);
  expect(p.h).toBe(18);
  expect(pres(p.cx, c.r + 5.4) && pres(p.cy, c.t - 5.4)).toBe(true);
});

test('6. zone tracée : règle simple, cadre exactement sur le tracé, crochets G à 4 px, épingle de 24 px à cheval ; poignées en traits à 4 px', async ({ page }) => {
  await ouvrir(page);
  const v = await boite(page, '#videGauche');
  const x1 = Math.round(v.l + 40), y1 = Math.round(v.t + 40), x2 = x1 + 160, y2 = y1 + 100;
  await H.drag(page, x1, y1, x2, y2);
  await expect(page.locator('.cm-popup')).toHaveCount(1);
  const a = await mesureCadre(page, '.cm-box-editable');
  expect([a.l, a.t, a.r, a.b].map(Math.round)).toEqual([x1, y1, x2, y2]);
  expect(a.etau).toBe(false);
  expect(a.hg).toMatchObject({ gauche: 4, haut: 4, bras: 12, trait: 2, coude: '3px' });
  // poignées : trait de 12 × 2 px au milieu de chaque côté, à 4 px du bord ; petit crochet de 8 px (1,5 px, coude 2) dans les coins libres
  const g = await page.locator('.cm-box-editable').evaluate((b) => {
    const br = b.getBoundingClientRect(), m = (d) => { const h = b.querySelector('.cm-handle-' + d), r = h.getBoundingClientRect(), s = getComputedStyle(h, '::after');
      const x = r.left + r.width / 2 + parseFloat(s.marginLeft), y = r.top + r.height / 2 + parseFloat(s.marginTop);
      return { x: x - br.left, y: y - br.top, w: parseFloat(s.width), h: parseFloat(s.height), trait: Math.abs(parseFloat((/(-?[\d.]+)px\s+(-?[\d.]+)px\s+0px\s+0px\s+inset/.exec(s.boxShadow) || [])[1])), coude: s.borderTopRightRadius !== '0px' ? s.borderTopRightRadius : s.borderBottomLeftRadius }; };
    return { n: m('n'), w: m('w'), ne: m('ne'), sw: m('sw'), largeur: br.width, hauteur: br.height };
  });
  expect(g.n.y).toBe(4); expect(g.n.w).toBe(12); expect(g.n.h).toBe(2);
  expect(g.w.x).toBe(4); expect(g.w.w).toBe(2); expect(g.w.h).toBe(12);
  expect(g.ne.w).toBe(8); expect(g.ne.trait).toBe(1.5); expect(g.ne.coude).toBe('2px');
  expect(g.ne.x + g.ne.w).toBe(g.largeur - 4); expect(g.ne.y).toBe(4);
  expect(g.sw.x).toBe(4); expect(g.sw.y + g.sw.h).toBe(g.hauteur - 4);
  await page.locator('.cm-popup textarea').fill('une zone');
  await page.locator('.cm-popup textarea').press('Enter');
  await page.waitForTimeout(1400);
  const c = await mesureCadre(page, '.cm-box-saved:not(.cm-box-outline)');
  expect([c.l, c.t, c.r, c.b].map(Math.round)).toEqual([x1, y1, x2, y2]);
  const p = await mesureEpingle(page);
  expect(p.h).toBe(24);
  expect(pres(p.cx, c.r) && pres(p.cy, c.t)).toBe(true);
});

test('7. R23 : une zone tracée garde sa place par rapport à ce qui la contient quand la page rétrécit (liste ouverte, fenêtre plus étroite), même tracée dans le vide', async ({ page }) => {
  await ouvrir(page);
  // a) dans un bloc fluide ; b) à cheval sur la marge du corps : aucun élément ne la contient, c'est le corps.
  const v = await boite(page, '#videGauche');
  await H.drag(page, v.l + 40, v.t + 40, v.l + 200, v.t + 140);
  await page.locator('.cm-popup textarea').fill('zone dans un bloc');
  await page.locator('.cm-popup textarea').press('Enter');
  await H.drag(page, 12, v.t + 160, v.l + 120, v.t + 230);
  await page.locator('.cm-popup textarea').fill('zone dans le vide');
  await page.locator('.cm-popup textarea').press('Enter');
  await page.waitForTimeout(1400);
  const enregistres = await H.stored(page, KEY);
  expect(enregistres.map((c) => c.anchor.path)).not.toContain(null);
  // dans le vide : ancrée à l'élément sous son centre (le bloc vide de gauche), comme la première
  expect(enregistres[1].anchor.path).toBe(enregistres[0].anchor.path);
  // Place de chaque zone par rapport au bloc qui l'ancre, telle qu'elle est dessinée : en part de sa largeur, en px de son haut.
  const parts = () => page.evaluate(() => [...document.querySelectorAll('.cm-box-saved:not(.cm-box-outline)')].map((b) => {
    const c = document.getElementById('videGauche').getBoundingClientRect(), r = b.getBoundingClientRect();
    return [(r.left - c.left) / c.width, (r.right - c.left) / c.width, r.top - c.top];
  }));
  const avant = await parts();
  const proche = (a, b) => a.every((z, k) => z.every((x, i) => Math.abs(x - b[k][i]) <= (i < 2 ? 0.005 : 1)));
  // La page s'élargit (witmit replié) puis rétrécit de nouveau (witmit rouvert, la liste pousse la page).
  await H.deactivate(page);
  await H.activate(page);
  expect(proche(await parts(), avant), JSON.stringify([avant, await parts()])).toBe(true);
  // La fenêtre rétrécit : les zones se recalculent et restent sur ce qu'elles visent.
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.waitForTimeout(500);
  expect(proche(await parts(), avant), JSON.stringify([avant, await parts()])).toBe(true);
  const b = await page.evaluate(() => { const z = document.querySelector('.cm-box-saved:not(.cm-box-outline)').getBoundingClientRect(), v = document.getElementById('videGauche').getBoundingClientRect(); return z.left >= v.left && z.right <= v.right; });
  expect(b).toBe(true);
});

test('8. présélection au survol : cadre gris à 8 % sans crochets ni épingle (règle simple ou étau), surlignage orange à 14 % sur un paragraphe ; couche 818', async ({ page }) => {
  await ouvrir(page);
  const pre = page.locator('#cmPreselection');
  const e = await boite(page, '#carte');
  await page.mouse.move(e.l + 6, e.t + 6);
  await expect(pre).toHaveClass(/wm-visible/);
  await page.waitForTimeout(300);
  const a = await pre.evaluate((p) => { const r = p.getBoundingClientRect(), cs = getComputedStyle(p), av = getComputedStyle(p, '::before');
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, fond: cs.backgroundColor, contour: cs.boxShadow, rayon: cs.borderTopLeftRadius, z: cs.zIndex, cible: p.dataset.cible, avant: av.content, opacite: cs.opacity }; });
  expect([a.l, a.t, a.r, a.b].map(Math.round)).toEqual([e.l, e.t, e.r, e.b].map(Math.round));
  expect(a.fond).toBe('rgba(128, 128, 128, 0.08)');
  expect(a.contour).toBe('rgba(0, 0, 0, 0.3) 0px 0px 0px 1px inset');
  expect(a.rayon).toBe('6px'); expect(a.z).toBe('818'); expect(a.cible).toBe('element'); expect(a.avant).toBe('none'); expect(a.opacite).toBe('1');
  await expect(page.locator('.cm-pin')).toHaveCount(0);
  // petit élément : même étau que la sélection
  const s = await boite(page, '#pastille');
  await page.mouse.move(s.l + 9, s.t + 9);
  await page.waitForTimeout(300);
  const b = await pre.evaluate((p) => { const r = p.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  expect(pres(b.l, s.l - 5.5) && pres(b.t, s.t - 5.5) && pres(b.r, s.r + 5.5) && pres(b.b, s.b + 5.5), JSON.stringify([b, s])).toBe(true);
  // paragraphe : surlignage orange à 14 % de ses lignes, le cadre s'efface
  const q = await boite(page, '#para1');
  await page.mouse.move(q.l + 30, q.t + 8);
  await page.waitForTimeout(300);
  const t = await pre.evaluate((p) => { const cs = getComputedStyle(p), l = p.querySelectorAll('.wm-ligne'); return { cible: p.dataset.cible, fond: cs.backgroundColor, contour: cs.boxShadow, lignes: l.length, couleur: l.length ? getComputedStyle(l[0]).backgroundColor : '', rayon: l.length ? getComputedStyle(l[0]).borderTopLeftRadius : '' }; });
  expect(t.cible).toBe('texte');
  expect(t.fond).toBe('rgba(0, 0, 0, 0)'); expect(t.contour).toBe('none');
  expect(t.lignes).toBeGreaterThan(1);
  expect(t.couleur).toBe('rgba(247, 130, 26, 0.14)'); expect(t.rayon).toBe('3px');
});

test('9. présélection : glisse d’un élément à l’autre (160 ms ease-out, fondu 120 ms), saute si les animations sont réduites', async ({ page }) => {
  await ouvrir(page);
  const pre = page.locator('#cmPreselection');
  const a = await boite(page, '#carte'), b = await boite(page, '#carteRonde');
  await page.mouse.move(a.l + 6, a.t + 6);
  await page.waitForTimeout(300);
  const tr = await pre.evaluate((p) => { const cs = getComputedStyle(p); return { prop: cs.transitionProperty, duree: cs.transitionDuration, courbe: cs.transitionTimingFunction }; });
  const props = tr.prop.split(', '), durees = tr.duree.split(', '), courbes = tr.courbe.split(', ');
  for (const pr of ['left', 'top', 'width', 'height']) { const i = props.indexOf(pr); expect(durees[i]).toBe('0.16s'); expect(courbes[i]).toBe('ease-out'); }
  expect(durees[props.indexOf('opacity')]).toBe('0.12s');
  await page.mouse.move(b.l + 10, b.b - 10);
  await page.waitForTimeout(60);
  const milieu = await pre.evaluate((p) => p.getBoundingClientRect().left);
  expect(milieu).toBeGreaterThan(a.l + 1); expect(milieu).toBeLessThan(b.l - 6 - 1);   // en route
  await page.waitForTimeout(300);
  expect(Math.round(await pre.evaluate((p) => p.getBoundingClientRect().left))).toBe(Math.round(b.l - 6));
  // Animations réduites : saut, sans glissement.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.mouse.move(a.l + 6, a.t + 6);
  await page.waitForTimeout(60);
  expect(Math.round(await pre.evaluate((p) => p.getBoundingClientRect().left))).toBe(Math.round(a.l));
  expect(await pre.evaluate((p) => getComputedStyle(p).transitionProperty)).toBe('none');
});

test('10. présélection masquée : au-dessus de la liste et d’une épingle, pendant un tracé, fenêtre ouverte (elle laisse place à la sélection), au doigt', async ({ page }) => {
  await ouvrir(page);
  const pre = page.locator('#cmPreselection');
  const e = await boite(page, '#carte');
  await page.mouse.move(e.l + 6, e.t + 6);
  await expect(pre).toHaveClass(/wm-visible/);
  // au-dessus de la liste
  const l = await boite(page, '#cmPanel');
  await page.mouse.move(l.l + 100, l.t + 300);
  await expect(pre).not.toHaveClass(/wm-visible/);
  // fenêtre ouverte : la présélection laisse place à la sélection (critère 14)
  await page.mouse.move(e.l + 6, e.t + 6);
  await expect(pre).toHaveClass(/wm-visible/);
  await page.mouse.click(e.l + 6, e.t + 6);
  await expect(page.locator('.cm-popup')).toHaveCount(1);
  await expect(pre).not.toHaveClass(/wm-visible/);
  await expect(page.locator('.cm-box-editing')).toHaveCount(1);
  await page.mouse.move(e.l + 20, e.t + 20);
  await page.waitForTimeout(100);
  await expect(pre).not.toHaveClass(/wm-visible/);
  await page.locator('.cm-popup textarea').fill('la carte');
  await page.locator('.cm-popup textarea').press('Enter');
  await page.waitForTimeout(1400);
  // au-dessus d'une épingle
  const p = await mesureEpingle(page);
  await page.mouse.move(p.cx, p.cy);
  await page.waitForTimeout(100);
  await expect(pre).not.toHaveClass(/wm-visible/);
  // pendant un tracé
  const v = await boite(page, '#videGauche');
  await page.mouse.move(v.l + 30, v.t + 30);
  await expect(pre).toHaveClass(/wm-visible/);
  await page.mouse.down();
  await page.mouse.move(v.l + 120, v.t + 90, { steps: 6 });
  await expect(pre).not.toHaveClass(/wm-visible/);
  await page.mouse.up();
  await page.keyboard.press('Escape');
  // au doigt
  await page.mouse.move(e.l + 6, e.t + 6);
  await expect(pre).toHaveClass(/wm-visible/);
  await page.evaluate(({ x, y }) => { const t = document.elementFromPoint(x, y); t.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'touch', clientX: x, clientY: y })); }, { x: e.l + 6, y: e.t + 6 });
  await expect(pre).not.toHaveClass(/wm-visible/);
});

test('11. clic sur un paragraphe ou un titre : pris comme passage de texte (ce que montrait la présélection)', async ({ page }) => {
  await ouvrir(page);
  for (const sel of ['#para2', '#titre']) {
    const q = await boite(page, sel);
    await page.mouse.click(q.l + 20, q.t + q.h / 2);
    await expect(page.locator('.cm-popup')).toHaveCount(1);
    await expect(page.locator(sel + ' mark.cm-highlight')).toHaveCount(1);
    await page.locator('.cm-popup textarea').fill('le texte ' + sel);
    await page.locator('.cm-popup textarea').press('Enter');
    await expect(page.locator('.cm-popup')).toHaveCount(0);
  }
  const c = await H.stored(page, KEY);
  expect(c.map((x) => x.type)).toEqual(['text', 'text']);
  expect(c[0].quote).toBe(await page.locator('#para2').evaluate((el) => el.textContent.trim()));
});

test('12. passage de texte : surligné en orange (26 %, 42 % actif, 12 % traité), débord d’1 px, multiply ; crochets P au début et à la fin ; plus de soulignement ; le texte ne bouge pas', async ({ page }) => {
  await ouvrir(page);
  const q = await boite(page, '#para1');
  // le mot « cadre » : sa place avant le surlignage
  const mot = () => page.evaluate(() => { const n = document.getElementById('para1'), w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let x;
    while ((x = w.nextNode())) { const i = x.textContent.indexOf('cadre'); if (i >= 0) { const r = document.createRange(); r.setStart(x, i); r.setEnd(x, i + 5); const b = r.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; } } });
  const avant = await mot();
  await page.mouse.dblclick(avant.l + 8, avant.t + (avant.b - avant.t) / 2);
  await expect(page.locator('.cm-popup')).toHaveCount(1);
  await page.locator('.cm-popup textarea').fill('ce mot');
  await page.locator('.cm-popup textarea').press('Enter');
  await page.waitForTimeout(1400);
  const apres = await mot();
  expect([apres.l, apres.t, apres.r, apres.b]).toEqual([avant.l, avant.t, avant.r, avant.b]);   // le texte ne bouge pas
  const m = await page.locator('mark.cm-highlight').evaluate((el) => { const cs = getComputedStyle(el), av = getComputedStyle(el, '::before'), ap = getComputedStyle(el, '::after');
    return { fond: cs.backgroundColor, rayon: cs.borderTopLeftRadius, pad: cs.paddingLeft + ' ' + cs.paddingRight, marge: cs.marginLeft + ' ' + cs.marginRight, melange: cs.mixBlendMode, souligne: cs.textDecorationLine,
      av: { g: av.left, h: av.top, bras: av.width, trait: av.boxShadow.replace(/^rgba?\([^)]*\)\s*/, ''), coude: av.borderTopLeftRadius, op: av.opacity }, ap: { d: ap.right, b: ap.bottom, bras: ap.width, trait: ap.boxShadow.replace(/^rgba?\([^)]*\)\s*/, ''), coude: ap.borderBottomRightRadius, op: ap.opacity } }; });
  expect(m.fond).toBe('rgba(247, 130, 26, 0.26)');
  expect(m.rayon).toBe('3px'); expect(m.pad).toBe('1px 1px'); expect(m.marge).toBe('-1px -1px'); expect(m.melange).toBe('multiply'); expect(m.souligne).toBe('none');
  // crochets P : 3 px avant le premier caractère (padding 1 + 2), 1,5 px au-dessus ; 3 px après le dernier, 1,5 px dessous ; à 75 %
  expect(m.av).toEqual({ g: '-2px', h: '-1.5px', bras: '6px', trait: '1.5px 1.5px 0px 0px inset', coude: '2px', op: '0.75' });
  expect(m.ap).toEqual({ d: '-2px', b: '-1.5px', bras: '6px', trait: '-1.5px -1.5px 0px 0px inset', coude: '2px', op: '0.75' });
  // épingle de 18 px au bout du passage : coin haut droit du surlignage de la dernière ligne, décalée de 0,40
  const z = await page.locator('mark.cm-highlight').evaluate((el) => { const r = [...el.getClientRects()].pop(); return { r: r.right, t: r.top }; });
  const p = await mesureEpingle(page);
  expect(p.h).toBe(18);
  expect(pres(p.cx, z.r + 7.2) && pres(p.cy, z.t - 7.2), JSON.stringify([p, z])).toBe(true);
  // actif : 42 %, crochets pleins
  await page.locator('.cm-pin').hover();
  await page.locator('.cm-pin').click();
  await expect(page.locator('.cm-popup')).toHaveCount(1);
  const actif = await page.locator('mark.cm-highlight').evaluate((el) => ({ fond: getComputedStyle(el).backgroundColor, op: getComputedStyle(el, '::before').opacity }));
  expect(actif).toEqual({ fond: 'rgba(247, 130, 26, 0.42)', op: '1' });
  await page.keyboard.press('Escape');
  // traité : 12 %, sans crochets
  const traite = await page.locator('mark.cm-highlight').evaluate((el) => { el.classList.add('cm-done'); const r = { fond: getComputedStyle(el).backgroundColor, av: getComputedStyle(el, '::before').content }; el.classList.remove('cm-done'); return r; });
  expect(traite).toEqual({ fond: 'rgba(247, 130, 26, 0.12)', av: 'none' });
});

test('13. passage de texte : triple-clic un paragraphe, maj+glisser un passage ; sur site sombre 36 %, sans multiply', async ({ page }) => {
  await ouvrir(page);
  const q = await boite(page, '#para2');
  await page.mouse.click(q.l + 30, q.t + q.h / 2, { clickCount: 3 });
  await expect(page.locator('.cm-popup')).toHaveCount(1);
  await expect(page.locator('#para2 mark.cm-highlight')).toHaveCount(1);
  expect((await page.locator('#para2 mark.cm-highlight').textContent()).trim()).toBe((await page.locator('#para2').textContent()).trim());
  await page.keyboard.press('Escape');
  await expect(page.locator('mark.cm-highlight')).toHaveCount(0);
  const p1 = await boite(page, '#para1');
  await H.drag(page, p1.l + 4, p1.t + 10, p1.l + 220, p1.t + 10, { shift: true });
  await expect(page.locator('.cm-popup')).toHaveCount(1);
  await expect(page.locator('#para1 mark.cm-highlight')).toHaveCount(1);
  await page.keyboard.press('Escape');
  // site sombre
  await page.evaluate(() => { document.body.style.background = '#14161a'; document.body.style.color = '#ece8e1'; });
  await page.mouse.dblclick(p1.l + 20, p1.t + 10);
  await expect(page.locator('.cm-popup')).toHaveCount(1);
  await page.locator('.cm-popup textarea').fill('sur fond sombre');
  await page.locator('.cm-popup textarea').press('Enter');
  await page.waitForTimeout(1400);
  const m = await page.locator('mark.cm-highlight').evaluate((el) => ({ fond: getComputedStyle(el).backgroundColor, melange: getComputedStyle(el).mixBlendMode, encre: getComputedStyle(el, '::before').boxShadow.replace(/\)\s.*$/, ')') }));
  expect(m).toEqual({ fond: 'rgba(247, 130, 26, 0.36)', melange: 'normal', encre: 'rgb(244, 244, 244)' });
});

test('14. épingle : zone cliquable de 24 px à la souris (même à 18 px), voyant de 4 px (3 px à 18 px) à 3 px du haut et de la droite ; épingles secondaires de 18 px sans voyant', async ({ page }) => {
  await ouvrir(page);
  const c = await boite(page, '#carte'), s = await boite(page, '#pastille');
  await viserEtEnregistrer(page, c.l + 6, c.t + 6, 'grande');
  await viserEtEnregistrer(page, s.l + 9, s.t + 9, 'petite');
  const zones = await page.locator('.cm-pin').evaluateAll((ps) => ps.map((p) => { const a = getComputedStyle(p, '::after'); return [parseFloat(a.width), parseFloat(a.height)]; }));
  expect(zones).toEqual([[24, 24], [24, 24]]);
  // un clic à 2,5 px hors du dessin de l'épingle de 18 px l'ouvre encore (zone de 24 px)
  const p = await mesureEpingle(page, 1);
  await page.mouse.click(p.cx + 9 + 2.5, p.cy);
  await expect(page.locator('.cm-popup')).toHaveCount(1);
  await page.keyboard.press('Escape');
  // voyant « nouveau » : posé à la main sur les deux épingles pour mesurer
  const v = await page.locator('.cm-pin').evaluateAll((ps) => ps.map((p) => { const i = document.createElement('i'); i.className = 'wm-voyant-epingle'; p.appendChild(i);
    const r = i.getBoundingClientRect(), b = p.getBoundingClientRect(), o = { taille: r.width, haut: r.top - b.top, droite: b.right - r.right, fond: getComputedStyle(i).backgroundColor, cerne: getComputedStyle(i).boxShadow }; i.remove(); return o; }));
  expect(v).toEqual([{ taille: 4, haut: 3, droite: 3, fond: 'rgb(247, 130, 26)', cerne: 'none' }, { taille: 3, haut: 3, droite: 3, fond: 'rgb(247, 130, 26)', cerne: 'none' }]);
  // sélection multiple : épingle secondaire de 18 px, jamais de voyant
  const b = await boite(page, '#boutonRond'), k = await boite(page, '#carteRonde');
  await page.mouse.click(k.l + 10, k.b - 10);
  await expect(page.locator('.cm-popup')).toHaveCount(1);
  await page.keyboard.down(H.IS_MAC ? 'Meta' : 'Control');
  await page.mouse.click(b.l + 20, b.t + 20);
  await page.keyboard.up(H.IS_MAC ? 'Meta' : 'Control');
  await page.locator('.cm-popup textarea').fill('deux éléments');
  await page.locator('.cm-popup textarea').press('Enter');
  await page.waitForTimeout(1400);
  const sec = await page.locator('.cm-pin.cm-pin-secondary').evaluate((p) => ({ h: p.getBoundingClientRect().height, police: getComputedStyle(p).fontSize, voyant: !!p.querySelector('.wm-voyant-epingle') }));
  expect(sec).toEqual({ h: 18, police: '11px', voyant: false });
});

test('15. épingle : zone cliquable de 44 px au doigt (pointeur grossier)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(H.fileUrl(PAGE));
  await H.clearStorage(page);
  await page.evaluate(() => localStorage.setItem('witmit_selection_v1', JSON.stringify([
    { id: 'a1', type: 'pin', status: 'nouveau', page: 'selection.html', zone: 'pastille', text: 'petite', date: new Date().toISOString(), anchor: { path: 'body > div:nth-of-type(1) > span:nth-of-type(1)', relX: 1, relY: 0 } },
    { id: 'a2', type: 'pin', status: 'nouveau', page: 'selection.html', zone: 'carte', text: 'grande', date: new Date().toISOString(), anchor: { path: 'body > div:nth-of-type(1) > div:nth-of-type(1)', relX: 1, relY: 0 } }])));
  await page.reload();
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
  await page.evaluate(() => window.cmToggle(true));
  await expect(page.locator('.cm-pin')).toHaveCount(2);
  const zones = await page.locator('.cm-pin').evaluateAll((ps) => ps.map((p) => { const a = getComputedStyle(p, '::after'); return [parseFloat(a.width), parseFloat(a.height)]; }));
  expect(zones).toEqual([[44, 44], [44, 44]]);
  await ctx.close();
});
