// Raccourcis (0.4.0 : décisions de François f1 du 29/10 et R27 du 30/10 ; fiches BoutonWitmit et Bandeau). ⌥ deux fois /
// alt deux fois ouvre witmit d'un coup (liste et mode annotation), même caché (le temps d'un retour) ; witmit ouvert, il le
// replie. ⌥+A / alt+A cache ou réaffiche witmit entièrement (mémorisé). Échap ferme une couche à la fois. Plus de touche N.
// Pour ⌥+A, on lit la lettre tapée (e.key), avec repli par la position (e.code) pour une touche morte. Les gestes du bouton
// et de « réduire » : bouton-gestes.spec.js.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const LIVE = 'generic-dashboard-live.html';
const MAQUETTE = 'generic-dashboard.html';
const REVEAL_KEY = 'witmit_kiosque-live_reveal';
const CIBLE = 'tbody tr:first-child td:nth-child(2)';
const RACC_DOUBLE_ALT = H.IS_MAC ? '⌥ deux fois' : 'alt deux fois';
const CONFIRMATION = 'abandonner ce retour ?';

const revealed = (page) => page.evaluate((k) => localStorage.getItem(k), REVEAL_KEY);
async function ouvrirPropre(page, nom, suffixe = '') {
  await page.goto(H.fileUrl(nom));
  await H.clearStorage(page);
  await page.goto(H.fileUrl(nom) + suffixe);
}
// Écouteur du test sur window (il passe après celui de witmit, posé sur document) : la touche a-t-elle été prise ?
async function guetterTouches(page) {
  await page.evaluate(() => {
    window.__wmPrise = [];
    window.addEventListener('keydown', (e) => { if (e.altKey && e.key !== 'Alt') window.__wmPrise.push(e.defaultPrevented); });
  });
}
const prises = (page) => page.evaluate(() => window.__wmPrise);
// Même écouteur pour alt seule : chaque keydown d'alt a-t-il été bloqué (defaultPrevented) ?
async function guetterAlt(page) {
  await page.evaluate(() => {
    window.__wmAlt = [];
    window.addEventListener('keydown', (e) => { if (e.key === 'Alt') window.__wmAlt.push(e.defaultPrevented); });
  });
}
const prisesAlt = (page) => page.evaluate(() => window.__wmAlt);
async function ouvrirFenetre(page, texte) {
  const box = await H.visibleBox(page, CIBLE);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.cm-popup textarea')).toBeVisible();
  if (texte) await page.locator('.cm-popup textarea').fill(texte);
}
async function centreDonne(page, sel) {
  return page.locator(sel).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(x && x.closest('#' + el.id));
  });
}


const RACC_CACHER = H.IS_MAC ? '⌥+A' : 'alt+A';
// ZB-280 : dans un message passager, ⌥ est une icône (Option) dans son carré, lue « option ».
const LU = (geste) => geste.replace('⌥', 'option');
const ouvert = async (page) => { await expect(page.locator('#cmPanel')).toHaveClass(/show/); await expect(page.locator('body')).toHaveClass(/cm-active/); };
const replie = async (page) => { await expect(page.locator('#cmPanel')).not.toHaveClass(/show/); await expect(page.locator('body')).not.toHaveClass(/cm-active/); };

test('1. ⌥ deux fois, witmit caché : il apparaît et s’ouvre (liste et mode), aucune fenêtre ; rien de mémorisé', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.doubleAlt(page);
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await ouvert(page);
  await expect(page.locator('#cmPanelBtn')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.cm-popup')).toHaveCount(0);
  expect(await revealed(page)).toBeNull();
});

test('2. ⌥+A cache : tout se ferme et s’oublie, le message de masquage reste lisible ; texte non parti : confirmation', async ({ page }) => {
  await ouvrirPropre(page, LIVE, '?witmit=on');
  await H.activate(page);
  await page.keyboard.press(H.CACHER);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await replie(page);
  await expect(page.locator('#cmPanelBtn')).toBeHidden();
  expect(await revealed(page)).toBeNull();
  // Le message de masquage s'affiche malgré cm-concealed (Léa 45), puis disparaît.
  const toast = page.locator('#cmStatus');
  await expect(toast).toBeVisible();
  await expect(toast).toHaveClass(/wm-toast-masquage/);
  await expect(toast).toHaveText('witmit est masqué. pour le retrouver : ' + LU(RACC_CACHER) + ", ou ?witmit=on dans l'adresse.");
  await page.waitForTimeout(5000);
  await expect(toast).toBeVisible();                                   // lisible toute sa durée : 6 s, comme un échec (Léa)
  await expect(toast).toBeHidden({ timeout: 3000 });
  // Fenêtre au texte non parti : la confirmation s'affiche ; la refuser ne cache rien.
  await page.keyboard.press(H.CACHER);
  await H.activate(page);
  await ouvrirFenetre(page, 'pas encore parti');
  await page.locator('.cm-popup textarea').blur();                     // dans le champ, ⌥+A est ignoré (K4)
  // 0.4.0 (h1) : la question « abandonner ce retour ? » dans la fenêtre, plus de confirm() natif ; « garder ».
  await page.keyboard.press(H.CACHER);
  await expect(page.locator('.cm-popup .cm-abandon-question')).toHaveText(CONFIRMATION);
  await page.locator('.cm-popup .cm-garder').click();
  await page.locator('.cm-popup textarea').blur();
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await expect(page.locator('.cm-popup textarea')).toHaveValue('pas encore parti');
  // « abandonner » ferme la fenêtre (le geste n'a pas lieu) ; un nouvel ⌥+A cache tout.
  await page.keyboard.press(H.CACHER);
  await expect(page.locator('.cm-popup .cm-abandon')).toBeVisible();
  await page.locator('.cm-popup .cm-abandonner').click();
  await expect(page.locator('.cm-popup')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await page.keyboard.press(H.CACHER);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await expect(page.locator('.cm-popup')).toHaveCount(0);
});

test('3. ⌥+A montre witmit replié, même ouvert avant de le cacher ; ?witmit=on donne le même état', async ({ page }) => {
  await ouvrirPropre(page, LIVE, '?witmit=on');
  await H.activate(page);
  await page.keyboard.press(H.CACHER);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await page.keyboard.press(H.CACHER);
  await expect(page.locator('#cmPanelBtn')).toBeVisible();
  await replie(page);
  await H.activate(page);
  await page.goto(H.fileUrl(LIVE) + '?witmit=on');
  await expect(page.locator('#cmPanelBtn')).toBeVisible();
  await replie(page);
});

test('4. ⌥+A, witmit caché par ⌥ deux fois puis ouvert : ⌥+A le cache entièrement (R27, fiche BoutonWitmit, parcours 6)', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  await H.doubleAlt(page);
  await ouvert(page);
  await page.keyboard.press(H.CACHER);
  // Comme ⌥+A sur un witmit montré : tout se replie, witmit caché, message de masquage, mémoire effacée.
  await replie(page);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await expect(page.locator('#cmStatus')).toHaveClass(/wm-toast-masquage/);
  expect(await revealed(page)).toBe(null);
});

test('5. ⌥ deux fois, witmit ouvert : il se replie ; caché par ⌥ deux fois, il redevient caché', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  await H.doubleAlt(page);
  await ouvert(page);
  await page.waitForTimeout(450);
  await H.doubleAlt(page);
  await replie(page);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  // Montré (⌥+A) : ⌥ deux fois ouvre, puis replie ; le bouton revient.
  await page.keyboard.press(H.CACHER);
  await page.waitForTimeout(450);
  await H.doubleAlt(page);
  await ouvert(page);
  await page.waitForTimeout(450);
  await H.doubleAlt(page);
  await replie(page);
  await expect(page.locator('#cmPanelBtn')).toBeVisible();
});

test('6. ⌥+A prend la touche (preventDefault) quand witmit agit, caché comme montré', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  await guetterTouches(page);
  await page.keyboard.press(H.CACHER);
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await page.keyboard.press(H.CACHER);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  expect(await prises(page)).toEqual([true, true]);
});

test('7. plus de touche N : witmit ouvert, la lettre ne fait rien ; dans un champ, elle s’écrit', async ({ page }) => {
  await ouvrirPropre(page, MAQUETTE);
  await H.activate(page);
  await page.keyboard.press('n');
  await ouvert(page);
  await H.addPin(page, CIBLE, 'Retour à modifier');
  await H.ouvrirRetour(page, page.locator('.cm-panel-item').first());   // c1 (V2) : un clic choisit, un deuxième ouvre le champ
  const champ = page.locator('.cm-panel-item textarea.cm-inline-edit');
  await expect(champ).toBeFocused();
  await page.keyboard.press('n');
  await expect(champ).toHaveValue('Retour à modifiern');
  await ouvert(page);
});

test('9. champs : ⌥ deux fois et ⌥+A ignorés dans un input, un textarea, un contenteditable et un input en shadow DOM', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  await page.evaluate(() => {
    const zone = document.createElement('div');
    zone.id = 'champsDuTest';
    zone.innerHTML = '<input id="tInput"><textarea id="tArea"></textarea><div id="tEdit" contenteditable="true">texte</div><div id="tHote"></div>';
    document.body.prepend(zone);
    document.getElementById('tHote').attachShadow({ mode: 'open' }).innerHTML = '<input id="tOmbre">';
  });
  const champs = {
    input: () => page.locator('#tInput').focus(),
    textarea: () => page.locator('#tArea').focus(),
    contenteditable: () => page.locator('#tEdit').focus(),
    'shadow DOM': () => page.evaluate(() => document.getElementById('tHote').shadowRoot.getElementById('tOmbre').focus()),
  };
  for (const [nom, focus] of Object.entries(champs)) {
    await focus();
    await H.doubleAlt(page);
    await page.keyboard.press(H.CACHER);
    await expect(page.locator('body'), nom).toHaveClass(/cm-concealed/);
    await expect(page.locator('body'), nom).not.toHaveClass(/cm-active/);
  }
  await page.locator('h1').first().click();
  await H.montrer(page);
  for (const [nom, focus] of Object.entries(champs)) {
    await focus();
    await page.keyboard.press(H.CACHER);
    await expect(page.locator('body'), nom).not.toHaveClass(/cm-concealed/);
    await H.doubleAlt(page);
    await expect(page.locator('body'), nom).not.toHaveClass(/cm-active/);
  }
});

test('10. lettres du Mac : « ∑ » (⌥+W QWERTY) et « ‹ » (⌥+W AZERTY) ne font rien ; « å », « æ » et « Æ » cachent et montrent witmit', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  await guetterTouches(page);
  await H.toucheBrute(page, { key: '∑', code: 'KeyW', alt: true });
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.toucheBrute(page, { key: '‹', code: 'KeyZ', alt: true });   // ⌥+W sur le clavier français du Mac (relevé au lancement)
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  expect(await prises(page)).toEqual([false, false]);                  // la touche reste au site
  await H.toucheBrute(page, { key: 'å', code: 'KeyA', alt: true });
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await H.toucheBrute(page, { key: 'æ', code: 'KeyQ', alt: true });
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.toucheBrute(page, { key: 'Æ', code: 'KeyQ', alt: true });   // ⌥+A sur le clavier français du Mac (relevé au lancement)
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
});

test('11. repli par la position, carte AZERTY simulée : touche morte sur KeyZ (W) → rien ; « ‡ » sur KeyA → rien ; touche morte sur KeyQ → montre ; sur KeyW → rien', async ({ page }) => {
  await H.carteClavier(page, 'azerty');
  await ouvrirPropre(page, LIVE);
  await page.waitForFunction(() => navigator.keyboard && navigator.keyboard.getLayoutMap);
  await H.toucheBrute(page, { key: 'Dead', code: 'KeyZ', alt: true }); // la touche W en AZERTY
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.toucheBrute(page, { key: '‡', code: 'KeyA', alt: true });   // ⌥+Q en AZERTY : ce n'est pas A
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.toucheBrute(page, { key: 'Dead', code: 'KeyQ', alt: true });
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await H.toucheBrute(page, { key: 'Dead', code: 'KeyW', alt: true }); // la touche Z en AZERTY : rien
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
});

test('12. repli sans carte (Safari, Firefox) : touche morte sur KeyW ou KeyZ → rien ; « Ω », « Â », « ‡ » → rien ; touche morte sur KeyA → montre', async ({ page }) => {
  await H.carteClavier(page, null);
  await ouvrirPropre(page, LIVE);
  expect(await page.evaluate(() => navigator.keyboard)).toBeUndefined();
  for (const t of [{ key: 'Dead', code: 'KeyW' }, { key: 'Dead', code: 'KeyZ' }, { key: 'Ω', code: 'KeyZ' }, { key: 'Â', code: 'KeyW' }, { key: '‡', code: 'KeyA' }]) {
    await H.toucheBrute(page, { ...t, alt: true });
    await expect(page.locator('body'), t.key + ' ' + t.code).toHaveClass(/cm-concealed/);
  }
  await H.toucheBrute(page, { key: 'Dead', code: 'KeyA', alt: true }); // le repli de ⌥+A reste
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
});

test('13. touche maintenue : un seul effet ; alt+W, ctrl+alt+A (AltGr), alt+maj+A et ⌘+alt+A : rien', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  await H.toucheBrute(page, { key: 'a', code: 'KeyA', alt: true, up: false });
  await H.toucheBrute(page, { key: 'a', code: 'KeyA', alt: true, repeat: true, up: false });
  await H.toucheBrute(page, { key: 'a', code: 'KeyA', alt: true, repeat: true });
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);  // une seule bascule, pas trois
  for (const [nom, t] of [['alt+W', { key: 'w', code: 'KeyW' }], ['ctrl+alt+A', { ctrl: true }], ['alt+maj+A', { shift: true, key: 'A' }], ['⌘+alt+A', { meta: true }]]) {
    await H.toucheBrute(page, { key: 'a', code: 'KeyA', alt: true, ...t });
    await expect(page.locator('body'), nom).not.toHaveClass(/cm-concealed/);
  }
});

test('14. maquette : ⌥ deux fois ouvre witmit, et la touche alt reste au site', async ({ page }) => {
  await ouvrirPropre(page, MAQUETTE);
  await guetterAlt(page);
  await H.doubleAlt(page);
  await ouvert(page);
  expect(await prisesAlt(page)).toEqual([false, false]);
});

// Double ⌥ (décision de François du 25/10 après-midi) : ce qui ne doit PAS déclencher.
test('15. deux appuis lents (plus de 400 ms) : rien ; deux appuis rapides ensuite : ouvre', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  // Entre deux essais, une pause de plus de 400 ms : le dernier appui d'un essai ne fait pas paire avec le suivant.
  await H.doubleAlt(page, 500);
  await page.waitForTimeout(450);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.doubleAlt(page);
  await ouvert(page);
  await page.waitForTimeout(450);
  await H.doubleAlt(page, 500);
  await page.waitForTimeout(450);
  await ouvert(page);
});

test('16. ⌥+A tapé deux fois : witmit se montre puis se cache ; le double ⌥ ne s’en mêle pas', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  const etats = [];
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press(H.CACHER);
    etats.push(await page.locator('body').evaluate((b) => b.classList.contains('cm-concealed')));
  }
  expect(etats).toEqual([false, true]);
  await page.waitForTimeout(200);
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
});

test('17. touche maintenue : alt gardé enfoncé (répétitions) puis un appui : rien', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  await H.toucheBrute(page, { key: 'Alt', code: 'AltLeft', alt: true, up: false });
  await H.toucheBrute(page, { key: 'Alt', code: 'AltLeft', alt: true, repeat: true, up: false });
  await H.toucheBrute(page, { key: 'Alt', code: 'AltLeft', alt: true, repeat: true });
  await page.keyboard.press('Alt');
  await page.waitForTimeout(200);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
});

test('18. une autre touche ou un clic entre les deux appuis : rien', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  await page.keyboard.press('Alt');
  await page.keyboard.press('KeyB');
  await page.keyboard.press('Alt');
  await page.waitForTimeout(450);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await page.keyboard.press('Alt');
  await page.locator('h1').first().click();
  await page.keyboard.press('Alt');
  await page.waitForTimeout(450);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.doubleAlt(page);                                              // et rien n'est resté bloqué
  await ouvert(page);
});

test('19. ctrl+alt (AltGr sous Windows), AltGraph, maj+alt et ⌘+alt deux fois : rien', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  for (const mod of ['Control', 'Shift', 'Meta']) {
    await page.keyboard.down(mod);
    await H.doubleAlt(page);
    await page.keyboard.up(mod);
    await page.waitForTimeout(100);
    await expect(page.locator('body'), mod).toHaveClass(/cm-concealed/);
  }
  for (let i = 0; i < 2; i++) await H.toucheBrute(page, { key: 'AltGraph', code: 'AltRight', alt: true, ctrl: true });
  await page.waitForTimeout(100);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
});

test('20. aucun preventDefault sur alt seule, witmit caché comme visible', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  await guetterAlt(page);
  await H.doubleAlt(page);
  await ouvert(page);
  await page.waitForTimeout(450);
  await H.doubleAlt(page);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await page.keyboard.press('Alt');
  expect(await prisesAlt(page)).toEqual([false, false, false, false, false]);
});

// Lot 10 bis (Paula, sur l'aperçu de TellUs) : N1, « ?witmit=on » se coupait après le « ? » à 1280 px ; N2, le message
// de masquage restait jusqu'à 6 s après la révélation, à côté des boutons revenus (défaut de 0.2.0).
// Lignes occupées par « ?witmit=on » dans le message, mesurées sur le texte lui-même (plage sur les nœuds texte).
async function lignesDeLAdresse(page) {
  return page.evaluate(() => {
    const t = document.querySelector('#cmStatus .wm-toast-texte');
    const w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
    const noeuds = [];
    let texte = '';
    for (let n = w.nextNode(); n; n = w.nextNode()) { noeuds.push([n, texte.length]); texte += n.data; }
    const debut = texte.indexOf('?witmit=on');
    if (debut < 0) return -1;
    const fin = debut + '?witmit=on'.length;
    const ou = (pos) => { for (let i = noeuds.length - 1; i >= 0; i--) if (pos >= noeuds[i][1]) return [noeuds[i][0], pos - noeuds[i][1]]; };
    const r = document.createRange();
    r.setStart(...ou(debut));
    r.setEnd(...ou(fin));
    return new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size;
  });
}

test('21. message de masquage : « ?witmit=on » jamais coupé après le « ? », de 480 à 1440 px, « ⌥+A » comme « alt+A » (N1)', async ({ page }) => {
  const largeurs = [];
  for (let l = 480; l <= 500; l += 1) largeurs.push(l);       // sous 480 px, witmit est désactivé (fiche Mobile)
  for (let l = 520; l <= 1440; l += 20) largeurs.push(l);      // puis la largeur du message est fixe (420 px)
  for (const geste of [RACC_CACHER, 'alt+A']) {
    if (geste !== RACC_CACHER) {
      await page.addInitScript(() => {                         // un autre système que le Mac : « alt+A »
        Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => ({ platform: 'Windows' }) });
        Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'Win32' });
      });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await ouvrirPropre(page, LIVE, '?witmit=on');
    await page.evaluate(() => window.cmReveal(false));
    const toast = page.locator('#cmStatus');
    await expect(toast).toHaveText('witmit est masqué. pour le retrouver : ' + LU(geste) + ", ou ?witmit=on dans l'adresse.");
    const coupees = [];
    for (const l of largeurs) {
      await page.setViewportSize({ width: l, height: 800 });
      const n = await lignesDeLAdresse(page);
      if (n !== 1) coupees.push(l + ' px : ' + n);
    }
    expect(coupees, geste).toEqual([]);
  }
});

test('22. le message de masquage part dès que witmit revient (⌥+A ou ⌥ deux fois), sans attendre ses 6 s (N2)', async ({ page }) => {
  await ouvrirPropre(page, LIVE, '?witmit=on');
  await page.keyboard.press(H.CACHER);
  const toast = page.locator('#cmStatus');
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await expect(toast).toBeVisible();
  await expect(toast).toHaveClass(/wm-toast-masquage/);
  await page.keyboard.press(H.CACHER);
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await expect(page.locator('#cmPanelBtn')).toBeVisible();
  await expect(toast).not.toHaveClass(/show/);
  await expect(toast).not.toHaveClass(/wm-toast-masquage/);
  await expect(toast).toBeHidden({ timeout: 500 });           // fondu de 200 ms, pas les 6 s du message
  // Un nouveau masquage le remontre en entier ; ⌥ deux fois le retire aussi.
  await page.keyboard.press(H.CACHER);
  await expect(toast).toBeVisible();
  await expect(toast).toHaveClass(/wm-toast-masquage/);
  await H.doubleAlt(page);
  await ouvert(page);
  await expect(toast).toBeHidden({ timeout: 500 });
});
