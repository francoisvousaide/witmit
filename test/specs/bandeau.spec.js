// Le halo du mode annotation (fiche Bandeau ; 0.4.0, spec sujet 8 : trait de 1,5 px sans filet, lueur qui respire de 0,2
// à 1 sans s'éteindre) ; le bandeau est retiré (fiche Bandeau, 0.4.0 : la liste ouverte dit déjà que witmit est actif ; son
// absence est vérifiée dans bouton-gestes.spec.js) ; plus quatre corrections de la liste reportées du lot 4 de 0.3.0 (É4, É5,
// nom de la liste vide, scroll-padding).
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const LONG = 'Le titre est trop collé au menu, il manque de l’air au-dessus et la ligne déborde largement de la liste';
function retour(id, page, extra) {
  const now = new Date().toISOString();
  return Object.assign({ id, type: 'pin', status: 'nouveau', page, zone: 'Cellule ' + id, text: LONG + ' (' + id + ')', date: now, vuLe: now,
    category: 'a-classer', fallback: { x: 40, y: 40 } }, extra || {});
}
async function semer(page, nom, cle, retours) {
  await page.goto(H.fileUrl(nom));
  await page.evaluate(([k, l]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(l)); }, [cle, retours]);
  await page.reload();
}
async function ouvrirListe(page) {
  await H.ouvrirListe(page);
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await page.waitForTimeout(400);
}
// Couleur d'un pixel de l'écran.
async function pixel(page, x, y) {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = 1; c.height = 1; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    return Array.from(x.getImageData(0, 0, 1, 1).data.slice(0, 3));
  }, png.toString('base64'));
}
const orange = ([r, g, b]) => r > 200 && g > 90 && g < 170 && b < 90;

test.describe('Halo (fiche Bandeau)', () => {
  test('H1. trait orange de 1,5 px sans filet, lueur courte à 38 % et lueur à 55 % qui respire ; la page seule : il s’arrête au bord de la liste', async ({ page }) => {
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await page.waitForTimeout(400);                                       // fin du fondu d'apparition et de la sortie de la liste
    const v = await page.evaluate(() => {
      const el = document.getElementById('cmFrame'), cs = getComputedStyle(el);
      return { position: cs.position, clics: cs.pointerEvents, avant: getComputedStyle(el, '::before').boxShadow, apres: getComputedStyle(el, '::after').boxShadow,
        f: el.getBoundingClientRect().toJSON(), l: document.getElementById('cmPanel').getBoundingClientRect().toJSON(), vh: window.innerHeight };
    });
    expect(v.position).toBe('fixed');
    expect(v.clics).toBe('none');
    expect(v.avant).toBe('rgb(247, 130, 26) 0px 0px 0px 1.5px inset, rgba(247, 130, 26, 0.38) 0px 0px 12px 2px inset');
    expect(v.apres).toBe('rgba(247, 130, 26, 0.55) 0px 0px 44px 12px inset');
    expect([v.f.left, v.f.top, v.f.bottom]).toEqual([0, 0, v.vh]);
    expect(v.f.right).toBeCloseTo(v.l.left, 0);                           // il s'arrête au bord de la liste
    // À l'écran : orange sur le trait du bord, à gauche et contre la liste ; rien d'orange dans la liste.
    expect(orange(await pixel(page, 0, 400)), 'bord gauche').toBe(true);
    expect(orange(await pixel(page, Math.round(v.l.left) - 1, 400)), 'bord de la page, contre la liste').toBe(true);
    expect(orange(await pixel(page, Math.round(v.l.left) + 2, 400)), 'dans la liste').toBe(false);
    expect(orange(await pixel(page, Math.round(v.l.right) - 2, 400)), 'bord droit de la liste').toBe(false);
  });

  test('H2. respiration : 4 s par souffle, ease-in-out, opacité 0,2 → 1 → 0,2 sans fin (elle ne s’éteint jamais) ; animations réduites : lueur fixe à 0,6', async ({ page }) => {
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.activate(page);
    const a = await page.evaluate(() => {
      const el = document.getElementById('cmFrame'), cs = getComputedStyle(el, '::after');
      const anim = document.getAnimations().find((x) => x.effect && x.effect.target === el && x.effect.pseudoElement === '::after');
      return { duree: cs.animationDuration, rythme: cs.animationTimingFunction, fois: cs.animationIterationCount,
        opacites: anim ? anim.effect.getKeyframes().map((k) => [k.offset, k.opacity]) : null };
    });
    expect(a).toEqual({ duree: '4s', rythme: 'ease-in-out', fois: 'infinite', opacites: [[0, '0.2'], [0.5, '1'], [1, '0.2']] });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const fixe = await page.evaluate(() => {
      const el = document.getElementById('cmFrame'), cs = getComputedStyle(el, '::after');
      return { nom: cs.animationName, opacite: cs.opacity, anims: document.getAnimations().filter((x) => x.effect && x.effect.target === el).length };
    });
    expect(fixe).toEqual({ nom: 'none', opacite: '0.6', anims: 0 });
  });
});

test.describe('Liste : corrections reportées du lot 4', () => {
  test('É4. Entrée sur une ligne atteinte par Tab mais pas encore choisie : elle est choisie et ouverte en une fois ; Entrée de nouveau la referme', async ({ page }) => {
    const nom = 'tellus-accueil.html';
    const signale = { status: 'signale', signaledAt: new Date().toISOString() };
    await semer(page, nom, 'witmit_tellus_v1', ['a', 'b', 'c'].map((id) => retour(id, nom, signale)));
    await ouvrirListe(page);
    await page.locator('#cmPanel .cm-hide-done').focus();
    await page.keyboard.press('Tab');
    const premiere = page.locator('.cm-panel-item').first();
    await expect(premiere).toBeFocused();
    await expect(premiere).not.toHaveAttribute('aria-current', 'true');      // atteinte, pas choisie
    await page.keyboard.press('Enter');
    await expect(premiere).toHaveAttribute('aria-current', 'true');
    await expect(premiere).toHaveClass(/wm-ouvert/);
    await expect(premiere.locator(':scope > .cm-etat-lu')).toHaveText(', choisi, ouvert');
    await expect(page.locator('.cm-panel-item.wm-ouvert')).toHaveCount(1);
    await page.keyboard.press('Enter');                                      // c1 : Entrée referme, il reste choisi
    await expect(premiere).not.toHaveClass(/wm-ouvert/);
    await expect(premiere).toHaveAttribute('aria-current', 'true');
  });

  test('É5. état vide (0.4.0) : « vise un élément de la page : », le deux-points ne passe jamais seul à la ligne, quelle que soit la largeur', async ({ page }) => {
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.clearStorage(page); await page.reload();
    await ouvrirListe(page);
    const p = page.locator('#cmList .cm-vide-mode');
    await expect(p).toHaveText('pour en laisser un, vise un élément de la page\u00a0:');   // fiche Tiroir, mot pour mot
    const coupures = await p.evaluate((e) => {
      const t = e.firstChild, r = document.createRange();
      r.setStart(t, t.data.indexOf('page')); r.setEnd(t, t.data.length);
      const fautes = [];
      for (let w = 90; w <= 330; w++) {
        e.style.width = w + 'px';
        const lignes = new Set(Array.from(r.getClientRects()).map((q) => Math.round(q.top)));
        if (lignes.size !== 1) fautes.push(w);
      }
      e.style.width = '';
      return fautes;
    });
    expect(coupures).toEqual([]);
  });

  // 0.4.0 (liste par page) : la zone des pages est une région nommée pour tout le site ; chaque page a sa liste nommée.
  test('aria-label : liste vide, ni rôle de liste ni nom de liste ; avec des retours, la liste de la page a son rôle et son nom', async ({ page }) => {
    const nom = 'tellus-accueil.html';
    await page.goto(H.fileUrl(nom));
    await H.clearStorage(page); await page.reload();
    await ouvrirListe(page);
    const zone = page.locator('#cmList');
    await expect(zone).toHaveAttribute('role', 'region');
    await expect(zone).toHaveAccessibleName('tes retours sur ce site, page par page');
    await expect(page.locator('#cmList [role="list"]')).toHaveCount(0);
    await semer(page, nom, 'witmit_tellus_v1', [retour('a', nom)]);
    await ouvrirListe(page);
    const liste = page.locator('#cmList .cm-page-ici .cm-page-lignes');
    await expect(liste).toHaveAttribute('role', 'list');
    await expect(liste).toHaveAccessibleName('tes retours sur cette page');
  });

  // 0.4.0 (liste par page) : la zone des pages défile seule ; la ligne choisie garde 10 px d'air (la marge des blocs) en haut et en bas.
  test('scroll-padding : la ligne choisie au clavier garde de l’air au bord de la zone qui défile, en bas comme en haut', async ({ page }) => {
    const nom = 'tellus-accueil.html';
    const ids = Array.from({ length: 18 }, (_, i) => 'r' + i);
    await semer(page, nom, 'witmit_tellus_v1', ids.map((id) => retour(id, nom, { status: 'signale', signaledAt: new Date().toISOString() })));
    await ouvrirListe(page);
    expect(await page.locator('#cmList').evaluate((e) => [getComputedStyle(e).scrollPaddingTop, getComputedStyle(e).scrollPaddingBottom])).toEqual(['10px', '10px']);
    const ecarts = () => page.evaluate(() => {
      const l = document.getElementById('cmList').getBoundingClientRect(), c = document.querySelector('.cm-panel-item[aria-current="true"]').getBoundingClientRect();
      return { haut: c.top - l.top, bas: l.bottom - c.bottom };
    });
    let defile = false;
    for (let i = 0; i < ids.length; i++) {
      await page.keyboard.press('ArrowDown');
      const e = await ecarts();
      expect(e.bas, `ligne ${i + 1}, en descendant`).toBeGreaterThanOrEqual(3.5);
      if (await page.locator('#cmList').evaluate((el) => el.scrollTop > 0)) defile = true;
    }
    expect(defile).toBe(true);                                               // la liste a bien défilé
    for (let i = 0; i < ids.length - 1; i++) {
      await page.keyboard.press('ArrowUp');
      const e = await ecarts();
      expect(e.haut, `en remontant`).toBeGreaterThanOrEqual(3.5);
    }
  });
});
