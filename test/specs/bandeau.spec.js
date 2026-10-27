// Habillage V2, lot 7 : le halo et le bandeau du mode annotation (fiche Bandeau ; décision b3 de François du 26/10 :
// le bandeau ne garde, partout, que la poignée, le voyant « annotation » et « terminer », sur une seule ligne, sans
// puce « échap ») ; plus quatre corrections de la liste reportées du lot 4 (É4, É5, nom de la liste vide, scroll-padding).
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
  await page.locator('#cmPanelBtn').click();
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
  test('H1. trait orange de 3 px, filet halo-filet de 1 px, lueur courte et lueur qui respire ; la page seule : il s’arrête au bord de la liste', async ({ page }) => {
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await page.waitForTimeout(300);                                       // fin du fondu d'apparition
    const v = await page.evaluate(() => {
      const el = document.getElementById('cmFrame'), cs = getComputedStyle(el);
      return { position: cs.position, clics: cs.pointerEvents, avant: getComputedStyle(el, '::before').boxShadow, apres: getComputedStyle(el, '::after').boxShadow,
        r: el.getBoundingClientRect().toJSON(), vw: document.documentElement.clientWidth, vh: window.innerHeight };
    });
    expect(v.position).toBe('fixed');
    expect(v.clics).toBe('none');
    expect(v.avant).toBe('rgb(247, 130, 26) 0px 0px 0px 3px inset, rgba(10, 10, 10, 0.9) 0px 0px 0px 4px inset, rgba(247, 130, 26, 0.42) 0px 0px 10px 2px inset');
    expect(v.apres).toBe('rgba(247, 130, 26, 0.4) 0px 0px 26px 6px inset');
    expect([v.r.left, v.r.top, v.r.right, v.r.bottom]).toEqual([0, 0, v.vw, v.vh]);   // liste fermée : tout l'écran
    // À l'écran : orange sur les 3 px du bord, côté gauche et côté droit.
    expect(orange(await pixel(page, 1, 400)), 'bord gauche').toBe(true);
    expect(orange(await pixel(page, v.vw - 2, 400)), 'bord droit').toBe(true);
    // Liste ouverte : le halo s'arrête au bord de la liste, rien d'orange dans la liste.
    await ouvrirListe(page);
    const r = await page.evaluate(() => ({ f: document.getElementById('cmFrame').getBoundingClientRect().toJSON(), l: document.getElementById('cmPanel').getBoundingClientRect().toJSON() }));
    expect(r.f.left).toBe(0);
    expect(r.f.right).toBeCloseTo(r.l.left, 0);
    expect(orange(await pixel(page, Math.round(r.l.left) - 2, 400)), 'bord de la page, contre la liste').toBe(true);
    expect(orange(await pixel(page, Math.round(r.l.left) + 2, 400)), 'dans la liste').toBe(false);
    expect(orange(await pixel(page, Math.round(r.l.right) - 2, 400)), 'bord droit de la liste').toBe(false);
  });

  test('H2. respiration : 4 s par souffle, ease-in-out, opacité 0 → 1 → 0 sans fin ; animations réduites : lueur fixe à mi-course', async ({ page }) => {
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.activate(page);
    const a = await page.evaluate(() => {
      const el = document.getElementById('cmFrame'), cs = getComputedStyle(el, '::after');
      const anim = document.getAnimations().find((x) => x.effect && x.effect.target === el && x.effect.pseudoElement === '::after');
      return { duree: cs.animationDuration, rythme: cs.animationTimingFunction, fois: cs.animationIterationCount,
        opacites: anim ? anim.effect.getKeyframes().map((k) => [k.offset, k.opacity]) : null };
    });
    expect(a).toEqual({ duree: '4s', rythme: 'ease-in-out', fois: 'infinite', opacites: [[0, '0'], [0.5, '1'], [1, '0']] });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const fixe = await page.evaluate(() => {
      const el = document.getElementById('cmFrame'), cs = getComputedStyle(el, '::after');
      return { nom: cs.animationName, opacite: cs.opacity, anims: document.getAnimations().filter((x) => x.effect && x.effect.target === el).length };
    });
    expect(fixe).toEqual({ nom: 'none', opacite: '0.5', anims: 0 });
  });
});

test.describe('Bandeau (fiche Bandeau, décision b3)', () => {
  // Ce que le bandeau montre : seulement la poignée, le voyant et « annotation », « terminer », sur une ligne.
  const lireBandeau = (page) => page.evaluate(() => {
    const pill = document.getElementById('cmPill'), r = pill.getBoundingClientRect();
    const corps = pill.querySelector('.wm-bandeau-corps');
    const visibles = Array.from(corps.children).filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
    const milieux = visibles.map((e) => { const q = e.getBoundingClientRect(); return Math.round(q.top + q.height / 2); });
    return { r: r.toJSON(), vw: document.documentElement.clientWidth,
      enfants: visibles.map((e) => e.classList.contains('wm-poignee') ? 'poignee' : e.classList.contains('wm-bandeau-mode') ? 'annotation' : e.classList.contains('wm-terminer') ? 'terminer' : e.className),
      texte: pill.innerText.replace(/\s+/g, ' ').trim(), uneLigne: new Set(milieux).size === 1, reperes: pill.querySelectorAll('.wm-repere').length };
  });

  for (const nom of ['tellus-accueil.html', 'generic-dashboard.html']) {
    test(`B1. une seule ligne, de 1 280 à 320 px : poignée, « annotation », « terminer », rien d'autre ; aucune puce « échap » (${nom})`, async ({ page }) => {
      await page.goto(H.fileUrl(nom));
      await H.clearStorage(page); await page.reload();
      await H.activate(page);
      for (const w of [1280, 1024, 900, 760, 600, 481, 480, 414, 375, 320]) {
        await page.setViewportSize({ width: w, height: 800 });
        await expect.poll(async () => { const q = await lireBandeau(page); return q.r.left >= 8 && q.r.right <= q.vw - 8; }, { message: `${w} px` }).toBe(true);   // replacé au redimensionnement
        const b = await lireBandeau(page);
        expect(b.enfants, `${w} px`).toEqual(['poignee', 'annotation', 'terminer']);
        expect(b.texte, `${w} px`).toBe('annotation terminer');
        expect(b.r.height, `${w} px`).toBe(44);
        expect(b.uneLigne, `${w} px`).toBe(true);
        expect(b.reperes, `${w} px`).toBe(0);
        expect(b.r.left, `${w} px`).toBeGreaterThanOrEqual(8);
        expect(b.r.right, `${w} px`).toBeLessThanOrEqual(b.vw - 8);
      }
    });
  }

  test('B2. « terminer » : bouton principal orange compact, face de 30 px, zone de 44 px ; Échap termine toujours', async ({ page }) => {
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    const t = await page.locator('#cmPill .wm-terminer').evaluate((el) => {
      const r = el.getBoundingClientRect(), f = getComputedStyle(el, '::before'), cs = getComputedStyle(el);
      const touche = (x, y) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('.wm-terminer') === el); };
      return { zone: r.height, face: r.height - parseFloat(f.top) - parseFloat(f.bottom), fond: f.backgroundColor, texte: cs.color, graisse: cs.fontWeight, rayon: f.borderTopLeftRadius,
        haut: touche(r.left + r.width / 2, r.top + 1), bas: touche(r.left + r.width / 2, r.bottom - 1), largeur: r.width >= 44, raccourci: el.getAttribute('aria-keyshortcuts') };
    });
    expect(t).toEqual({ zone: 44, face: 30, fond: 'rgb(247, 130, 26)', texte: 'rgb(255, 255, 255)', graisse: '500', rayon: '6px', haut: true, bas: true, largeur: true, raccourci: 'Escape' });
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/cm-active/);
    await expect(page.locator('#cmPill')).toBeHidden();
  });

  // Rien de witmit sous le bandeau : la tête de la liste, sa croix, ses retours, son bloc.
  const recouvrements = (page) => page.evaluate(() => {
    const p = document.getElementById('cmPill').getBoundingClientRect();
    const touche = (q) => q.width && q.height && p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
    const cibles = ['.cm-panel-head', '.cm-panel-fermer', '#cmList', '.cm-panel-item', '#cmPanelPied', '.cm-fab'];
    const fautes = [];
    cibles.forEach((s) => document.querySelectorAll(s).forEach((el) => { if (el.getClientRects().length && touche(el.getBoundingClientRect())) fautes.push(s); }));
    const croix = document.querySelector('.cm-panel-fermer').getBoundingClientRect();
    const dessus = document.elementFromPoint(croix.left + croix.width / 2, croix.top + croix.height / 2);
    const l = document.getElementById('cmPanel').getBoundingClientRect();
    return { fautes, croixLibre: !!(dessus && dessus.closest('.cm-panel-fermer')), p: p.toJSON(), l: l.toJSON() };
  });

  for (const w of [375, 320, 600, 700]) {
    test(`B3. ${w} px, liste ouverte et mode actif : le bandeau ne recouvre ni la tête de la liste, ni sa croix « fermer », ni ses retours`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      const nom = 'tellus-accueil.html';
      await semer(page, nom, 'witmit_tellus_v1', ['a', 'b', 'c'].map((id) => retour(id, nom)));
      await H.activate(page);
      await ouvrirListe(page);
      const r = await recouvrements(page);
      expect(r.fautes).toEqual([]);
      expect(r.croixLibre).toBe(true);
      expect(r.p.height).toBe(44);
      if (w < 628) {                                                      // sous 628 px (600 compris) : moins de 24 px d’air à côté de la liste, sur la liste (lot 8, Paula É4)
        // Posé en haut de la liste, de 8 px à 8 px de ses bords visibles (fiche Mobile).
        expect(r.p.top).toBe(8);
        expect(r.p.left).toBeGreaterThanOrEqual(r.l.left + 8 - 0.5);
        expect(r.p.right).toBeLessThanOrEqual(Math.min(r.l.right, w) - 8 + 0.5);
      } else {
        expect(r.p.right).toBeLessThanOrEqual(r.l.left);                   // assez large : il tient sur la page rétrécie (Paula É2), à gauche de la liste
      }
      // La croix se clique vraiment, et la liste fermée rend sa place au bandeau.
      await page.locator('#cmPanel .cm-panel-fermer').click();
      await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
      await expect(page.locator('#cmPanel')).not.toHaveClass(/wm-sous-bandeau/);
      const ferme = await page.locator('#cmPill').boundingBox();
      expect(ferme.height).toBe(44);
      expect(Math.abs(ferme.x + ferme.width / 2 - w / 2)).toBeLessThanOrEqual(10);   // revenu au centre
    });
  }

  // Encre du titre (h1) sous le bandeau : la zone du bandeau est capturée deux fois, bandeau et halo cachés, titre montré
  // puis titre caché ; les pixels qui changent sont l'encre du titre. Toujours mesurée, quelle que soit la place du
  // bandeau (lot 8 : plus de raccourci « le bandeau s'arrête au-dessus de la boîte du titre »).
  async function encreDuTitreSousLeBandeau(page) {
    const p = await page.locator('#cmPill').boundingBox();
    const vw = await page.evaluate(() => document.documentElement.clientWidth);
    const x = Math.max(0, Math.floor(p.x)), y = Math.max(0, Math.floor(p.y));
    const clip = { x, y, width: Math.min(Math.ceil(p.x + p.width), vw) - x, height: Math.ceil(p.y + p.height) - y };
    await page.evaluate(() => { const st = document.createElement('style'); st.id = 'essaiB4'; st.textContent = '#cmPill, #cmFrame { visibility:hidden !important; }'; document.head.appendChild(st); });
    const avec = await page.screenshot({ clip });
    await page.evaluate(() => { document.querySelector('h1').style.visibility = 'hidden'; });
    const sans = await page.screenshot({ clip });
    await page.evaluate(() => { document.querySelector('h1').style.visibility = ''; document.getElementById('essaiB4').remove(); });
    return page.evaluate(async ([a, b]) => {
      const lire = async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        return x.getImageData(0, 0, img.width, img.height).data; };
      const d1 = await lire(a), d2 = await lire(b);
      let n = 0;
      for (let i = 0; i < d1.length; i += 4) if (Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2]) > 30) n++;
      return n;
    }, [avec.toString('base64'), sans.toString('base64')]);
  }

  // Deux passes : police web de la page bloquée (police de repli), puis police laissée se charger. Aucune des deux n'est
  // présentée comme le pire cas : le titre ne doit jamais passer sous le bandeau.
  for (const polices of ['bloquées', 'chargées']) {
    test(`B4. le bandeau ne recouvre jamais l'encre du titre : liste fermée à 375 et 320 px ; liste ouverte de 560 à 760 px (polices ${polices})`, async ({ page }) => {
      if (polices === 'bloquées') await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto(H.fileUrl('tellus-accueil.html'));
      await H.clearStorage(page); await page.reload();
      await H.activate(page);
      await page.waitForTimeout(500);                                      // fin des animations d'entrée de la page
      for (const w of [375, 320]) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.waitForTimeout(150);
        expect(await encreDuTitreSousLeBandeau(page), `${w} px, liste fermée : pixels du titre sous le bandeau`).toBe(0);
      }
      await page.setViewportSize({ width: 760, height: 800 });
      await ouvrirListe(page);
      for (let w = 760; w >= 560; w -= 4) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.waitForTimeout(80);
        expect(await encreDuTitreSousLeBandeau(page), `${w} px, liste ouverte : pixels du titre sous le bandeau`).toBe(0);
      }
    });
  }
});

test.describe('Bandeau : corrections du renvoi', () => {
  for (const w of [1280, 900, 600, 375, 320]) {
    test(`Léa É1. ${w} px, liste ouverte : un appui sur la poignée ou « annotation » ne ferme pas la liste ; un clic sur « terminer » termine du premier coup, la liste reste ouverte`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      const nom = 'tellus-accueil.html';
      await semer(page, nom, 'witmit_tellus_v1', ['a', 'b'].map((id) => retour(id, nom)));
      await H.activate(page);
      await ouvrirListe(page);
      const centre = async (sel) => { const b = await page.locator(sel).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
      for (const sel of ['#cmPill .wm-poignee', '#cmPill .wm-bandeau-mode']) {
        const [x, y] = await centre(sel);
        await page.mouse.click(x, y);
        await page.waitForTimeout(300);
        await expect(page.locator('#cmPanel'), sel).toHaveClass(/show/);
        await expect(page.locator('body'), sel).toHaveClass(/cm-active/);
      }
      const [x, y] = await centre('#cmPill .wm-terminer');
      await page.mouse.click(x, y);
      await expect(page.locator('body')).not.toHaveClass(/cm-active/);
      await expect(page.locator('#cmPill')).toBeHidden();
      await expect(page.locator('#cmPanel')).toHaveClass(/show/);
    });
  }

  test('Léa É2. bandeau posé sur la liste : la poignée n’a pas d’info-bulle de déplacement ; elle revient mot pour mot quand il peut de nouveau bouger', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    const poignee = page.locator('#cmPill .wm-poignee');
    await expect(poignee).toHaveAttribute('title', 'glisse pour déplacer le bandeau');
    await ouvrirListe(page);
    await expect(page.locator('#cmPill')).toHaveClass(/wm-sur-liste/);
    expect(await poignee.getAttribute('title')).toBe(null);
    await page.locator('#cmPanel .cm-panel-fermer').click();
    await expect(page.locator('#cmPill')).not.toHaveClass(/wm-sur-liste/);
    await expect(poignee).toHaveAttribute('title', 'glisse pour déplacer le bandeau');
  });

  test('Paula É1. bandeau posé sur la liste : le coin witmit haut gauche de la liste se cache (celui du bas droit reste) ; ailleurs, les deux coins', async ({ page }) => {
    const coins = () => page.locator('#cmPanel > .wm-contour path').evaluateAll((ps) => ps.map((p) => getComputedStyle(p).display));
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    for (const w of [375, 320, 560]) {                                     // 560 px : page rétrécie trop étroite, bandeau sur la liste
      await page.setViewportSize({ width: w, height: 800 });
      await ouvrirListe(page);
      await expect(page.locator('#cmPanel')).toHaveClass(/wm-sous-bandeau/);
      expect(await coins(), `${w} px`).toEqual(['none', 'inline']);
      await page.locator('#cmPanel .cm-panel-fermer').click();
      await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await ouvrirListe(page);
    await expect(page.locator('#cmPanel')).not.toHaveClass(/wm-sous-bandeau/);
    expect(await coins()).toEqual(['inline', 'inline']);
  });

  test('Paula É2. liste ouverte, de 1 280 à 600 px : le bandeau est centré sur la page rétrécie ; il passe sur la liste dès qu’il lui reste moins de 24 px d’air de chaque côté (lot 8, Paula É4)', async ({ page }) => {
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await ouvrirListe(page);
    for (let w = 1280; w >= 600; w -= (w > 760 ? 80 : 4)) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(60);
      const m = await page.evaluate(() => {
        const p = document.getElementById('cmPill'), r = p.getBoundingClientRect(), vw = document.documentElement.clientWidth;
        const pageVue = vw - document.getElementById('cmPanel').offsetWidth;
        p.classList.remove('wm-sur-liste'); p.style.width = '';                 // largeur naturelle, mesurée puis rendue
        const naturelle = p.offsetWidth;
        window.dispatchEvent(new Event('resize'));
        return { centre: r.left + r.width / 2, pageVue, naturelle, surListe: document.getElementById('cmPill').classList.contains('wm-sur-liste') };
      });
      expect(m.surListe, `${w} px`).toBe(m.naturelle + 48 > m.pageVue);
      if (!m.surListe) expect(Math.abs(m.centre - m.pageVue / 2), `${w} px`).toBeLessThanOrEqual(1);
    }
  });

  test('Paula É3. sous 480 px, liste ouverte pleine largeur : le halo se cache ; il revient liste fermée ; au-dessus de 480 px, il reste autour de la page', async ({ page }) => {
    const halo = () => page.locator('#cmFrame').evaluate((el) => getComputedStyle(el).visibility);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    expect(await halo()).toBe('visible');
    await ouvrirListe(page);
    expect(await halo()).toBe('hidden');
    await page.locator('#cmPanel .cm-panel-fermer').click();
    await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
    await expect.poll(halo).toBe('visible');
    await page.setViewportSize({ width: 1280, height: 800 });
    await ouvrirListe(page);
    expect(await halo()).toBe('visible');
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

  test('É5. état vide : « nouveau retour », guillemets compris, ne se coupe jamais, quelle que soit la largeur', async ({ page }) => {
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.clearStorage(page); await page.reload();
    await ouvrirListe(page);
    const p = page.locator('#cmList .cm-vide-mode');
    await expect(p).toHaveText('pour en laisser un, appuie sur « nouveau retour », puis :');   // texte affiché inchangé
    const coupures = await p.evaluate((e) => {
      const t = e.firstChild, r = document.createRange();
      r.setStart(t, t.data.indexOf('«')); r.setEnd(t, t.data.indexOf('»') + 1);
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

  test('aria-label : liste vide, ni rôle ni nom ; avec des retours, le rôle et le nom reviennent ensemble', async ({ page }) => {
    const nom = 'tellus-accueil.html';
    await page.goto(H.fileUrl(nom));
    await H.clearStorage(page); await page.reload();
    await ouvrirListe(page);
    const liste = page.locator('#cmList');
    await expect(liste).not.toHaveAttribute('role', /.+/);
    await expect(liste).not.toHaveAttribute('aria-label', /.+/);
    await semer(page, nom, 'witmit_tellus_v1', [retour('a', nom)]);
    await ouvrirListe(page);
    await expect(liste).toHaveAttribute('role', 'list');
    await expect(liste).toHaveAccessibleName('tes retours sur cette page');
  });

  test('scroll-padding : la ligne choisie au clavier garde 4 px d’air au bord du bloc, en bas comme en haut', async ({ page }) => {
    const nom = 'tellus-accueil.html';
    const ids = Array.from({ length: 18 }, (_, i) => 'r' + i);
    await semer(page, nom, 'witmit_tellus_v1', ids.map((id) => retour(id, nom, { status: 'signale', signaledAt: new Date().toISOString() })));
    await ouvrirListe(page);
    expect(await page.locator('#cmList').evaluate((e) => [getComputedStyle(e).scrollPaddingTop, getComputedStyle(e).scrollPaddingBottom])).toEqual(['4px', '4px']);
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
