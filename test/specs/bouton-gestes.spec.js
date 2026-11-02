// witmit 0.4.0, lot 1 : le bouton unique et son symbole, le mot en tête de la liste, « réduire », les gestes (un clic ou
// ⌥ deux fois ouvre liste et mode d'un coup ; « réduire » ou Échap replient ; ⌥+A cache ou réaffiche), le halo à 1,5 px
// et witmit désactivé sous 480 px. Fiches BoutonWitmit, Identity, Icones, Bandeau, Tiroir et Mobile du design system
// version 7 ; décisions de François f1 (29/10), R27 (30/10) et du 02/11 (logo, écran étroit).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const MAQUETTE = 'generic-dashboard.html';
const LIVE = 'generic-dashboard-live.html';
const TELLUS = 'tellus-accueil.html';
const REVEAL_MAQUETTE = 'witmit_kiosque_reveal';
const REVEAL_LIVE = 'witmit_kiosque-live_reveal';
const CIBLE = 'tbody tr:first-child td:nth-child(2)';
const RACC_CACHER = H.IS_MAC ? '⌥+A' : 'alt+A';

async function ouvrirPropre(page, nom, suffixe = '') {
  await page.goto(H.fileUrl(nom));
  await H.clearStorage(page);
  await page.goto(H.fileUrl(nom) + suffixe);
}
const affichageRacine = (page) => page.locator('#wmRacine').evaluate((el) => getComputedStyle(el).display);
const lu = (page, cle) => page.evaluate((k) => localStorage.getItem(k), cle);
async function viser(page, sel = CIBLE) {
  const box = await H.visibleBox(page, sel);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.cm-popup textarea')).toBeVisible();
}
async function ouvertEnEntier(page) {
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await expect(page.locator('#cmFrame')).toHaveClass(/show/);
  await expect(page.locator('#cmPanelBtn')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#cmPanelBtn')).toBeHidden();
}
async function replieEnEntier(page) {
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  await expect(page.locator('#cmFrame')).not.toHaveClass(/show/);
  await expect(page.locator('#cmPanelBtn')).toHaveAttribute('aria-expanded', 'false');
}

test.describe('bouton witmit unique', () => {
  test('un seul bouton : le symbole à 52 px, arrondi de 12 px, ombre des fenêtres ; plus de bouton du mode ni de bandeau', async ({ page }) => {
    await ouvrirPropre(page, MAQUETTE);
    await page.evaluate(() => { document.body.style.background = '#ffffff'; });   // la page d'essai est sombre : on la passe en clair
    await expect(page.locator('body')).toHaveAttribute('data-wm-theme', 'client-clair');
    await expect(page.locator('#cmToggleBtn')).toHaveCount(0);
    await expect(page.locator('#cmPill')).toHaveCount(0);
    await expect(page.locator('#cmNewBtn')).toHaveCount(0);
    await expect(page.locator('.cm-fab button')).toHaveCount(1);
    const b = page.locator('#cmPanelBtn');
    await expect(b).toBeVisible();
    const st = await b.evaluate((el) => {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, rayon: cs.borderRadius, ombre: cs.boxShadow, droite: innerWidth - r.right, bas: innerHeight - r.bottom, titre: el.title };
    });
    expect(st.w).toBe(52); expect(st.h).toBe(52);
    expect(st.rayon).toBe('12px');
    expect(st.ombre).toContain('rgba(0, 0, 0, 0.34) 0px 22px 56px 0px');
    expect(st.ombre).toContain('rgba(0, 0, 0, 0.14) 0px 1px 3px 0px');
    expect(Math.round(st.droite)).toBe(24); expect(Math.round(st.bas)).toBe(24);
    expect(st.titre).toBe(H.IS_MAC ? 'option deux fois : ouvrir · option A : cacher' : 'alt deux fois : ouvrir · alt A : cacher');
    // Site clair : la face claire du symbole ; la face encre est cachée.
    await expect(b.locator('svg[data-logo="symbole"]')).toBeVisible();
    await expect(b.locator('svg[data-logo="symbole-sombre"]')).toBeHidden();
    await expect(b).toHaveAttribute('aria-label', 'witmit');
    await expect(b).toHaveAttribute('aria-expanded', 'false');
    // Le voyant n'est pas dans le logo : rien tant qu'il n'y a pas de nouveau.
    await expect(b.locator('#cmCount')).toBeHidden();
  });

  test('site sombre : la face encre et la lueur blanche des fenêtres', async ({ page }) => {
    await ouvrirPropre(page, MAQUETTE);   // page d'essai sombre
    await expect(page.locator('body')).toHaveAttribute('data-wm-theme', 'client-sombre');
    const b = page.locator('#cmPanelBtn');
    await expect(b.locator('svg[data-logo="symbole-sombre"]')).toBeVisible();
    await expect(b.locator('svg[data-logo="symbole"]')).toBeHidden();
    const ombre = await b.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(ombre).toContain('rgba(255, 255, 255, 0.22) 0px 22px 56px 0px');
  });

  test('le logo est embarqué dans le script, sans métadonnées c2pa ni chargement extérieur', async ({ page }) => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'witmit.js'), 'utf8');
    expect(src).not.toContain('c2pa');
    const requetes = [];
    page.on('request', (r) => { if (!r.url().startsWith('file://')) requetes.push(r.url()); });
    await ouvrirPropre(page, MAQUETTE);
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('#cmPanel .cm-panel-mot svg[data-logo="mot-blanc"]')).toBeVisible();   // page d'essai sombre
    expect(requetes).toEqual([]);
  });

  test('voyant « nouveau » : disque orange de 7 px, à 8 px du haut et 7 px de la droite, sans cerne', async ({ page }) => {
    await ouvrirPropre(page, MAQUETTE);
    await page.evaluate(() => { const v = document.getElementById('cmCount'); v.textContent = '2'; v.dataset.zero = '0'; });
    const v = await page.locator('#cmCount').evaluate((el) => {
      const r = el.getBoundingClientRect(), b = el.parentElement.getBoundingClientRect(), cs = getComputedStyle(el);
      return { w: r.width, h: r.height, haut: r.top - b.top, droite: b.right - r.right, fond: cs.backgroundColor, cerne: cs.boxShadow };
    });
    expect(v).toEqual({ w: 7, h: 7, haut: 8, droite: 7, fond: 'rgb(247, 130, 26)', cerne: 'none' });
  });

  test('page qui fournit encore les deux boutons des maquettes : un seul bouton witmit, au symbole', async ({ page }) => {
    await ouvrirPropre(page, TELLUS);
    await expect(page.locator('#cmToggleBtn')).toBeHidden();
    const b = page.locator('#cmPanelBtn');
    await expect(b).toBeVisible();
    await expect(b.locator('svg[data-logo="symbole"]')).toBeVisible();
    await expect(b).not.toContainText('📋');
    await b.click();
    await ouvertEnEntier(page);
    await page.keyboard.press('Escape');
    await replieEnEntier(page);
    await expect(b).toBeVisible();
  });
});

test.describe('ouvrir et réduire', () => {
  test('un clic sur le bouton ouvre ensemble la liste et le mode ; le bouton quitte la page', async ({ page }) => {
    await ouvrirPropre(page, MAQUETTE);
    await page.locator('#cmPanelBtn').click();
    await ouvertEnEntier(page);
    // Tête : le mot witmit (lettres de 16 px : 94 × 34,5 px avec ses coins), blanc cassé sur ce site sombre, encre sur un
    // site clair ; « réduire » ; plus de « masquer witmit » ni de croix « fermer ».
    const blanc = page.locator('#cmPanel .cm-panel-mot svg[data-logo="mot-blanc"]');
    await expect(blanc).toBeVisible();
    await expect(page.locator('#cmPanel .cm-panel-mot svg[data-logo="mot"]')).toBeHidden();
    const tailleMot = await blanc.boundingBox();
    expect(Math.round(tailleMot.width)).toBe(94);
    expect(Math.round(tailleMot.height)).toBe(35);
    await page.evaluate(() => { document.body.style.background = '#ffffff'; });
    await expect(page.locator('#cmPanel .cm-panel-mot svg[data-logo="mot"]')).toBeVisible();
    await expect(blanc).toBeHidden();
    const reduire = page.locator('#cmPanel .cm-panel-reduire');
    await expect(reduire).toBeVisible();
    await expect(reduire).toHaveAttribute('aria-label', 'réduire witmit');
    await expect(reduire).toHaveAttribute('title', 'réduire witmit · ' + RACC_CACHER + ' pour le cacher');
    await expect(reduire.locator('svg[data-icone="ArrowLineRight"]')).toHaveCount(1);
    await expect(page.locator('#cmPanel')).not.toContainText('masquer witmit');
    await expect(page.locator('#cmPanel [aria-label="fermer"]')).toHaveCount(0);
    // Pied : l'aide, plus de bouton « nouveau retour ».
    const aide = page.locator('#cmPanelAide');
    await expect(aide).toHaveText('clique un élément de la page pour laisser un retourglisser : une zone · échap : réduire witmit');
    await expect(page.locator('#cmPanel')).not.toContainText('nouveau retour');
    // État vide : « vise un élément de la page ».
    await expect(page.locator('#cmList')).toContainText('pour en laisser un, vise un élément de la page\u00a0:');
  });

  test('« réduire » replie tout, le bouton revient avec le focus', async ({ page }) => {
    await ouvrirPropre(page, MAQUETTE);
    await page.locator('#cmPanelBtn').click();
    await ouvertEnEntier(page);
    await page.locator('#cmPanel .cm-panel-reduire').click();
    await replieEnEntier(page);
    await expect(page.locator('#cmPanelBtn')).toBeVisible();
    await expect(page.locator('#cmPanelBtn')).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.style.marginRight)).toBe('');
  });

  test('Échap replie tout ; avec une fenêtre ouverte, il ferme d\'abord la fenêtre', async ({ page }) => {
    await ouvrirPropre(page, MAQUETTE);
    await page.locator('#cmPanelBtn').click();
    await ouvertEnEntier(page);
    await viser(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('.cm-popup')).toHaveCount(0);
    await ouvertEnEntier(page);
    await page.keyboard.press('Escape');
    await replieEnEntier(page);
    await expect(page.locator('#cmPanelBtn')).toBeVisible();
  });

  test('un clic sur la page, witmit ouvert, vise un élément et ne ferme rien', async ({ page }) => {
    await ouvrirPropre(page, MAQUETTE);
    await page.locator('#cmPanelBtn').click();
    await viser(page);
    await ouvertEnEntier(page);
  });
});

test.describe('raccourcis', () => {
  test('⌥ deux fois (maquette) : tout s\'ouvre d\'un coup ; Échap replie', async ({ page }) => {
    await ouvrirPropre(page, MAQUETTE);
    await H.doubleAlt(page);
    await ouvertEnEntier(page);
    await page.keyboard.press('Escape');
    await replieEnEntier(page);
  });

  test('witmit caché, ⌥ deux fois : il apparaît et s\'ouvre ; Échap le replie et il redevient caché', async ({ page }) => {
    await ouvrirPropre(page, LIVE);
    await expect(page.locator('body')).toHaveClass(/cm-concealed/);
    await H.doubleAlt(page);
    await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
    await ouvertEnEntier(page);
    await viser(page);
    await page.keyboard.press('Escape');   // la fenêtre
    await page.keyboard.press('Escape');   // witmit
    await replieEnEntier(page);
    await expect(page.locator('body')).toHaveClass(/cm-concealed/);
    await expect(page.locator('#cmPanelBtn')).toBeHidden();
    expect(await lu(page, REVEAL_LIVE)).not.toBe('1');   // rien de mémorisé : la visite reste cachée
  });

  test('witmit caché par ⌥ deux fois puis replié par « réduire » : caché aussi', async ({ page }) => {
    await ouvrirPropre(page, LIVE);
    await H.doubleAlt(page);
    await ouvertEnEntier(page);
    await page.locator('#cmPanel .cm-panel-reduire').click();
    await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  });

  test('⌥+A cache witmit entièrement, puis le fait réapparaître ; le choix est mémorisé', async ({ page }) => {
    await ouvrirPropre(page, MAQUETTE);
    await page.locator('#cmPanelBtn').click();
    await ouvertEnEntier(page);
    await page.keyboard.press(H.CACHER);
    await expect(page.locator('body')).toHaveClass(/cm-concealed/);
    await expect(page.locator('#cmPanelBtn')).toBeHidden();
    await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
    await expect(page.locator('body')).not.toHaveClass(/cm-active/);
    await expect(page.locator('#cmStatus')).toHaveText("witmit est masqué. pour le retrouver : " + RACC_CACHER + ", ou ?witmit=on dans l'adresse.");
    expect(await lu(page, REVEAL_MAQUETTE)).toBe('0');
    await page.reload();
    await expect(page.locator('body')).toHaveClass(/cm-concealed/);
    await page.keyboard.press(H.CACHER);
    await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
    await expect(page.locator('#cmPanelBtn')).toBeVisible();
    await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);   // bouton au repos
    await expect(page.locator('#cmStatus')).not.toHaveClass(/show/);   // le message de masquage part (N2)
    expect(await lu(page, REVEAL_MAQUETTE)).toBe('1');
  });

  test('⌥+A en live : montre witmit (bouton au repos), puis le cache ; ?witmit=on et ?witmit=off restent', async ({ page }) => {
    await ouvrirPropre(page, LIVE);
    await H.montrer(page);
    await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
    expect(await lu(page, REVEAL_LIVE)).toBe('1');
    await page.keyboard.press(H.CACHER);
    await expect(page.locator('body')).toHaveClass(/cm-concealed/);
    await page.goto(H.fileUrl(LIVE) + '?witmit=on');
    await expect(page.locator('#cmPanelBtn')).toBeVisible();
    expect(page.url()).not.toContain('witmit=');
    await page.goto(H.fileUrl(LIVE) + '?witmit=off');
    await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  });

  test('⌥+A avec un texte non parti : confirmation ; refusée, rien ne se cache', async ({ page }) => {
    await ouvrirPropre(page, MAQUETTE);
    await page.locator('#cmPanelBtn').click();
    await viser(page);
    await page.locator('.cm-popup textarea').fill('le titre est trop long');
    page.once('dialog', (d) => d.dismiss());
    await page.keyboard.press(H.CACHER);
    await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
    await expect(page.locator('.cm-popup textarea')).toHaveValue('le titre est trop long');
  });
});

test.describe('halo', () => {
  test('trait de 1,5 px sans filet, lueur fixe à 38 %, lueur à 55 % qui respire de 0,2 à 1 en 4 s ; il s\'arrête au bord de la liste', async ({ page }) => {
    await ouvrirPropre(page, MAQUETTE);
    await page.locator('#cmPanelBtn').click();
    await ouvertEnEntier(page);
    const h = await page.evaluate(() => {
      const f = document.getElementById('cmFrame');
      const av = getComputedStyle(f, '::before'), ap = getComputedStyle(f, '::after');
      const cles = [];
      for (const feuille of document.styleSheets) {
        try { for (const r of feuille.cssRules) if (r.type === CSSRule.KEYFRAMES_RULE && r.name === 'wmHaloSouffle') for (const k of r.cssRules) cles.push(k.keyText + ' ' + k.style.opacity); } catch (e) {}
      }
      return { avant: av.boxShadow, apres: ap.boxShadow, anim: ap.animationName, duree: ap.animationDuration, rythme: ap.animationTimingFunction, cles, droite: f.getBoundingClientRect().right, vw: document.documentElement.clientWidth, liste: document.getElementById('cmPanel').offsetWidth };
    });
    expect(h.avant).toBe('rgb(247, 130, 26) 0px 0px 0px 1.5px inset, rgba(247, 130, 26, 0.38) 0px 0px 12px 2px inset');
    expect(h.apres).toBe('rgba(247, 130, 26, 0.55) 0px 0px 44px 12px inset');
    expect(h.anim).toBe('wmHaloSouffle');
    expect(h.duree).toBe('4s');
    expect(h.rythme).toBe('ease-in-out');
    expect(h.cles.sort()).toEqual(['0%, 100% 0.2', '50% 1']);
    expect(h.liste).toBe(340);
    // Il s'arrête au bord de la liste (une fois la liste sortie : 240 ms).
    await expect.poll(() => page.evaluate(() => Math.round(document.getElementById('cmFrame').getBoundingClientRect().right))).toBe(h.vw - 340);
  });

  test('animations réduites : la lueur reste fixe à 0,6', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ouvrirPropre(page, MAQUETTE);
    await page.locator('#cmPanelBtn').click();
    await ouvertEnEntier(page);
    const ap = await page.evaluate(() => { const s = getComputedStyle(document.getElementById('cmFrame'), '::after'); return { anim: s.animationName, opacite: s.opacity }; });
    expect(ap).toEqual({ anim: 'none', opacite: '0.6' });
  });
});

test.describe('sous 480 px de large', () => {
  test('witmit désactivé : rien à l\'écran, aucun raccourci, la page n\'est ni rétrécie ni figée', async ({ page }) => {
    await page.setViewportSize({ width: 470, height: 800 });
    await ouvrirPropre(page, MAQUETTE);
    expect(await affichageRacine(page)).toBe('none');
    await expect(page.locator('#cmPanelBtn')).toBeHidden();
    await H.doubleAlt(page);
    await page.keyboard.press(H.CACHER);
    await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
    await expect(page.locator('body')).not.toHaveClass(/cm-active/);
    await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
    expect(await lu(page, REVEAL_MAQUETTE)).toBe(null);
    expect(await page.evaluate(() => document.documentElement.style.marginRight)).toBe('');
    // Un clic sur le site garde son effet (onglet « Nouvelle commande »).
    await page.locator('#tabBtnForm').click();
    await expect(page.locator('#paneForm')).toHaveClass(/current/);
  });

  test('ouvert puis passé sous 480 px : tout se retire ; il revient tel quel au-dessus, fenêtre et texte compris', async ({ page }) => {
    await ouvrirPropre(page, MAQUETTE);
    await page.locator('#cmPanelBtn').click();
    await viser(page);
    await page.locator('.cm-popup textarea').fill('à garder');
    await page.setViewportSize({ width: 470, height: 800 });
    await expect.poll(() => affichageRacine(page)).toBe('none');
    await expect(page.locator('#cmPanel')).toBeHidden();
    await expect(page.locator('.cm-popup')).toBeHidden();
    await expect(page.locator('#cmFrame')).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/cm-active/);
    expect(await page.evaluate(() => document.documentElement.style.marginRight)).toBe('');
    await page.setViewportSize({ width: 480, height: 800 });
    await expect.poll(() => affichageRacine(page)).toBe('block');
    await expect(page.locator('#cmPanel')).toBeVisible();
    await expect(page.locator('.cm-popup')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/cm-active/);
    await expect(page.locator('#cmPanel')).toHaveClass(/show/);
    await expect(page.locator('.cm-popup textarea')).toHaveValue('à garder');
    expect(await page.evaluate(() => document.documentElement.style.marginRight)).toBe('340px');
  });
});
