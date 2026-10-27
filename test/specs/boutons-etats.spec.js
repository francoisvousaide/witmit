// Habillage V2, lot 8 : boutons ronds au thème du site (fiche BoutonWitmit), états (fiche Etats), et les corrections
// renvoyées à ce lot par les relectures des lots 2 à 7 (flou du verre, aide du champ en sombre, liserés, contraste forcé,
// encre des crochets, placement de la fenêtre, liste et boutons sous 480 px, viseur liste ouverte).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const WIDGET_URL = 'file://' + path.join(path.resolve(__dirname, '..', '..', 'src'), 'witmit.js');
// Page d'essai écrite à la volée (dossier temporaire du système), qui charge le vrai witmit.js.
function pageEssai(nom, { fond = '#ffffff', corps = '<div class="bloc" id="bloc">Un bloc de la page d’essai.</div>', css = '', attrs = '' } = {}) {
  const dir = path.join(os.tmpdir(), 'witmit-tests');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, nom + '.html');
  fs.writeFileSync(f, `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${nom}</title>
<style>body{margin:0;background:${fond};color:${fond === '#ffffff' ? '#222' : '#ddd'};font-family:Georgia,serif;} .bloc{margin:80px;padding:40px;border:1px solid #888;} ${css}</style>
</head><body>${corps}
<script src="${WIDGET_URL}" data-project="essai-${nom}" ${attrs}></script></body></html>`);
  return 'file://' + f;
}
// Lit une capture PNG dans la page (canvas) et renvoie ses pixels.
async function pixels(page, png) {
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return { w: img.width, h: img.height, d: Array.from(g.getImageData(0, 0, img.width, img.height).data) };
  }, png.toString('base64'));
}
async function ouvrirFenetreSur(page, selecteur) {
  await H.activate(page);
  const b = await H.visibleBox(page, selecteur);
  await page.mouse.click(b.x + Math.min(40, b.width / 2), b.y + Math.min(10, b.height / 2));
  await expect(page.locator('.cm-popup textarea')).toBeVisible();
  await page.waitForTimeout(400);
}

test.describe('A1. Boutons ronds (fiche BoutonWitmit)', () => {
  // Métal d'un bouton : son dégradé (palier haut), son trait, son signe ; l'ombre dit l'enfoncement.
  const metal = (page, sel) => page.locator(sel).evaluate((el) => { const cs = getComputedStyle(el); return { fond: cs.backgroundImage, trait: cs.borderTopColor, signe: cs.color, ombre: cs.boxShadow }; });

  for (const [nom, fond, clair] of [['rond-site-clair', '#ffffff', true], ['rond-site-sombre', '#121212', false]]) {
    test(`métal au thème du site (${clair ? 'clair sur un site clair' : 'sombre sur un site sombre'}) ; l'état se lit à l'enfoncement, jamais à la teinte ; voyant orange`, async ({ page }) => {
      await page.goto(pageEssai(nom, { fond }));
      await H.clearStorage(page); await page.reload();
      const haut = clair ? 'rgb(250, 250, 250)' : 'rgb(92, 92, 92)';          // metal-light-hi / metal-dark-hi
      for (const sel of ['#cmPanelBtn', '#cmToggleBtn']) {
        const leve = await metal(page, sel);
        expect(leve.fond, sel).toContain('linear-gradient(165deg, ' + haut);
        expect(leve.trait, sel).toBe(clair ? 'rgb(111, 111, 111)' : 'rgb(10, 10, 10)');
        expect(leve.signe, sel).toBe(clair ? 'rgb(20, 20, 20)' : 'rgb(244, 244, 244)');
        expect(leve.ombre, sel).not.toContain('0px 3px 6px 0px inset');          // levé : pas d'ombre d'enfoncement
        // Survol : rien ne change de teinte (fiche : l'état ne se lit jamais à la teinte).
        await page.locator(sel).hover();
        expect((await metal(page, sel)).fond, sel + ' survol').toBe(leve.fond);
        await page.mouse.move(5, 5);
      }
      // Enfoncés : liste ouverte (bouton witmit), mode lancé (bouton annotation) ; même dégradé, ombre d'enfoncement.
      const levePanel = await metal(page, '#cmPanelBtn');
      await page.locator('#cmPanelBtn').click();
      await expect(page.locator('#cmPanelBtn')).toHaveAttribute('aria-expanded', 'true');
      const enfonce = await metal(page, '#cmPanelBtn');
      expect(enfonce.fond).toBe(levePanel.fond);
      expect(enfonce.ombre).toContain('0px 3px 6px 0px inset');
      await page.locator('#cmPanelBtn').click();
      const leveMode = await metal(page, '#cmToggleBtn');
      await H.activate(page);
      const modeEnfonce = await metal(page, '#cmToggleBtn');
      expect(modeEnfonce.fond).toBe(leveMode.fond);
      expect(modeEnfonce.ombre).toContain('0px 3px 6px 0px inset');
      // Voyant « nouveau » : orange, 7 px ; cerne intérieur de 1,5 px seulement sur le métal clair.
      await page.locator('#cmCount').evaluate((v) => { v.removeAttribute('data-zero'); v.textContent = '1'; });
      const voyant = await page.locator('#cmCount').evaluate((v) => { const cs = getComputedStyle(v), r = v.getBoundingClientRect(); return { fond: cs.backgroundColor, w: r.width, ombre: cs.boxShadow }; });
      expect(voyant.fond).toBe('rgb(247, 130, 26)');
      expect(voyant.w).toBe(7);
      expect(voyant.ombre).toBe(clair ? 'rgb(10, 10, 10) 0px 0px 0px 1.5px inset' : 'none');
    });
  }

  test('boutons fournis par la page (C8) : le même métal au thème du site, enfoncés sans changer de teinte', async ({ page }) => {
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.clearStorage(page); await page.reload();
    const leve = await metal(page, '#cmPanelBtn');
    expect(leve.fond).toContain('linear-gradient(165deg, rgb(250, 250, 250)');   // site clair : métal clair
    await page.locator('#cmPanelBtn').click();
    const enfonce = await metal(page, '#cmPanelBtn');
    expect(enfonce.fond).toBe(leve.fond);
    expect(enfonce.ombre).toContain('0px 3px 6px 0px inset');
    await page.locator('#cmPanelBtn').click();
    // Site passé en sombre : métal sombre.
    await page.locator('#themeBtn').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.getAttribute('body', 'data-wm-theme')).toBe('client-sombre');
    expect((await metal(page, '#cmToggleBtn')).fond).toContain('linear-gradient(165deg, rgb(92, 92, 92)');
  });
});

test.describe('A2. États (fiche Etats)', () => {
  test('focus clavier des boutons ronds : contour de 2 px à 2 px, à l’encre qui tranche sur le site ; le rouge ne colore que l’icône', async ({ page }) => {
    for (const [nom, fond, encre] of [['focus-rond-clair', '#ffffff', 'rgb(20, 20, 20)'], ['focus-rond-sombre', '#121212', 'rgb(244, 244, 244)']]) {
      await page.goto(pageEssai(nom, { fond }));
      await H.clearStorage(page); await page.reload();
      await page.locator('#cmToggleBtn').focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      const f = await page.locator('#cmToggleBtn').evaluate((el) => { const cs = getComputedStyle(el); return [cs.outlineStyle, cs.outlineWidth, cs.outlineOffset, cs.outlineColor]; });
      expect(f, nom).toEqual(['solid', '2px', '2px', encre]);
    }
  });
});

test.describe('B. Corrections renvoyées au lot 8', () => {
  // Écart de pixels sous une zone : page montrée, puis page cachée (visibility). Sous un verre qui floute, l'écart reste
  // faible et diffus ; un texte net à travers le verre donne des milliers de pixels très différents.
  async function ecartSous(page, clip, cacher) {
    const avec = await pixels(page, await page.screenshot({ clip }));
    await page.evaluate((s) => document.querySelectorAll(s).forEach((e) => { e.style.visibility = 'hidden'; }), cacher);
    const sans = await pixels(page, await page.screenshot({ clip }));
    await page.evaluate((s) => document.querySelectorAll(s).forEach((e) => { e.style.visibility = ''; }), cacher);
    let max = 0, nets = 0;
    for (let i = 0; i < avec.d.length; i += 4) {
      const e = Math.abs(avec.d[i] - sans.d[i]) + Math.abs(avec.d[i + 1] - sans.d[i + 1]) + Math.abs(avec.d[i + 2] - sans.d[i + 2]);
      if (e > max) max = e;
      if (e > 40) nets++;
    }
    return { max, nets };
  }

  for (const theme of ['clair', 'sombre']) {
    test(`B1. flou du verre sur une page dont le body s’anime en opacité (${theme}) : aucun texte de la page lisible sous la fenêtre, bas compris ; couches de witmit hors de body`, async ({ page }) => {
      await page.goto(H.fileUrl('tellus-accueil.html'));                 // body : animation page-fade 240 ms « both »
      await H.clearStorage(page); await page.reload();
      if (theme === 'sombre') await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
      await page.waitForTimeout(700);
      await ouvrirFenetreSur(page, '.mcard-title');
      expect(await page.getAttribute('body', 'data-wm-theme')).toBe(theme === 'clair' ? 'client-clair' : 'client-sombre');
      // Structure : chaque verre (fenêtres, bandeau, messages, épingles) vit dans la racine de witmit, enfant de <html>, jamais
      // dans <body> ; la liste aussi (renvoi : même racine que le bandeau, pour l’ordre de tabulation et le rang des repères).
      const s = await page.evaluate(() => ({
        racine: document.getElementById('wmRacine').parentNode === document.documentElement,
        dansBody: Array.from(document.querySelectorAll('.wm-verre, .cm-pin, .cm-popup, #cmPanel, #cmPill, #cmStatus, .cm-fab, #cmFrame')).filter((v) => document.body.contains(v)).length,
        etat: document.getElementById('wmRacine').classList.contains('cm-active') && document.getElementById('wmRacine').getAttribute('data-wm-theme') === document.body.getAttribute('data-wm-theme'),
      }));
      expect(s).toEqual({ racine: true, dansBody: 0, etat: true });
      // À l'écran : toute la fenêtre, du haut jusqu'au bas.
      const r = await page.locator('.cm-popup').boundingBox();
      const e = await ecartSous(page, { x: Math.ceil(r.x), y: Math.ceil(r.y), width: Math.floor(r.width), height: Math.floor(r.height) }, '.page');
      expect(e.nets, 'pixels nets de la page sous le verre').toBe(0);
      expect(e.max).toBeLessThanOrEqual(40);
    });
  }

  // Contraste du texte d'aide (ink-faint, 60 %) au pire pixel : sa couleur posée sur chaque pixel du fond du champ (aide
  // cachée), contre ce même pixel.
  async function pireContrasteAide(page) {
    await page.addStyleTag({ content: '.cm-popup .wm-champ > textarea::placeholder { color:transparent !important; } .cm-popup .wm-champ > textarea { caret-color:transparent; }' });
    await page.locator('.cm-popup textarea').blur();
    const z = await page.locator('.cm-popup textarea').evaluate((t) => {
      const r = t.getBoundingClientRect(), probe = document.createElement('i'); probe.style.color = 'var(--wm-ink-faint)'; t.parentNode.appendChild(probe);
      const c = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number); probe.remove();
      return { r: r.toJSON(), aide: c };
    });
    // La zone où s'écrit l'aide : l'intérieur du champ, marges comprises (9 × 12 px), sans son trait ni ses coins arrondis.
    const clip = { x: Math.ceil(z.r.x) + 12, y: Math.ceil(z.r.y) + 9, width: Math.floor(z.r.width) - 24, height: Math.floor(z.r.height) - 18 };
    const p = await pixels(page, await page.screenshot({ clip }));
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const a = z.aide[3];
    let pire = Infinity;
    for (let i = 0; i < p.d.length; i += 4) {
      const fond = [p.d[i], p.d[i + 1], p.d[i + 2]], texte = [0, 1, 2].map((k) => z.aide[k] * a + fond[k] * (1 - a));
      const l1 = lum(texte), l2 = lum(fond), c = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (c < pire) pire = c;
    }
    return pire;
  }
  for (const [nom, aller] of [
    ['planche sombre #14161a', (page) => page.goto(pageEssai('aide-sombre', { fond: '#14161a' }))],
    ['dashboard, ligne du tableau', (page) => page.goto(H.fileUrl('generic-dashboard.html'))],
    ['dashboard, tuile #313244', (page) => page.goto(H.fileUrl('generic-dashboard.html'))],
    ['site clair', (page) => page.goto(pageEssai('aide-clair', { fond: '#ffffff' }))],
    ['TellUs clair', (page) => page.goto(H.fileUrl('tellus-accueil.html'))],
  ]) {
    test(`B2. texte d’aide du champ à au moins 4,6:1 au pire pixel, ombre et lueur hors de la face (${nom})`, async ({ page }) => {
      await aller(page);
      await H.clearStorage(page); await page.reload();
      await page.waitForTimeout(500);
      const cible = nom.includes('ligne') ? 'tbody tr:first-child td:nth-child(2)' : nom.includes('tuile') ? '.kpi-tile .kpi-value' : nom.includes('TellUs') ? '.mcard-title' : '#bloc';
      await ouvrirFenetreSur(page, cible);
      const pire = await pireContrasteAide(page);
      expect(pire, nom).toBeGreaterThanOrEqual(4.6);
      // L'ombre (clair) ou la lueur (sombre) reste là, portée par le verre : 34 % ou 22 %, glissée de 22 px, flou de 56 px.
      const ombre = await page.locator('.cm-popup > .wm-verre').evaluate((v) => getComputedStyle(v).boxShadow);
      expect(ombre).toMatch(/rgba\((0, 0, 0, 0\.34|255, 255, 255, 0\.22)\) 0px 22px 56px 0px/);
    });
  }

  test('B3. liseré des boutons gris en clair : 0,5 px tracé en ombre intérieure, sans border (aucun en sombre)', async ({ page }) => {
    await page.goto(pageEssai('lisere-clair', { fond: '#ffffff' }));
    await H.clearStorage(page); await page.reload();
    await ouvrirFenetreSur(page, '#bloc');
    const f = await page.locator('.cm-popup .cm-cancel').evaluate((b) => { const cs = getComputedStyle(b, '::before'); return { ombre: cs.boxShadow, trait: cs.borderTopWidth }; });
    expect(f).toEqual({ ombre: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 0.5px inset', trait: '0px' });
  });

  test('B4. contraste forcé : un cadre actif (fenêtre ouverte, zone en édition) garde un contour plein de 1 px à la couleur du texte', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto(pageEssai('force-cadre', { fond: '#ffffff' }));
    await H.clearStorage(page); await page.reload();
    await ouvrirFenetreSur(page, '#bloc');
    const c = await page.locator('.cm-box.cm-box-editing > .wm-cadre').evaluate((el) => { const cs = getComputedStyle(el); return [cs.outlineStyle, cs.outlineWidth]; });
    expect(c).toEqual(['solid', '1px']);
    await page.locator('.cm-popup textarea').fill('cadre actif');
    await page.locator('.cm-popup textarea').press('Enter');
    await page.locator('.cm-pin').first().hover();                       // survol de l'épingle : son cadre passe actif (cm-glow)
    const g = await page.locator('.cm-box-saved > .wm-cadre').first().evaluate((el) => { const cs = getComputedStyle(el); return [cs.outlineStyle, cs.outlineWidth]; });
    expect(g).toEqual(['solid', '1px']);
  });

  test('B5. une seule encre claire pour les repères : crochets du cadre et de l’épingle en #f4f4f4 sur fond sombre', async ({ page }) => {
    await page.goto(pageEssai('encre-sombre', { fond: '#121212' }));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, '#bloc', 'encre');
    await page.waitForTimeout(1400);
    await page.mouse.move(5, 5);
    const e = await page.evaluate(() => ({
      cadre: getComputedStyle(document.querySelector('.cm-box-saved > .wm-cadre'), '::before').borderTopColor,
      epingle: getComputedStyle(document.querySelector('.cm-pin'), '::before').borderTopColor,
    }));
    expect(e).toEqual({ cadre: 'rgb(244, 244, 244)', epingle: 'rgb(244, 244, 244)' });
  });

  test('B6. cerne du voyant de l’épingle et du bouton witmit : 1,5 px en ombre intérieure (plus de border arrondi à 1 px)', async ({ page }) => {
    await page.goto(H.fileUrl('planche-charte.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, '#boutonClair', 'voyant');
    const [c] = await H.stored(page, 'witmit_planche_v1');
    await H.retourColle(page, [c.id + ' pris_en_compte']);
    await page.waitForTimeout(1400);                                      // fin de l’onde ; le mode reste lancé, la liste ouverte
    await page.mouse.move(5, 5);
    const v = await page.evaluate(() => ['.cm-pin .wm-voyant-epingle', '#cmCount'].map((s) => { const cs = getComputedStyle(document.querySelector(s)); return [cs.boxShadow, cs.borderTopWidth]; }));
    for (const x of v) expect(x).toEqual(['rgb(10, 10, 10) 0px 0px 0px 1.5px inset', '0px']);
  });

  // Renvoi (Paula É1) : le bandeau du mode compte comme une épingle ; la page d'essai descend de 80 px pour que la place
  // « au-dessus » ne touche pas le bandeau.
  test('B7. placement de la fenêtre : une épingle ou le bandeau recouverts pèsent bien plus lourd qu’un bord de cadre recouvert', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 1000 });
    const corps = `<div id="dessus" style="position:absolute;left:80px;top:140px;width:440px;height:270px;background:#eee">Un grand bloc au-dessus.</div>
<div id="cible" style="position:absolute;left:80px;top:480px;width:220px;height:30px;background:#ddd">La cible du retour</div>
<div id="sous" style="position:absolute;left:80px;top:560px;width:120px;height:32px;background:#ccc">Petit</div>`;
    await page.goto(pageEssai('placement-epingle', { corps, css: 'body{min-height:1200px}' }));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, '#dessus', 'grand bloc');
    await H.addPin(page, '#sous', 'petit bloc');
    await page.waitForTimeout(1400);
    const b = await H.visibleBox(page, '#cible');
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(page.locator('.cm-popup textarea')).toBeVisible();
    const m = await page.evaluate(() => {
      const f = document.querySelector('.cm-popup').getBoundingClientRect(), touche = (q) => f.left < q.right && q.left < f.right && f.top < q.bottom && q.top < f.bottom;
      const epingles = Array.from(document.querySelectorAll('.cm-pin')).filter((p) => touche(p.getBoundingClientRect())).length;
      const cible = document.getElementById('cible').getBoundingClientRect();
      return { epingles, auDessus: f.bottom <= cible.top, bandeau: touche(document.getElementById('cmPill').getBoundingClientRect()) };
    });
    expect(m).toEqual({ epingles: 0, auDessus: true, bandeau: false });  // au-dessus, sur le bord du grand cadre, plutôt que sur l'épingle du petit
  });

  test('Paula É1. la fenêtre ne recouvre pas le bandeau du mode ni « terminer », même quand l’autre place recouvre le bord d’un grand cadre', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    const corps = `<div id="cible" style="position:absolute;left:80px;top:400px;width:220px;height:30px;background:#ddd">La cible du retour</div>
<div id="grand" style="position:absolute;left:80px;top:520px;width:440px;height:200px;background:#eee">Un grand bloc au-dessous.</div>`;   // au-dessus : seul le bandeau ; dessous : le bord du grand cadre
    await page.goto(pageEssai('placement-bandeau', { corps, css: 'body{min-height:1200px}' }));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, '#grand', 'grand bloc');
    await page.waitForTimeout(1400);
    const b = await H.visibleBox(page, '#cible');
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(page.locator('.cm-popup textarea')).toBeVisible();
    const m = await page.evaluate(() => {
      const f = document.querySelector('.cm-popup').getBoundingClientRect(), touche = (q) => f.left < q.right && q.left < f.right && f.top < q.bottom && q.top < f.bottom;
      const t = document.querySelector('#cmPill .wm-terminer').getBoundingClientRect(), dessus = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2);
      return { bandeau: touche(document.getElementById('cmPill').getBoundingClientRect()), terminerLibre: !!(dessus && dessus.closest('.wm-terminer')) };
    });
    expect(m).toEqual({ bandeau: false, terminerLibre: true });
  });

  test('B8. sous 480 px, liste ouverte pleine largeur : arrondi 0, aucun filet contre le bord ; au-dessus, arrondie côté page avec son filet', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('#cmPanel')).toHaveClass(/show/);
    const lire = () => page.locator('#cmPanel > .wm-verre').evaluate((v) => ({ rayon: getComputedStyle(v).borderRadius, filet: getComputedStyle(v).boxShadow }));
    expect(await lire()).toEqual({ rayon: '0px', filet: 'none' });
    await page.setViewportSize({ width: 1280, height: 800 });
    expect(await lire()).toEqual({ rayon: '9px 0px 0px 9px', filet: 'rgba(255, 255, 255, 0.12) 1px 0px 0px 0px inset' });
  });

  // Renvoi : la liste vit dans la racine de witmit ; witmit prend les deux boutons de la page dans un bloc à lui le temps que
  // la liste couvre l'écran, puis les rend à leur place exacte ; le bloc de la page n'est jamais touché.
  test('B9. boutons ronds fournis par la page, sous 480 px, liste ouverte : par-dessus la liste, au-dessus de son pied, cliquables ; rendus tels quels liste fermée', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.clearStorage(page); await page.reload();
    const bloc = (p) => p.locator('.mock-controls').evaluate((m) => ({ z: getComputedStyle(m).zIndex, bas: getComputedStyle(m).bottom, style: m.getAttribute('style'),
      enfants: Array.from(m.children).map((e) => e.id || e.className) }));
    const avant = await bloc(page);
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('#cmPanel')).toHaveClass(/show/);
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const pied = document.getElementById('cmPanelPied').getBoundingClientRect();
      return ['#cmToggleBtn', '#cmPanelBtn'].map((s) => {
        const b = document.querySelector(s), r = b.getBoundingClientRect(), dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { cliquable: !!(dessus && dessus.closest(s)), auDessusDuPied: r.bottom <= pied.top + 0.5, visible: r.right <= window.innerWidth && r.left >= 0 };
      });
    });
    for (const x of m) expect(x).toEqual({ cliquable: true, auDessusDuPied: true, visible: true });
    // Le viseur se clique vraiment : il lance le mode (et ferme la liste, comme ⌥+A).
    await page.locator('#cmToggleBtn').click();
    await expect(page.locator('body')).toHaveClass(/cm-active/);
    await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
    expect(await bloc(page)).toEqual(avant);                               // mêmes boutons, même ordre, même style
    expect(avant.enfants).toEqual(['cmToggleBtn', 'cmPanelBtn', 'themeBtn']);
  });

  for (const nom of ['generic-dashboard.html', 'tellus-accueil.html']) {
    test(`B10. liste ouverte, mode arrêté : un clic sur le viseur lance le mode du premier coup (${nom})`, async ({ page }) => {
      await page.goto(H.fileUrl(nom));
      await H.clearStorage(page); await page.reload();
      await page.locator('#cmPanelBtn').click();
      await expect(page.locator('#cmPanel')).toHaveClass(/show/);
      await page.waitForTimeout(300);
      const b = await page.locator('#cmToggleBtn').boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await expect(page.locator('body')).toHaveClass(/cm-active/);
      await expect(page.locator('#cmToggleBtn')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#cmFrame')).toHaveClass(/show/);
    });
  }

  test('B11. liste ouverte : le bandeau se pose sur la liste dès qu’il lui reste moins de 24 px d’air de chaque côté (≈ sous 628 px) ; centré au-dessus', async ({ page }) => {
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('#cmPanel')).toHaveClass(/show/);
    for (const w of [596, 604, 612, 620, 640, 700]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(80);
      const m = await page.evaluate(() => {
        const p = document.getElementById('cmPill'), vw = document.documentElement.clientWidth, pageVue = vw - document.getElementById('cmPanel').offsetWidth;
        const r = p.getBoundingClientRect();
        return { sur: p.classList.contains('wm-sur-liste'), gauche: r.left, droite: pageVue - r.right, pageVue };
      });
      if (w < 628) expect(m.sur, `${w} px`).toBe(true);
      else { expect(m.sur, `${w} px`).toBe(false); expect(Math.min(m.gauche, m.droite), `${w} px`).toBeGreaterThanOrEqual(24 - 1); }
    }
  });
});

test.describe('Renvoi du lot 8 (relectures de Paula et de Léa)', () => {
  const LONG = 'Le titre est trop collé au menu, il manque de l’air au-dessus et la ligne déborde largement de la liste';
  const retour = (id, page, extra) => { const now = new Date().toISOString(); return Object.assign({ id, type: 'pin', status: 'nouveau', page, zone: 'Cellule ' + id,
    text: LONG + ' (' + id + ')', date: now, vuLe: now, category: 'a-classer', fallback: { x: 40, y: 40 } }, extra || {}); };
  async function semer(page, nom, cle, retours) {
    await page.goto(H.fileUrl(nom));
    await page.evaluate(([k, l]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(l)); }, [cle, retours]);
    await page.reload();
  }
  // Ce que le point central d'un élément touche vraiment (elementFromPoint).
  const repond = (page, sel) => page.locator(sel).evaluate((el) => { const r = el.getBoundingClientRect(), d = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(d && (d === el || el.contains(d))); });

  for (const [nom, cle] of [['tellus-accueil.html', 'witmit_tellus_v1'], ['generic-dashboard.html', 'witmit_kiosque_v1']]) {
    for (const w of [320, 375, 480]) {
      test(`Léa É1. ${w} px, ${nom} : encart ouvert, les boutons ronds se posent au-dessus de lui et un vrai clic sur « appliquer » applique ; la fin de la liste n’est jamais sous les boutons`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: 800 });
        await semer(page, nom, cle, ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => retour(id, nom)));
        await page.locator('#cmPanelBtn').click();
        await expect(page.locator('#cmPanel')).toHaveClass(/show/);
        await page.locator('#cmPasteBtn').click();
        await page.locator('#cmFeedbackBox textarea').fill('a resolu | Fait.');
        await page.waitForTimeout(150);
        const g = await page.evaluate(() => {
          const e = document.getElementById('cmFeedbackBox').getBoundingClientRect(), f = document.querySelector('.cm-fab').getBoundingClientRect();
          return { auDessus: f.bottom <= e.top + 0.5, droite: Math.round(window.innerWidth - f.right) };
        });
        expect(g).toEqual({ auDessus: true, droite: 16 });
        await page.locator('#cmFeedbackBox').getByRole('button', { name: 'appliquer' }).click();   // vrai clic, sans contournement
        await expect(page.locator('#cmFeedbackBox')).toBeHidden();
        await expect(page.locator('#cmPanel')).toHaveClass(/show/);
        expect((await H.stored(page, cle)).find((x) => x.id === 'a').status).toBe('resolu');
        // Le dernier retour, ouvert, au bas de la liste défilée : ses actions répondent au clic, rien ne les couvre.
        const derniere = page.locator('.cm-panel-item[data-id="f"]');
        await H.ouvrirRetour(page, derniere);
        await page.locator('#cmList').evaluate((l) => { l.scrollTop = l.scrollHeight; });
        await page.waitForTimeout(150);
        const actions = await derniere.locator('.cm-item-actions button').count();
        expect(actions).toBeGreaterThan(0);
        for (let i = 0; i < actions; i++) expect(await repond(page, `.cm-panel-item[data-id="f"] .cm-item-actions button >> nth=${i}`), `action ${i}`).toBe(true);
      });
    }
  }

  for (const nom of ['tellus-accueil.html', 'generic-dashboard.html']) {
    test(`Léa É2. ${nom}, 1280 px : un repère situé sous la liste reste invisible et non cliquable ; liste fermée, il revient`, async ({ page }) => {
      await page.goto(H.fileUrl(nom));
      await H.clearStorage(page); await page.reload();
      // Une rangée plus large que la page rétrécie (1 240 px) : son bout droit, et son épingle, restent sous la liste ouverte.
      await page.evaluate(() => { const w = document.createElement('div'); w.style.cssText = 'width:1240px;height:40px;margin:20px 0'; w.innerHTML = '<span id="loin" style="display:inline-block;margin-left:1140px;width:80px;height:30px;background:#ccc;color:#111">loin</span>'; const ref = document.querySelector('.modules-grid, .kpis, main') || document.body.firstChild; ref.parentNode.insertBefore(w, ref); const s = document.getElementById('loin'); s.style.marginLeft = (1140 - w.getBoundingClientRect().left) + 'px'; });   // sous la barre de navigation, bout droit à 1 140 px
      await H.activate(page);
      await H.addPin(page, '#loin', 'sous la liste');
      await page.waitForTimeout(1400);
      await page.locator('#cmPanelBtn').click();
      await expect(page.locator('#cmPanel')).toHaveClass(/show/);
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const p = document.querySelector('.cm-pin'), r = p.getBoundingClientRect(), l = document.getElementById('cmPanel').getBoundingClientRect();
        const d = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const calque = document.getElementById('wmReperes'), cs = getComputedStyle(calque);
        return { sousLaListe: r.left >= l.left, touche: !!(d && d.closest('.cm-pin')), dansLaListe: !!(d && d.closest('#cmPanel')), coupe: cs.overflowX, bord: Math.round(calque.getBoundingClientRect().right - l.left) };
      });
      expect(m).toEqual({ sousLaListe: true, touche: false, dansLaListe: true, coupe: 'clip', bord: 0 });
      await page.locator('#cmPanel .cm-panel-fermer').click();
      await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
      await page.waitForTimeout(500);                                       // la page reprend sa largeur, les repères sont redessinés
      expect(await page.locator('#wmReperes').evaluate((c) => getComputedStyle(c).overflowX)).toBe('visible');
      expect(await repond(page, '.cm-pin')).toBe(true);
    });
  }

  test('Léa É3. liste ouverte et mode lancé : « terminer » vient avant la liste dans l’ordre de tabulation, la région du mode avant celle de la liste', async ({ page }) => {
    await semer(page, 'tellus-accueil.html', 'witmit_tellus_v1', ['a', 'b'].map((id) => retour(id, 'tellus-accueil.html')));
    await H.activate(page);
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('#cmPanel')).toHaveClass(/show/);
    const ordre = await page.evaluate(() => {
      const t = document.querySelector('#cmPill .wm-terminer'), l = document.getElementById('cmPanel'), p = document.getElementById('cmPill');
      return { terminerAvant: !!(t.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING), regionAvant: !!(p.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING) };
    });
    expect(ordre).toEqual({ terminerAvant: true, regionAvant: true });
    // Au clavier : Tab depuis « terminer » entre dans la liste.
    await page.locator('#cmPill .wm-terminer').focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#cmPanel'))).toBe(true);
  });

  test('Paula É2. retour choisi et terminé : le numéro reste plein et son chiffre lisible (couleur du fond de la liste sur l’encre)', async ({ page }) => {
    for (const sombre of [false, true]) {
      await semer(page, 'tellus-accueil.html', 'witmit_tellus_v1', [retour('a', 'tellus-accueil.html', { status: 'resolu', resolvedAt: new Date().toISOString() })]);
      if (sombre) { await page.locator('#themeBtn').focus(); await page.keyboard.press('Enter'); await expect.poll(() => page.getAttribute('body', 'data-wm-theme')).toBe('client-sombre'); }
      await page.locator('#cmPanelBtn').click();
      await expect(page.locator('#cmPanel')).toHaveClass(/show/);
      const ligne = page.locator('.cm-panel-item[data-id="a"]');
      await ligne.locator('.zone').click();
      await expect(ligne).toHaveClass(/cm-current/);
      await expect(ligne).toHaveClass(/cm-done/);
      const n = await ligne.locator('.num').evaluate((el) => { const cs = getComputedStyle(el), f = getComputedStyle(document.getElementById('cmPanel')).getPropertyValue('--wm-liste-fond').trim();
        const p = document.createElement('i'); p.style.color = f; el.appendChild(p); const fond = getComputedStyle(p).color; p.remove();
        return { chiffre: cs.color, face: cs.backgroundColor, trait: cs.borderTopColor, fondListe: fond }; });
      expect(n.chiffre, sombre ? 'sombre' : 'clair').toBe(n.fondListe);
      expect(n.face).toBe(n.trait);
      expect(n.face).not.toBe(n.chiffre);
    }
  });

  test('Paula É3. sous 480 px, liste ouverte : les boutons ronds de witmit à 16 px du bord droit, au-dessus du pied (ou de l’encart)', async ({ page }) => {
    for (const w of [320, 375, 480]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto(H.fileUrl('generic-dashboard.html'));
      await H.clearStorage(page); await page.reload();
      await page.locator('#cmPanelBtn').click();
      await expect(page.locator('#cmPanel')).toHaveClass(/show/);
      await page.waitForTimeout(300);
      const g = await page.evaluate(() => {
        const f = document.querySelector('.cm-fab').getBoundingClientRect(), pied = document.getElementById('cmPanelPied').getBoundingClientRect();
        return { droite: Math.round(window.innerWidth - f.right), auDessusDuPied: f.bottom <= pied.top + 0.5 };
      });
      expect(g, `${w} px`).toEqual({ droite: 16, auDessusDuPied: true });
      for (const s of ['#cmToggleBtn', '#cmPanelBtn']) expect(await repond(page, s), `${w} px ${s}`).toBe(true);
    }
  });
});
