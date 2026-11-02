// Habillage V2, lot 8 : états (fiche Etats) et corrections renvoyées par les relectures des lots 2 à 7 (flou du verre, aide
// du champ en sombre, liserés, contraste forcé, encre des crochets, placement de la fenêtre). 0.4.0, lot 1 : les deux boutons
// ronds, le bandeau et la liste sous 480 px sont retirés ; leurs tests sont remplacés par bouton-gestes.spec.js (bouton
// unique au symbole, gestes, witmit désactivé sous 480 px).
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

test.describe('A2. États (fiche Etats)', () => {
  test('focus clavier du bouton witmit : contour de 2 px à 3 px du bord, à l’encre qui tranche sur le site', async ({ page }) => {
    for (const [nom, fond, encre] of [['focus-rond-clair', '#ffffff', 'rgb(20, 20, 20)'], ['focus-rond-sombre', '#121212', 'rgb(244, 244, 244)']]) {
      await page.goto(pageEssai(nom, { fond }));
      await H.clearStorage(page); await page.reload();
      await page.locator('#cmPanelBtn').focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      const f = await page.locator('#cmPanelBtn').evaluate((el) => { const cs = getComputedStyle(el); return [cs.outlineStyle, cs.outlineWidth, cs.outlineOffset, cs.outlineColor]; });
      expect(f, nom).toEqual(['solid', '2px', '3px', encre]);
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
      await page.addStyleTag({ content: '.cm-frame::after { animation: none !important; }' });   // 0.4.0 : le halo qui respire changerait entre les deux captures
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
      // (3 px de retrait : hors des coins arrondis de 9 px de la fenêtre, où la page se voit sans verre ; 0.4.0, le cadre
      // collé à l'élément rapproche la fenêtre du texte de la carte, qui passait sous ces coins.)
      const r = await page.locator('.cm-popup').boundingBox();
      const e = await ecartSous(page, { x: Math.ceil(r.x) + 3, y: Math.ceil(r.y) + 3, width: Math.floor(r.width) - 6, height: Math.floor(r.height) - 6 }, '.page');
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

  test('B5. une seule encre claire pour les repères : crochets du cadre et chiffre de l’épingle en #f4f4f4 sur fond sombre', async ({ page }) => {
    await page.goto(pageEssai('encre-sombre', { fond: '#121212' }));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, '#bloc', 'encre');
    await page.waitForTimeout(1400);
    await page.mouse.move(5, 5);
    const e = await page.evaluate(() => ({
      cadre: getComputedStyle(document.querySelector('.cm-box-saved > .wm-cadre'), '::before').borderTopColor,
      epingle: getComputedStyle(document.querySelector('.cm-pin')).color,   // 0.4.0 : plus de crochets dans l'épingle, son chiffre
    }));
    expect(e).toEqual({ cadre: 'rgb(244, 244, 244)', epingle: 'rgb(244, 244, 244)' });
  });

  test('B6. voyant de l’épingle sans cerne (0.4.0, fiche Epingle) ; le voyant du bouton witmit, posé sur le symbole, n’en a pas non plus', async ({ page }) => {
    await page.goto(H.fileUrl('planche-charte.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, '#boutonClair', 'voyant');
    const [c] = await H.stored(page, 'witmit_planche_v1');
    await H.retourColle(page, [c.id + ' pris_en_compte']);
    await page.waitForTimeout(1400);                                      // fin de l’onde ; le mode reste lancé, la liste ouverte
    await page.mouse.move(5, 5);
    const v = await page.evaluate(() => ['.cm-pin .wm-voyant-epingle', '#cmCount'].map((s) => { const cs = getComputedStyle(document.querySelector(s)); return [cs.boxShadow, cs.borderTopWidth]; }));
    expect(v).toEqual([['none', '0px'], ['none', '0px']]);
  });

  // 0.4.0 : witmit ouvert, la liste (340 px) pousse la page ; 940 px d'écran laissent 600 px à la page d'essai.
  test('B7. placement de la fenêtre : une épingle recouverte pèse bien plus lourd qu’un bord de cadre recouvert', async ({ page }) => {
    await page.setViewportSize({ width: 940, height: 1000 });
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
      return { epingles, auDessus: f.bottom <= cible.top };
    });
    expect(m).toEqual({ epingles: 0, auDessus: true });  // au-dessus, sur le bord du grand cadre, plutôt que sur l'épingle du petit
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
    test(`Léa É2. ${nom}, 1280 px : un repère situé sous la liste reste invisible et non cliquable`, async ({ page }) => {
      // 0.4.0 : witmit ouvert = liste et mode ensemble ; le repère est semé à 1 180 px du bord gauche de la page, sous la liste.
      await semer(page, nom, cle, [retour('a', nom, { zone: 'sous la liste', fallback: { x: 1180, y: 300 } })]);
      await H.activate(page);
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const p = document.querySelector('.cm-pin'), r = p.getBoundingClientRect(), l = document.getElementById('cmPanel').getBoundingClientRect();
        const d = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const calque = document.getElementById('wmReperes'), cs = getComputedStyle(calque);
        return { sousLaListe: r.left >= l.left, touche: !!(d && d.closest('.cm-pin')), dansLaListe: !!(d && d.closest('#cmPanel')), coupe: cs.overflowX, bord: Math.round(calque.getBoundingClientRect().right - l.left) };
      });
      expect(m).toEqual({ sousLaListe: true, touche: false, dansLaListe: true, coupe: 'clip', bord: 0 });
      await page.locator('#cmPanel .cm-panel-reduire').click();
      await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
      expect(await page.locator('#wmReperes').evaluate((c) => getComputedStyle(c).overflowX)).toBe('visible');
    });
  }

  test('Paula É2. retour choisi et terminé : le numéro reste plein et son chiffre lisible (couleur du fond de la liste sur l’encre)', async ({ page }) => {
    for (const sombre of [false, true]) {
      await semer(page, 'tellus-accueil.html', 'witmit_tellus_v1', [retour('a', 'tellus-accueil.html', { status: 'resolu', resolvedAt: new Date().toISOString() })]);
      if (sombre) { await page.locator('#themeBtn').focus(); await page.keyboard.press('Enter'); await expect.poll(() => page.getAttribute('body', 'data-wm-theme')).toBe('client-sombre'); }
      await H.ouvrirListe(page);
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

});

test('Lot 9. version : window.witmit.version, l’en-tête du widget, package.json et le titre du README disent 0.3.0', async ({ page }) => {
  const racine = path.resolve(__dirname, '..', '..');
  const paquet = JSON.parse(fs.readFileSync(path.join(racine, 'package.json'), 'utf8')).version;
  expect(paquet).toBe('0.3.0');
  await page.goto(pageEssai('lot9-version'));
  expect(await page.evaluate(() => window.witmit.version)).toBe(paquet);
  expect(fs.readFileSync(path.join(racine, 'src', 'witmit.js'), 'utf8').split('\n')[1]).toContain('witmit ' + paquet);
  expect(fs.readFileSync(path.join(racine, 'README.md'), 'utf8').split('\n')[0]).toContain('(' + paquet + ',');
});
