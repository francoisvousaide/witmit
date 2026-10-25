// Raccourcis, bouton witmit et bouton du mode annotation (décisions de François du 25/10 ; K1 à K6 ;
// parcours de Léa 4.1). ⌥ deux fois / alt deux fois montre et cache witmit (live ; décision de François du
// 25/10 après-midi, à la place de la lettre W) ; ⌥+A / alt+A lance et arrête le mode ; N (liste ouverte)
// ferme la liste et lance le mode ; Échap ferme une couche à la fois. Pour ⌥+A, on lit la lettre tapée
// (e.key), avec repli par la position (e.code) pour une touche morte.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const LIVE = 'generic-dashboard-live.html';
const MAQUETTE = 'generic-dashboard.html';
const REVEAL_KEY = 'witmit_kiosque-live_reveal';
const CIBLE = 'tbody tr:first-child td:nth-child(2)';
const RACC_DOUBLE_ALT = H.IS_MAC ? '⌥ deux fois' : 'alt deux fois';
const CONFIRMATION = "fermer quand même ? ce que tu viens d'écrire n'est pas parti et sera perdu.";

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

test('1. ⌥ deux fois révèle : les deux boutons, liste fermée, mode éteint, aucune fenêtre ; mémorisé', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.doubleAlt(page);
  await expect(page.locator('#cmPanelBtn')).toBeVisible();
  await expect(page.locator('#cmToggleBtn')).toBeVisible();
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(page.locator('#cmPanelBtn')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  await expect(page.locator('#cmToggleBtn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.cm-popup')).toHaveCount(0);
  expect(await revealed(page)).toBe('1');
});

test('2. ⌥ deux fois cache : tout se ferme et s’oublie, le message de masquage reste lisible ; texte non parti : confirmation', async ({ page }) => {
  await ouvrirPropre(page, LIVE, '?witmit=on');
  await H.activate(page);
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await H.doubleAlt(page);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  await expect(page.locator('#cmToggleBtn')).toBeHidden();
  expect(await revealed(page)).toBeNull();
  // Le message de masquage s'affiche malgré cm-concealed (Léa 45), puis disparaît.
  const toast = page.locator('#cmStatus');
  await expect(toast).toBeVisible();
  await expect(toast).toHaveClass(/wm-toast-masquage/);
  await expect(toast).toHaveText('witmit est masqué. pour le retrouver : ' + RACC_DOUBLE_ALT + ", ou ?witmit=on dans l'adresse.");
  await page.waitForTimeout(3000);
  await expect(toast).toBeVisible();                                   // lisible toute sa durée
  await expect(toast).toBeHidden({ timeout: 4000 });
  // Fenêtre au texte non parti : la confirmation s'affiche ; la refuser ne cache rien.
  await H.doubleAlt(page);
  await H.activate(page);
  await ouvrirFenetre(page, 'pas encore parti');
  await page.locator('.cm-popup textarea').blur();                     // dans le champ, ⌥ deux fois est ignoré (K4)
  const messages = [];
  page.once('dialog', (d) => { messages.push(d.message()); d.dismiss(); });
  await H.doubleAlt(page);
  await expect.poll(() => messages.length).toBe(1);
  expect(messages[0]).toBe(CONFIRMATION);
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await expect(page.locator('.cm-popup textarea')).toHaveValue('pas encore parti');
  // L'accepter cache tout.
  page.once('dialog', (d) => d.accept());
  await H.doubleAlt(page);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await expect(page.locator('.cm-popup')).toHaveCount(0);
});

test('3. liste fermée à la révélation, même ouverte avant de cacher ; ?witmit=on donne le même état', async ({ page }) => {
  await ouvrirPropre(page, LIVE, '?witmit=on');
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await H.doubleAlt(page);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.doubleAlt(page);
  await expect(page.locator('#cmPanelBtn')).toBeVisible();
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  // ?witmit=on : même état (liste fermée, mode éteint)
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await page.goto(H.fileUrl(LIVE) + '?witmit=on');
  await expect(page.locator('#cmPanelBtn')).toBeVisible();
  await expect(page.locator('#cmToggleBtn')).toBeVisible();
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
});

test('4. ⌥+A, witmit caché : rien ne change, la touche reste au site', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  await guetterTouches(page);
  await page.keyboard.press(H.ANNOTER);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  expect(await prises(page)).toEqual([false]);
});

test('5. ⌥+A lance le mode et ferme la liste ; de nouveau : l’arrête ; Échap aussi ; le bouton du mode suit', async ({ page }) => {
  await ouvrirPropre(page, LIVE, '?witmit=on');
  const mode = page.locator('#cmToggleBtn');
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await page.keyboard.press(H.ANNOTER);
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(mode).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press(H.ANNOTER);
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  await expect(mode).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press(H.ANNOTER);
  await expect(mode).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  await expect(mode).toHaveAttribute('aria-pressed', 'false');
});

test('6. bouton witmit = la liste, rien d’autre : il ouvre puis ferme ; mode actif, il ne l’arrête pas', async ({ page }) => {
  await ouvrirPropre(page, LIVE, '?witmit=on');
  const btn = page.locator('#cmPanelBtn');
  await btn.click();
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await btn.click();
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await H.activate(page);
  await btn.click();
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await expect(page.locator('#cmFrame')).toHaveClass(/show/);       // le halo reste
  await expect(page.locator('#cmToggleBtn')).toHaveAttribute('aria-pressed', 'true');
});

test('7. bouton du mode : visible dès la révélation ; liste ouverte et mode actif, les deux boutons restent à gauche de la liste et cliquables', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  await H.montrer(page);
  await H.activate(page);
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await page.waitForTimeout(400);                                       // fin du glissement de la liste
  const liste = await page.locator('#cmPanel').boundingBox();
  for (const sel of ['#cmPanelBtn', '#cmToggleBtn']) {
    const b = await page.locator(sel).boundingBox();
    expect(b.x + b.width, sel).toBeLessThanOrEqual(liste.x);
    expect(await centreDonne(page, sel), sel).toBe(true);
  }
  // Un clic l'arrête (et ferme la liste, comme tout clic hors d'elle), le suivant le relance.
  await page.locator('#cmToggleBtn').click();
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  await expect(page.locator('#cmToggleBtn')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#cmToggleBtn').click();
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await expect(page.locator('#cmToggleBtn')).toHaveAttribute('aria-pressed', 'true');
});

test('8. touche N : liste ouverte, ferme la liste et lance le mode ; liste fermée, rien ; dans un champ, la lettre s’écrit ; avec une touche de modification, rien', async ({ page }) => {
  await ouvrirPropre(page, MAQUETTE);
  await page.locator('#cmPanelBtn').click();
  await page.keyboard.press('n');
  await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await expect(page.locator('#cmToggleBtn')).toHaveAttribute('aria-pressed', 'true');
  // Ne l'arrête jamais : liste rouverte, N de nouveau, le mode reste lancé.
  await page.locator('#cmPanelBtn').click();
  await page.keyboard.press('n');
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await H.deactivate(page);
  // Liste fermée : rien.
  await page.keyboard.press('n');
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  // Dans le champ de modification d'un retour, la lettre s'écrit.
  await H.activate(page);
  await H.addPin(page, CIBLE, 'Retour à modifier');
  await page.locator('#cmPanelBtn').click();
  await page.locator('.cm-panel-item .body').first().click();
  const champ = page.locator('.cm-panel-item textarea.cm-inline-edit');
  await expect(champ).toBeFocused();
  await page.keyboard.press('n');
  await expect(champ).toHaveValue('Retour à modifiern');
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await page.keyboard.press('Escape');                                  // annule la modification
  await H.deactivate(page);
  // Avec maj, ctrl, alt ou ⌘ : rien.
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  for (const t of ['Shift+KeyN', 'Control+KeyN', 'Alt+KeyN', 'Meta+KeyN']) {
    await page.keyboard.press(t);
    await expect(page.locator('#cmPanel'), t).toHaveClass(/show/);
    await expect(page.locator('body'), t).not.toHaveClass(/cm-active/);
  }
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
    await expect(page.locator('body'), nom).toHaveClass(/cm-concealed/);
  }
  await page.locator('h1').first().click();
  await H.montrer(page);
  for (const [nom, focus] of Object.entries(champs)) {
    await focus();
    await page.keyboard.press(H.ANNOTER);
    await expect(page.locator('body'), nom).not.toHaveClass(/cm-active/);
    await H.doubleAlt(page);
    await expect(page.locator('body'), nom).not.toHaveClass(/cm-concealed/);
  }
});

test('10. lettres du Mac : « ∑ » (⌥+W QWERTY) et « ‹ » (⌥+W AZERTY) ne font plus rien ; « å », « æ » et « Æ » lancent et arrêtent le mode', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  await guetterTouches(page);
  await H.toucheBrute(page, { key: '∑', code: 'KeyW', alt: true });
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.toucheBrute(page, { key: '‹', code: 'KeyZ', alt: true });   // ⌥+W sur le clavier français du Mac (relevé au lancement)
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.montrer(page);
  await H.toucheBrute(page, { key: '∑', code: 'KeyW', alt: true });
  await H.toucheBrute(page, { key: '‹', code: 'KeyZ', alt: true });
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  expect(await prises(page)).toEqual([false, false, false, false]);   // la touche reste au site
  await H.toucheBrute(page, { key: 'å', code: 'KeyA', alt: true });
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await H.toucheBrute(page, { key: 'æ', code: 'KeyQ', alt: true });
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  await H.toucheBrute(page, { key: 'Æ', code: 'KeyQ', alt: true });   // ⌥+A sur le clavier français du Mac (relevé au lancement)
  await expect(page.locator('body')).toHaveClass(/cm-active/);
});

test('11. repli par la position, carte AZERTY simulée : touche morte sur KeyZ (W) → rien ; « ‡ » sur KeyA → rien ; touche morte sur KeyQ → mode ; sur KeyW → rien', async ({ page }) => {
  await H.carteClavier(page, 'azerty');
  await ouvrirPropre(page, LIVE);
  await page.waitForFunction(() => navigator.keyboard && navigator.keyboard.getLayoutMap);
  await H.toucheBrute(page, { key: 'Dead', code: 'KeyZ', alt: true }); // la touche W en AZERTY : ne montre plus
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.montrer(page);
  await H.toucheBrute(page, { key: 'Dead', code: 'KeyZ', alt: true }); // ni ne cache
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await H.toucheBrute(page, { key: '‡', code: 'KeyA', alt: true });   // ⌥+Q en AZERTY : ce n'est pas A
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  await H.toucheBrute(page, { key: 'Dead', code: 'KeyQ', alt: true });
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await H.toucheBrute(page, { key: 'Dead', code: 'KeyW', alt: true }); // la touche Z en AZERTY : rien
  await expect(page.locator('body')).toHaveClass(/cm-active/);
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
});

test('12. repli sans carte (Safari, Firefox) : touche morte sur KeyW ou KeyZ → rien ; « Ω », « Â », « ‡ » → rien ; touche morte sur KeyA → mode', async ({ page }) => {
  await H.carteClavier(page, null);
  await ouvrirPropre(page, LIVE);
  expect(await page.evaluate(() => navigator.keyboard)).toBeUndefined();
  await H.toucheBrute(page, { key: 'Dead', code: 'KeyW', alt: true });
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.toucheBrute(page, { key: 'Dead', code: 'KeyZ', alt: true });
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.toucheBrute(page, { key: 'Ω', code: 'KeyZ', alt: true });
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.montrer(page);
  await H.toucheBrute(page, { key: 'Dead', code: 'KeyW', alt: true });
  await H.toucheBrute(page, { key: 'Dead', code: 'KeyZ', alt: true });
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await H.toucheBrute(page, { key: 'Â', code: 'KeyW', alt: true });
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await H.toucheBrute(page, { key: '‡', code: 'KeyA', alt: true });
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  await H.toucheBrute(page, { key: 'Dead', code: 'KeyA', alt: true }); // le repli de ⌥+A reste
  await expect(page.locator('body')).toHaveClass(/cm-active/);
});

test('13. touche maintenue : un seul effet ; alt+W, ctrl+alt+W (AltGr), alt+maj+W et ⌘+alt+W : rien', async ({ page }) => {
  await ouvrirPropre(page, LIVE, '?witmit=on');
  await H.toucheBrute(page, { key: 'a', code: 'KeyA', alt: true, up: false });
  await H.toucheBrute(page, { key: 'a', code: 'KeyA', alt: true, repeat: true, up: false });
  await H.toucheBrute(page, { key: 'a', code: 'KeyA', alt: true, repeat: true });
  await expect(page.locator('body')).toHaveClass(/cm-active/);         // une seule bascule, pas trois
  await H.deactivate(page);
  for (const [nom, t] of [['alt+W', {}], ['ctrl+alt+W', { ctrl: true }], ['alt+maj+W', { shift: true, key: 'W' }], ['⌘+alt+W', { meta: true }]]) {
    await H.toucheBrute(page, { key: 'w', code: 'KeyW', alt: true, ...t });
    await expect(page.locator('body'), nom).not.toHaveClass(/cm-concealed/);
  }
});

test('14. maquette : ⌥ deux fois ne fait rien, et la touche reste au site', async ({ page }) => {
  await ouvrirPropre(page, MAQUETTE);
  await guetterAlt(page);
  await H.doubleAlt(page);
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await expect(page.locator('#cmToggleBtn')).toBeVisible();
  await expect(page.locator('#cmPanelBtn')).toBeVisible();
  expect(await prisesAlt(page)).toEqual([false, false]);
});

// Double ⌥ (décision de François du 25/10 après-midi) : ce qui ne doit PAS déclencher.
test('15. deux appuis lents (plus de 400 ms) : rien ; deux appuis rapides ensuite : révèle', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  // Entre deux essais, une pause de plus de 400 ms : le dernier appui d'un essai ne fait pas paire avec le suivant.
  await H.doubleAlt(page, 500);
  await page.waitForTimeout(450);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await H.doubleAlt(page);
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
  await page.waitForTimeout(450);
  await H.doubleAlt(page, 500);
  await page.waitForTimeout(450);
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
});

test('16. ⌥+A tapé deux fois : l’affichage ne bouge pas, le mode se lance puis s’arrête ; witmit caché : rien', async ({ page }) => {
  await ouvrirPropre(page, LIVE);
  await page.keyboard.press(H.ANNOTER);
  await page.keyboard.press(H.ANNOTER);
  await page.waitForTimeout(200);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await expect(page.locator('body')).not.toHaveClass(/cm-active/);
  await H.montrer(page);
  const etats = [];
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press(H.ANNOTER);
    etats.push(await page.locator('#cmToggleBtn').getAttribute('aria-pressed'));
  }
  expect(etats).toEqual(['true', 'false']);
  await page.waitForTimeout(200);
  await expect(page.locator('body')).not.toHaveClass(/cm-concealed/);
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
  // Entre deux essais, une pause de plus de 400 ms : le dernier appui d'un essai ne fait pas paire avec le suivant.
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
  await H.montrer(page);                                                // et rien n'est resté bloqué
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
  await H.montrer(page);
  await H.doubleAlt(page);
  await expect(page.locator('body')).toHaveClass(/cm-concealed/);
  await page.keyboard.press('Alt');
  expect(await prisesAlt(page)).toEqual([false, false, false, false, false]);
});
