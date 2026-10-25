// Charte « Objet » : jetons, thème inverse, isolation, polices, fin de l'ancienne palette, halo jaune.
// Spécification technique de la course d'habillage (section 3.3, fichier charte.spec.js).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const SRC_DIR = path.resolve(__dirname, '..', '..', 'src');
const WIDGET_URL = 'file://' + path.join(SRC_DIR, 'witmit.js');
const POLICES_URL = 'file://' + path.join(SRC_DIR, 'witmit-polices') + '/';
const FAMILLES = ['witmit Tektur', 'witmit Martian Mono', 'witmit Syne', 'witmit Doto'];

// Valeurs de l'ancienne palette (T13), en minuscules et sans espaces.
const ANCIENNE_PALETTE = ['#fc8005', '252,128,5', '255,158,61', '255,181,107', '255,140,20', '#35838e', '53,131,142',
  '#235259', '#7bd0db', '123,208,219', '#5fbfcb', '#a8a6a0', '#b4231a', '#e5484d', '#8a5a00', '245,166,35', '#e6a023',
  'leaguespartan', 'dmsans'];
const sansEspaces = (s) => s.toLowerCase().replace(/\s+/g, '');

// Page d'essai écrite à la volée (dans le dossier temporaire du système) : elle charge le vrai witmit.js
// avec les attributs voulus. Sert aux cas qu'aucune page du dépôt ne couvre (réglage par l'hôte, isolation…).
function pageEssai(nom, { fond = '#ffffff', rootCss = '', attrs = '' } = {}) {
  const dir = path.join(os.tmpdir(), 'witmit-tests');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, nom + '.html');
  fs.writeFileSync(f, `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${nom}</title>
<style>:root{${rootCss}} body{margin:0;background:${fond};font-family:Georgia,serif;} .bloc{margin:80px;padding:40px;border:1px solid #888;}</style>
</head><body><div class="bloc" id="bloc">Un bloc de la page d'essai.</div>
<script src="${WIDGET_URL}" data-project="essai-${nom}" ${attrs}></script></body></html>`);
  return 'file://' + f;
}
const theme = (page) => page.getAttribute('body', 'data-wm-theme');
// Fond d'une fenêtre : porté par sa couche de verre depuis le lot 2 (habiller, F2).
const fondDe = (page, sel) => page.locator(sel).evaluate((el) => getComputedStyle(el).backgroundColor);
// Bascule le thème du site sans clic souris : un clic à côté de la liste la refermerait.
async function basculerTheme(page) {
  await page.locator('#themeBtn').focus();
  await page.keyboard.press('Enter');
}

test.describe('Thème', () => {
  test('1. thème automatique : page claire → verre graphite, page sombre → verre champagne', async ({ page }) => {
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await expect.poll(() => theme(page)).toBe('client-sombre');
    await page.goto(H.fileUrl('planche-charte.html'));
    await expect.poll(() => theme(page)).toBe('client-sombre');
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await expect.poll(() => theme(page)).toBe('client-clair');
    await page.locator('#cmPanelBtn').click();
    expect(await fondDe(page, '#cmPanel > .wm-verre')).toBe('rgba(236, 232, 224, 0.6)');
  });

  for (const nom of ['tellus-accueil.html', 'planche-charte.html']) {
    test(`2. bascule en direct, liste ouverte comprise (${nom})`, async ({ page }) => {
      await page.goto(H.fileUrl(nom));
      await H.clearStorage(page); await page.reload();
      await page.locator('#cmPanelBtn').click();
      await expect(page.locator('#cmPanel')).toHaveClass(/show/);
      expect(await theme(page)).toBe('client-sombre');
      expect(await fondDe(page, '#cmPanel > .wm-verre')).toBe('rgba(20, 19, 17, 0.66)');
      await basculerTheme(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect.poll(() => theme(page), { timeout: 1000 }).toBe('client-clair');
      await expect.poll(() => fondDe(page, '#cmPanel > .wm-verre'), { timeout: 1000 }).toBe('rgba(236, 232, 224, 0.6)');
      await expect(page.locator('#cmPanel')).toHaveClass(/show/); // la liste est restée ouverte
      await basculerTheme(page);
      await expect.poll(() => theme(page), { timeout: 1000 }).toBe('client-sombre');
    });
  }

  test('3. réglage par l’hôte : data-host-theme="dark" sur une page claire donne le verre champagne', async ({ page }) => {
    await page.goto(pageEssai('hote-sombre', { fond: '#ffffff', attrs: 'data-host-theme="dark"' }));
    await expect.poll(() => theme(page)).toBe('client-clair');
    await page.goto(pageEssai('hote-clair', { fond: '#101010', attrs: 'data-host-theme="light"' }));
    await expect.poll(() => theme(page)).toBe('client-sombre');
    await page.goto(pageEssai('hote-auto', { fond: '#101010' }));
    await expect.poll(() => theme(page)).toBe('client-clair');
  });

  test('4. isolation : les variables de la page n’entrent pas dans witmit, et les nôtres n’en sortent pas', async ({ page }) => {
    await page.goto(pageEssai('isolation', { rootCss: '--surface:red;--text:lime;--border:blue;' }));
    await page.locator('#cmPanelBtn').click();
    expect(await fondDe(page, '#cmPanel > .wm-verre')).toBe('rgba(20, 19, 17, 0.66)');
    const couleur = await page.locator('#cmPanel .cm-panel-head-row').evaluate((el) => getComputedStyle(el).color);
    expect(couleur).toBe('rgb(246, 243, 238)');
    const racine = await page.evaluate(() => {
      const r = getComputedStyle(document.documentElement);
      const b = getComputedStyle(document.body);
      return { wmInkRoot: r.getPropertyValue('--wm-ink'), wmInkBody: b.getPropertyValue('--wm-ink'), surface: r.getPropertyValue('--surface').trim() };
    });
    expect(racine.wmInkRoot).toBe('');
    expect(racine.wmInkBody).toBe('');
    expect(racine.surface).toBe('red');
    // TellUs déclare --surface, --text… : la fenêtre ne les reprend pas
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, '.mcard.active .mcard-title', 'Isolation');
    await page.locator('.cm-pin').click();
    expect(await fondDe(page, '.cm-popup > .wm-verre')).toBe('rgba(20, 19, 17, 0.66)');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface').trim())).toBe('#FFFFFF');
  });
});

test('5. ancienne palette absente du CSS injecté et du script', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  const css = sansEspaces(await page.locator('#cmStyles').evaluate((el) => el.textContent));
  const js = sansEspaces(fs.readFileSync(path.join(SRC_DIR, 'witmit.js'), 'utf8'));
  for (const v of ANCIENNE_PALETTE) {
    expect(css, `CSS injecté : ${v}`).not.toContain(v);
    expect(js, `witmit.js : ${v}`).not.toContain(v);
  }
  // plus de lecture des variables de couleur de l'hôte ni de son data-theme="dark"
  for (const v of ['--orange-500', '--teal-500', '--teal-700', 'var(--text', 'var(--surface', 'var(--border', '[data-theme="dark"]']) {
    expect(css, `CSS injecté : ${v}`).not.toContain(sansEspaces(v));
  }
});

test.describe('Polices', () => {
  test('6a. servies à côté du script, et prêtes pour les 4 familles une fois la liste ouverte', async ({ page }) => {
    const woff = [];
    page.on('request', (r) => { if (/\.woff2(\?|$)/.test(r.url())) woff.push(r.url()); });
    await page.goto(H.fileUrl('planche-charte.html'));
    await page.locator('#cmPanelBtn').click();
    await expect.poll(() => page.evaluate((f) => f.every((fam) => document.fonts.check('16px "' + fam + '"')), FAMILLES), { timeout: 5000 }).toBe(true);
    // les 4 familles sont bien chargées (et pas seulement inconnues) : une face « loaded » par famille
    const chargees = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
    for (const fam of FAMILLES) expect(chargees).toContain(fam);
    expect(woff.length).toBeGreaterThan(0);
    for (const u of woff) expect(u.startsWith(POLICES_URL), u).toBe(true);
  });

  test('6b. data-fonts="none" : aucune requête de police, polices du système', async ({ page }) => {
    const woff = [];
    page.on('request', (r) => { if (/\.woff2(\?|$)/.test(r.url())) woff.push(r.url()); });
    await page.goto(pageEssai('sans-polices', { attrs: 'data-fonts="none"' }));
    await page.locator('#cmPanelBtn').hover();
    await page.locator('#cmPanelBtn').click();
    await page.waitForTimeout(800);
    expect(woff).toHaveLength(0);
    expect(await page.locator('#cmStyles').evaluate((el) => el.textContent.indexOf('@font-face'))).toBe(-1);
  });

  test('7. chargement paresseux : en live caché, aucune police avant la révélation', async ({ page }) => {
    const woff = [];
    page.on('request', (r) => { if (/\.woff2(\?|$)/.test(r.url())) woff.push(r.url()); });
    await page.goto(H.fileUrl('generic-dashboard-live.html'));
    await H.clearStorage(page); await page.reload();
    await expect(page.locator('body')).toHaveClass(/cm-concealed/);
    await page.waitForTimeout(1000);
    expect(woff).toHaveLength(0);
    await page.evaluate(() => window.cmReveal(true));
    await expect.poll(() => woff.length, { timeout: 5000 }).toBeGreaterThan(0);
  });
});

test.describe('Aucune requête vers un domaine tiers', () => {
  const permis = (u) => /^(file:|data:|blob:|about:)/.test(u) || u.startsWith('https://witmit.test/');
  async function parcours(page, cible) {
    await H.activate(page);
    await H.addPin(page, cible.pin, 'Une épingle');
    const b = await H.visibleBox(page, cible.box);
    await H.drag(page, b.x - 6, b.y - 6, b.x + b.width + 6, b.y + b.height + 6);
    const ta = page.locator('.cm-popup textarea');
    await expect(ta).toBeVisible();
    await ta.fill('Un encadré');
    await ta.press('Enter');
    await page.waitForTimeout(1500); // la capture de l'encadré
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('.cm-panel-item')).toHaveCount(2);
  }

  test('8a. maquette (Kiosque, html2canvas local) et planche, de bout en bout', async ({ page }) => {
    const tiers = [];
    page.on('request', (r) => { if (!permis(r.url())) tiers.push(r.url()); });
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await parcours(page, { pin: 'tbody tr:first-child td:nth-child(2)', box: '.kpi-tile:nth-child(1)' });
    await page.goto(H.fileUrl('planche-charte.html'));
    await H.clearStorage(page); await page.reload();
    await parcours(page, { pin: '#boutonClair', box: '#carteSombre' });
    await basculerTheme(page);
    await page.waitForTimeout(500);
    expect(tiers).toEqual([]);
  });

  test('8b. live : révélation, encadré avec capture, envoi vers le faux guichet witmit.test', async ({ page }) => {
    const tiers = [];
    page.on('request', (r) => { if (!permis(r.url())) tiers.push(r.url()); });
    const state = {};
    await H.mockSupabase(page, state);
    await page.goto(H.fileUrl('generic-dashboard-sync.html'));
    await H.clearStorage(page);
    await page.goto(H.fileUrl('generic-dashboard-sync.html') + '?witmit=on');
    await parcours(page, { pin: 'tbody tr:first-child td:nth-child(2)', box: '.kpi-tile:nth-child(2)' });
    await expect.poll(() => state.posts.length, { timeout: 15000 }).toBe(2);
    expect(tiers).toEqual([]);
  });
});

test.describe('Halo du mode annotation', () => {
  // Toutes les couleurs rgb()/rgba() des ombres et des bordures de #cmFrame et de ses deux pseudo-éléments.
  const lireHalo = (page) => page.evaluate(() => {
    const el = document.getElementById('cmFrame');
    const out = {};
    for (const pseudo of ['', '::before', '::after']) {
      const s = getComputedStyle(el, pseudo || null);
      out[pseudo || 'cadre'] = { ombre: s.boxShadow, bord: [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor].join(' ') };
    }
    return out;
  });
  const couleurs = (txt) => (txt.match(/rgba?\([^)]*\)/g) || []).map((c) => {
    const n = c.match(/[\d.]+/g).map(Number);
    return { txt: c, r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 };
  });
  function teinte({ r, g, b }) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return null;
    let h;
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60;
    return h < 0 ? h + 360 : h;
  }
  const ANCIENNES_RGB = ['252,128,5', '255,158,61', '255,181,107', '255,140,20', '53,131,142', '35,82,89', '123,208,219', '95,191,203', '168,166,160', '180,35,26', '229,72,77', '138,90,0', '245,166,35', '230,160,35'];

  test('9. halo jaune, sans orange, identique sur une page claire et une page sombre', async ({ page }) => {
    const releves = {};
    for (const nom of ['tellus-accueil.html', 'generic-dashboard.html']) {
      await page.goto(H.fileUrl(nom));
      await page.keyboard.press(H.ANNOTER); // ⌥+A / alt+A lance le mode
      await expect(page.locator('body')).toHaveClass(/cm-active/);
      await expect(page.locator('#cmFrame')).toBeVisible();
      const halo = await lireHalo(page);
      releves[nom] = halo;
      const toutes = Object.values(halo).flatMap((v) => couleurs(v.ombre + ' ' + v.bord));
      expect(toutes.some((c) => c.r === 255 && c.g === 242 && c.b === 0 && c.a === 1), JSON.stringify(halo)).toBe(true);
      expect(toutes.some((c) => c.r === 10 && c.g === 10 && c.b === 10 && Math.abs(c.a - 0.9) < 0.001), 'filet sombre').toBe(true);
      for (const c of toutes) {
        if (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) > 40) {
          expect(Math.abs(teinte(c) - 57), `teinte de ${c.txt}`).toBeLessThanOrEqual(3);
        }
        expect(ANCIENNES_RGB, c.txt).not.toContain(`${c.r},${c.g},${c.b}`);
      }
      // mode arrêté : le halo disparaît
      await page.keyboard.press(H.ANNOTER);
      await expect(page.locator('body')).not.toHaveClass(/cm-active/);
      await expect(page.locator('#cmFrame')).toBeHidden();
      expect(await page.locator('#cmFrame').evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden');
    }
    expect(releves['tellus-accueil.html']).toEqual(releves['generic-dashboard.html']); // aucune variante de thème
  });

  test('10. le halo respire par l’opacité seule, en 4 s', async ({ page }) => {
    await page.goto(H.fileUrl('planche-charte.html'));
    await H.activate(page);
    const anims = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.id === 'cmFrame').map((a) => ({
      pseudo: a.effect.pseudoElement,
      duree: a.effect.getTiming().duration,
      iterations: a.effect.getTiming().iterations,
      proprietes: [...new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k)))].filter((p) => !['offset', 'computedOffset', 'easing', 'composite'].includes(p))
    })));
    const souffle = anims.find((a) => a.pseudo === '::after');
    expect(souffle, JSON.stringify(anims)).toBeTruthy();
    expect(souffle.duree).toBe(4000);
    expect(souffle.iterations).toBe(Infinity);
    for (const a of anims) expect(a.proprietes).toEqual(['opacity']); // aucune ombre animée
  });

  test('11. animations réduites : halo immobile mais allumé ; contraste forcé : bordure de 3 px', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(H.fileUrl('planche-charte.html'));
    await H.activate(page);
    const etat = await page.evaluate(() => {
      const el = document.getElementById('cmFrame');
      return {
        anims: document.getAnimations().filter((a) => a.effect && a.effect.target === el).length,
        opaciteApres: getComputedStyle(el, '::after').opacity,
        opaciteCadre: getComputedStyle(el).opacity, // lue aussitôt : apparition sans fondu
        bord: getComputedStyle(el, '::before').boxShadow
      };
    });
    expect(etat.anims).toBe(0);
    expect(etat.opaciteApres).toBe('0.5');
    expect(etat.opaciteCadre).toBe('1');
    expect(etat.bord).toContain('rgb(255, 242, 0)');
    await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'active' });
    const bordure = await page.locator('#cmFrame').evaluate((el) => {
      const s = getComputedStyle(el, '::before');
      return [s.borderTopWidth, s.borderTopStyle, s.borderLeftWidth];
    });
    expect(bordure).toEqual(['3px', 'solid', '3px']);
  });

  test('12b. le halo passe sous toutes les couches de witmit (liste, boutons, repères, fenêtre, bandeau)', async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Sous le halo');
    await page.locator('.cm-pin').click(); // fenêtre ouverte, cadre d'édition affiché
    await expect(page.locator('.cm-popup')).toBeVisible();
    const z = await page.evaluate(() => {
      const zi = (sel) => { const el = document.querySelector(sel); return el ? parseInt(getComputedStyle(el).zIndex, 10) : null; };
      // les liens d'une sélection multiple n'existent qu'avec plusieurs éléments : témoin le temps de la mesure
      let temoin = null;
      if (!document.getElementById('cmLinks')) { temoin = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); temoin.id = 'cmLinks'; document.body.appendChild(temoin); }
      const liens = zi('#cmLinks');
      if (temoin) temoin.remove();
      return { halo: zi('#cmFrame'), couches: { liste: zi('#cmPanel'), boutons: zi('.cm-fab'), epingle: zi('.cm-pin'), liens, cadre: zi('.cm-box'), fenetre: zi('.cm-popup'), bandeau: zi('#cmPill'), toast: zi('#cmStatus') } };
    });
    for (const [nom, v] of Object.entries(z.couches)) {
      expect(v, nom).not.toBeNull();
      expect(z.halo, `halo sous ${nom}`).toBeLessThan(v);
    }
    expect(z.halo).toBeGreaterThan(300); // reste au-dessus d'une barre de navigation de site (TellUs : 300)
    // liste ouverte en mode actif : au bord droit de l'écran, c'est la liste qui est dessus
    await page.keyboard.press('Escape');
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('#cmPanel')).toHaveClass(/show/);
    await expect.poll(() => page.evaluate(() => Math.round(document.getElementById('cmPanel').getBoundingClientRect().right - window.innerWidth))).toBe(0); // glissement fini
    const dessus = await page.evaluate(() => {
      const panel = document.getElementById('cmPanel');
      const frame = document.getElementById('cmFrame');
      frame.style.pointerEvents = 'auto';            // le temps de la mesure : le halo devient « touchable »
      const el = document.elementFromPoint(window.innerWidth - 2, window.innerHeight / 2);
      frame.style.pointerEvents = '';
      return panel.contains(el);
    });
    expect(dessus).toBe(true);
  });

  test('12. le halo ne prend aucun clic', async ({ page }) => {
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    const touches = await page.evaluate(() => {
      const w = window.innerWidth, h = window.innerHeight;
      return [[3, h / 2], [w - 4, h / 2], [w / 2, 3], [w / 3, h - 4]].map(([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el ? (el.id || el.tagName) : null;
      });
    });
    for (const t of touches) expect(t).not.toBe('cmFrame');
    // un clic à 4 px du bord gauche, sur la barre de navigation du site, ouvre la fenêtre de saisie
    await page.mouse.click(4, 28);
    await expect(page.locator('.cm-popup textarea')).toBeVisible();
  });
});

test('13. liste : le numéro du retour sélectionné est lisible (encre de l’autre thème)', async ({ page }) => {
  for (const [nom, fond, chiffre] of [['tellus-accueil.html', 'rgb(246, 243, 238)', 'rgb(20, 20, 18)'], ['generic-dashboard.html', 'rgb(20, 20, 18)', 'rgb(246, 243, 238)']]) {
    await page.goto(H.fileUrl(nom));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, nom === 'tellus-accueil.html' ? '.mcard.active .mcard-title' : 'tbody tr:first-child td:nth-child(2)', 'Numéro');
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    await page.locator('.cm-panel-item .body').first().click();
    await expect(page.locator('.cm-panel-item').first()).toHaveClass(/cm-current/);
    const num = await page.locator('.cm-panel-item.cm-current .num').evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
    expect(num, nom).toEqual([fond, chiffre]);
  }
});

test('14. fenêtre : la rangée de la catégorie, puce « auto » comprise, tient dans la fenêtre', async ({ page }) => {
  for (const nom of ['planche-charte.html', 'generic-dashboard.html', 'tellus-accueil.html']) {
    await page.goto(H.fileUrl(nom));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await page.mouse.click(300, 400);
    const ta = page.locator('.cm-popup textarea');
    await expect(ta).toBeVisible();
    await ta.fill('Le bouton est trop petit et le texte déborde un peu');
    const r = await page.evaluate(() => {
      const b = (sel) => document.querySelector(sel).getBoundingClientRect();
      return { popup: b('.cm-popup'), cat: b('.cm-cat'), auto: b('.cm-cat-auto') };
    });
    for (const k of ['cat', 'auto']) {
      expect(r[k].left, `${nom} ${k}`).toBeGreaterThanOrEqual(r.popup.left);
      expect(r[k].right, `${nom} ${k}`).toBeLessThanOrEqual(r.popup.right);
    }
  }
});

// ---------- Lot 2 : formes, touches, icônes, focus (F1 à F5, F8, F9, I1 à I3, T12) ----------

// Ouvre, sur une page, les fenêtres de witmit : bandeau (mode actif), fenêtre de saisie, liste et message passager.
async function ouvrirFenetres(page, nom, cible) {
  await page.goto(H.fileUrl(nom));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  await H.addPin(page, cible, 'Le bouton est trop petit');       // laisse un message passager « enregistré »
  await page.locator('.cm-pin').first().click();                 // rouvre la fenêtre de saisie (modification)
  await expect(page.locator('.cm-popup textarea')).toBeVisible();
  // Liste montrée telle quelle à côté de la fenêtre (tests d'aspect seulement) : l'ouvrir par son bouton ou par
  // cmTogglePanel fermerait la fenêtre de saisie, comme le veut le parcours.
  await page.evaluate(() => document.getElementById('cmPanel').classList.add('show'));
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await expect(page.locator('.cm-popup textarea')).toBeVisible();
}
const PAGES_LOT2 = [['planche-charte.html', '#carteClaire p'], ['generic-dashboard.html', 'tbody tr:first-child td:nth-child(2)']];

test('15. habiller : fenêtre, liste, bandeau, message passager et visionneuse portent ombre, verre et contour', async ({ page }) => {
  await ouvrirFenetres(page, 'planche-charte.html', '#carteClaire p');
  const r = await page.evaluate(() => ['.cm-popup', '#cmPanel', '#cmPill', '#cmStatus'].map((sel) => {
    const el = document.querySelector(sel);
    const kids = Array.from(el.children).slice(0, 3);
    const verre = el.querySelector(':scope > .wm-verre'), cs = getComputedStyle(verre);
    return {
      sel,
      premiers: kids.map((k) => k.classList[0]),
      muets: kids.every((k) => k.getAttribute('aria-hidden') === 'true' && getComputedStyle(k).pointerEvents === 'none'),
      coins: el.querySelectorAll(':scope > .wm-contour path').length,
      clip: cs.clipPath, flou: cs.backdropFilter || cs.webkitBackdropFilter,
      parentNu: getComputedStyle(el).clipPath === 'none' && getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)',
    };
  }));
  for (const f of r) {
    expect(f.premiers, f.sel).toEqual(['wm-ombre', 'wm-verre', 'wm-contour']);
    expect(f.muets, f.sel).toBe(true);
    expect(f.coins, f.sel).toBe(f.sel === '#cmStatus' ? 0 : 2);      // messages passagers : sans coins witmit
    expect(f.clip, f.sel).toContain('calc(100% - 11px)');            // coupe fixe de 11 px (F1)
    expect(f.flou, f.sel).toBe('blur(10px) saturate(1.7)');
    expect(f.parentNu, f.sel).toBe(true);                            // la fenêtre elle-même n'est ni découpée ni peinte
  }
});

test('15b. visionneuse : la capture s’agrandit dans une fenêtre habillée', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  await H.drag(page, 300, 300, 520, 420);
  const ta = page.locator('.cm-popup textarea');
  await ta.fill('Zone'); await ta.press('Enter');
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('.cm-panel-item img.cm-shot')).toBeVisible({ timeout: 15000 });
  await page.locator('.cm-panel-item img.cm-shot').click();
  const kids = await page.locator('.cm-lightbox .cm-lightbox-fenetre').evaluate((el) => Array.from(el.children).slice(0, 3).map((k) => k.classList[0]));
  expect(kids).toEqual(['wm-ombre', 'wm-verre', 'wm-contour']);
});

test('16. aucun parent du verre ne coupe le flou (F4), message passager compris pendant son fondu', async ({ page }) => {
  for (const [nom, cible] of PAGES_LOT2) {
    await ouvrirFenetres(page, nom, cible);
    await page.evaluate(() => document.getElementById('cmStatus').classList.add('show'));
    const fautes = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.wm-verre').forEach((v) => {
        for (let el = v.parentElement; el && el !== document.documentElement; el = el.parentElement) {
          const cs = getComputedStyle(el);
          if (cs.filter !== 'none' || parseFloat(cs.opacity) < 1 || (cs.maskImage && cs.maskImage !== 'none') || cs.clipPath !== 'none' ||
              cs.mixBlendMode !== 'normal' || (cs.backdropFilter && cs.backdropFilter !== 'none')) out.push((el.id || el.className) + ' > verre de ' + (v.parentElement.id || v.parentElement.className));
        }
      });
      return out;
    });
    expect(fautes, nom).toEqual([]);
  }
});

test('17. contour retracé à la taille réelle : trait à 0,5 px, angles cassés de 11 px, coins witmit', async ({ page }) => {
  await ouvrirFenetres(page, 'planche-charte.html', '#carteClaire p');
  const lire = () => page.locator('.cm-popup').evaluate((el) => {
    const svg = el.querySelector(':scope > .wm-contour');
    return { W: el.offsetWidth, H: el.offsetHeight, w: +svg.getAttribute('width'), h: +svg.getAttribute('height'),
      pts: svg.querySelector('polygon').getAttribute('points'), coins: Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d')) };
  });
  let c = await lire();
  expect([c.w, c.h]).toEqual([c.W, c.H]);
  expect(c.pts).toBe(`0.5,0.5 ${c.W - 11.2},0.5 ${c.W - 0.5},11.2 ${c.W - 0.5},${c.H - 0.5} 11.2,${c.H - 0.5} 0.5,${c.H - 11.2}`);
  expect(c.coins[0]).toBe('M8.4 16.8V8.4H16.8');
  // la fenêtre grandit : le même ResizeObserver retrace le contour
  await page.locator('.cm-popup').evaluate((el) => { el.style.width = '340px'; });
  await expect.poll(async () => (await lire()).w).toBe(340);
  c = await lire();
  expect(c.coins[1]).toBe(`M${340 - 8.4} ${c.H - 16.8}V${c.H - 8.4}H${340 - 16.8}`);
});

test('18. touches : coupe de 6 px et trait sur ::before, principale, secondaire, annuler, désactivé', async ({ page }) => {
  await ouvrirFenetres(page, 'planche-charte.html', '#carteClaire p');
  const st = (sel, pseudo) => page.locator(sel).first().evaluate((el, ps) => {
    const cs = getComputedStyle(el, ps);
    return { clip: cs.clipPath, bord: cs.borderTopColor, bordL: cs.borderTopWidth, couleur: cs.color, fond: cs.backgroundColor, curseur: cs.cursor };
  }, pseudo || null);
  const jetons = await page.locator('.cm-popup').evaluate((el) => {
    const cs = getComputedStyle(el), v = (n) => cs.getPropertyValue(n).trim();
    const rgb = (c) => { const d = document.createElement('i'); d.style.color = c; el.appendChild(d); const r = getComputedStyle(d).color; d.remove(); return r; };
    return { forte: rgb(v('--wm-line-strong')), fine: rgb(v('--wm-line')), faint: rgb(v('--wm-ink-faint')), soft: rgb(v('--wm-ink-soft')) };
  });
  const save = await st('.cm-popup .cm-save'), saveAvant = await st('.cm-popup .cm-save', '::before');
  expect(save.clip).toBe('none');                                       // le bouton n'est pas découpé (son focus ne serait pas rogné)
  expect(saveAvant.clip).toContain('polygon(6px 0px');                  // coins haut gauche et bas droit cassés
  expect(saveAvant.bord).toBe(jetons.forte);                            // principale : trait line-strong
  const sec = await st('#cmPanel .cm-panel-foot .wm-touche:not(.wm-principale)', '::before');
  expect(sec.bord).toBe(jetons.fine);                                   // secondaire : trait line
  const annuler = await st('.cm-popup .cm-cancel');
  expect(annuler.bordL).toBe('0px');
  expect(annuler.couleur).toBe(jetons.soft);                            // texte seul, ink-soft (jamais ink-faint sur le verre)
  // désactivé (fiche Etats) : trait line, libellé ink-faint, curseur par défaut, aucune opacité
  await page.locator('.cm-popup .cm-save').evaluate((el) => { el.disabled = true; });
  const off = await st('.cm-popup .cm-save'), offAvant = await st('.cm-popup .cm-save', '::before');
  expect(off.couleur).toBe(jetons.faint);
  expect(off.curseur).toBe('default');
  expect(offAvant.bord).toBe(jetons.fine);
  expect(await page.locator('.cm-popup .cm-save').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
});

test('19. focus clavier : anneau qui suit les coins sur une touche, outline sur un cercle, rien au clic souris', async ({ page }) => {
  await ouvrirFenetres(page, 'planche-charte.html', '#carteClaire p');
  const anneau = (sel) => page.locator(sel).evaluate((el) => {
    const cs = getComputedStyle(el, '::after');
    return { contenu: cs.content, clip: cs.clipPath, fond: cs.backgroundColor, l: cs.left, t: cs.top };
  });
  // au clic souris : pas d'anneau
  await page.locator('#cmPanel .cm-panel-foot .wm-touche', { hasText: 'Copier' }).hover();
  await page.mouse.down(); await page.mouse.up();
  expect((await anneau('#cmPanel .cm-panel-foot .wm-touche >> text=Copier')).contenu).toBe('none');
  // au clavier : Tab jusqu'à « envoyer par email », anneau de 2 px à 2 px de la forme, coins coupés
  await page.locator('#cmPanel .cm-panel-foot .wm-touche', { hasText: 'Copier' }).focus();
  await page.keyboard.press('Tab');
  const envoyer = '#cmPanel .cm-panel-report .wm-touche >> text=envoyer par email';
  await expect(page.locator(envoyer)).toBeFocused();
  const a = await anneau(envoyer);
  expect(a.contenu).toBe('""');
  expect([a.l, a.t]).toEqual(['-4px', '-4px']);
  expect(a.clip).toContain('evenodd');
  expect(a.clip).toContain('8.34px 0px');                              // coupe de 6 px + 2,34 px au bord extérieur
  // forme ronde : outline de 2 px à 2 px
  await page.locator('#cmPanel .wm-cercle[aria-label="fermer"]').focus();
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  const o = await page.locator('#cmPanel .wm-cercle[aria-label="fermer"]').evaluate((el) => [getComputedStyle(el).outlineStyle, getComputedStyle(el).outlineWidth, getComputedStyle(el).outlineOffset]);
  expect(o).toEqual(['solid', '2px', '2px']);
});

test('20. icônes Phosphor : SVG intégrés, viewBox 256, couleur du texte, muets ; avis MIT en tête du fichier', async ({ page }) => {
  await ouvrirFenetres(page, 'generic-dashboard.html', 'tbody tr:first-child td:nth-child(2)');
  const icones = await page.evaluate(() => Array.from(document.querySelectorAll('.cm-ui svg.wm-icone')).map((s) => ({
    vb: s.getAttribute('viewBox'), fill: s.getAttribute('fill'), muet: s.getAttribute('aria-hidden'), nom: s.dataset.icone })));
  expect(icones.length).toBeGreaterThan(10);
  for (const i of icones) expect(i, i.nom).toMatchObject({ vb: '0 0 256 256', fill: 'currentColor', muet: 'true' });
  const src = fs.readFileSync(path.join(SRC_DIR, 'witmit.js'), 'utf8');
  expect(src).toContain('Copyright (c) 2023 Phosphor Icons');
  expect(src).toContain('Permission is hereby granted, free of charge');
  for (const nom of ['CrosshairSimple', 'Info', 'PenNib', 'CursorClick', 'BoundingBox', 'TextT', 'SelectionPlus', 'SealQuestion', 'CheckCircle', 'WarningCircle',
    'CircleNotch', 'Trash', 'Broom', 'X', 'ArrowElbowDownLeft', 'Command', 'Option', 'DotsSixVertical', 'EyeSlash']) {
    expect(src, nom).toMatch(new RegExp('\\n    ' + nom + ": '<path d=\"M"));
  }
});

// Émojis et symboles dessinés par witmit (I3). Le texte courant garde ⌘ et ⌥ (glyphes de la police système).
const EMOJI = /[\p{Extended_Pictographic}️⠿✕✓✔↳▸▾]/u;
async function emojisDe(page) {
  return page.evaluate((src) => {
    const re = new RegExp(src, 'u'), out = [];
    document.querySelectorAll('.cm-ui').forEach((root) => {
      const tous = [root, ...root.querySelectorAll('*')];
      tous.forEach((el) => {
        if (el.closest('[data-wm-fourni="page"]')) return;
        for (const n of el.childNodes) if (n.nodeType === 3 && re.test(n.nodeValue)) out.push(n.nodeValue.trim());
        for (const a of ['title', 'aria-label', 'placeholder']) if (el.getAttribute(a) && re.test(el.getAttribute(a))) out.push(a + ' : ' + el.getAttribute(a));
      });
    });
    return out;
  }, EMOJI.source);
}

test('21a. aucun émoji dans ce que witmit dessine (maquette : tous les statuts, fenêtre, bandeau, liste)', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  for (const cel of ['tbody tr:nth-child(1) td:nth-child(2)', 'tbody tr:nth-child(2) td:nth-child(2)', 'tbody tr:nth-child(3) td:nth-child(2)',
    'tbody tr:nth-child(1) td:nth-child(1)', 'tbody tr:nth-child(2) td:nth-child(1)']) await H.addPin(page, cel, 'Retour');
  // statuts du mode maquette posés directement dans le stockage (même forme que le code)
  await page.evaluate(() => {
    const k = 'witmit_kiosque_v1', a = JSON.parse(localStorage.getItem(k));
    const d = new Date().toISOString();
    Object.assign(a[1], { status: 'signale', signaledAt: d });
    Object.assign(a[2], { status: 'pris_en_compte', ackAt: d, feedbackMessage: 'Vu' });
    Object.assign(a[3], { status: 'complement', complementAt: d, complementMessage: 'Sur quelle page ?' });
    Object.assign(a[4], { status: 'resolu', resolvedAt: d, resolvedBy: 'moi', replies: [{ text: 'Réponse', date: d }] });
    localStorage.setItem(k, JSON.stringify(a));
  });
  await page.reload();
  await H.activate(page);
  await page.locator('#cmPanelBtn').click();
  await page.locator('.cm-panel-item details.cm-tech summary').first().click();
  await page.locator('.cm-pin').nth(3).click();                  // fenêtre d'un complément demandé
  await expect(page.locator('.cm-popup')).toBeVisible();
  expect(await emojisDe(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.locator('.cm-pin').first().click();                 // fenêtre de modification (corbeille)
  expect(await emojisDe(page)).toEqual([]);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  expect(await emojisDe(page)).toEqual([]);
});

test('21b. aucun émoji dans ce que witmit dessine (live : marques d’envoi, fil, réponse refusée)', async ({ page }) => {
  const state = {};
  await H.mockSupabase(page, state);
  await page.goto(H.fileUrl('generic-dashboard-sync.html'));
  await H.clearStorage(page);
  await page.goto(H.fileUrl('generic-dashboard-sync.html') + '?witmit=on');
  await H.activate(page);
  await H.addPin(page, 'tbody tr:nth-child(1) td:nth-child(2)', 'Ticket 1');
  await expect.poll(async () => (((await H.stored(page, 'witmit_kiosque-sync_v1'))[0] || {}).sync || {}).state, { timeout: 15000 }).toBe('sent');
  const t = (await H.stored(page, 'witmit_kiosque-sync_v1'))[0];
  state.rows.push({ id_local: t.id, statut: 'en_cours', message_retour: 'Corrigé ?', mis_a_jour_le: '2026-09-28T10:00:00Z',
    messages: [{ de: 'equipe', texte: 'Corrigé ?', rouvre: false, cree_le: '2026-09-28T10:00:00Z' }, { de: 'auteur', texte: 'Non', rouvre: true, cree_le: '2026-09-29T10:00:00Z' }] });
  state.failNext = { status: 429, erreur: 'quota' };
  await H.addPin(page, 'tbody tr:nth-child(2) td:nth-child(2)', 'Ticket 2');   // refusé : « à renvoyer »
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('.cm-msg')).toHaveCount(2, { timeout: 15000 });
  await expect(page.locator('.cm-sync-chip')).not.toHaveCount(0);
  expect(await emojisDe(page)).toEqual([]);
});

test('22. voyant (F8) : disque net de 7 px, sans ombre ; cerne intérieur seulement sur fond clair', async ({ page }) => {
  for (const [nom, cible, cerne] of [['planche-charte.html', '#carteClaire p', false], ['generic-dashboard.html', 'tbody tr:first-child td:nth-child(2)', true]]) {
    await page.goto(H.fileUrl(nom));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, cible, 'Voyant');
    await H.deactivate(page);
    const proj = nom === 'planche-charte.html' ? 'planche' : 'kiosque';
    const [c] = await H.stored(page, 'witmit_' + proj + '_v1');
    await H.retourColle(page, [c.id + ' pris_en_compte']);            // l'équipe a changé le statut : voyant allumé (C5)
    const v = await page.locator('#cmCount').evaluate((el) => {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, rond: cs.borderTopLeftRadius, ombre: cs.boxShadow, fond: cs.backgroundColor, cerne: parseFloat(cs.borderTopWidth) > 0, entier: Number.isInteger(r.left * devicePixelRatio) && Number.isInteger(r.top * devicePixelRatio) };
    });
    expect(v, nom).toMatchObject({ w: 7, h: 7, rond: '50%', ombre: 'none', fond: 'rgb(255, 242, 0)', cerne, entier: true });
  }
});

test('23. contraste sur le verre (T12) : aucun texte en ink-faint hors champ, zone en creux ou désactivé', async ({ page }) => {
  for (const [nom, cible] of PAGES_LOT2) {
    await ouvrirFenetres(page, nom, cible);
    const fautes = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.cm-popup, #cmPanel, #cmPill, #cmStatus').forEach((f) => {
        const probe = document.createElement('i'); probe.style.color = 'var(--wm-ink-faint)'; f.appendChild(probe);
        const faint = getComputedStyle(probe).color; probe.remove();
        f.querySelectorAll('*').forEach((el) => {
          if (el.closest('textarea, input, select, .wm-champ, .cm-feedback, .cm-msg-equipe, details pre, [disabled], [aria-disabled="true"], .wm-inactif, .wm-contour')) return;
          const texte = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.nodeValue.trim());
          if (texte && getComputedStyle(el).color === faint) out.push(el.className || el.tagName);
        });
      });
      return out;
    });
    expect(fautes, nom).toEqual([]);
  }
});

// Lot 6 — repères sur le site (fiches Reperes, Epingle, Selection ; F6, F7, F10, T7).
async function planche(page) {
  await page.goto(H.fileUrl('planche-charte.html'));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
}
// Couleur du coin witmit haut gauche d'un cadre (::before de .wm-cadre) et état de ses traits.
const cadreDe = (loc) => loc.evaluate((b) => {
  const c = b.querySelector(':scope > .wm-cadre'), cs = getComputedStyle(c), av = getComputedStyle(c, '::before');
  const r = c.getBoundingClientRect(), e = b.getBoundingClientRect();
  const fond = av.backgroundImage.match(/rgba?\([^)]*\)/);
  return { coin: fond ? fond[0] : null, epaisseur: av.backgroundSize.split(',')[0].trim().split(' ')[1], marge: Math.round(e.left - r.left), traitH: cs.getPropertyValue('--wm-th').replace(/\s/g, ''), traitV: cs.getPropertyValue('--wm-tv').replace(/\s/g, ''), sombre: b.classList.contains('wm-sur-sombre') };
});

test('24. une seule encre par repère, d’après le fond derrière lui ; un petit élément n’a que les deux coins', async ({ page }) => {
  await planche(page);
  await H.addPin(page, '#petitClair', 'petit');
  await H.addPin(page, '#carteSombre', 'grand');
  await page.waitForTimeout(1500);                                  // fin de l'effet « vient d'être commenté »
  const petit = await cadreDe(page.locator('.cm-box-outline').nth(0));
  const grand = await cadreDe(page.locator('.cm-box-outline').nth(1));
  // Petit élément (18 px + 2 × 16 px de marge < 56 px) : coins seuls, encre sur fond clair.
  expect(petit).toMatchObject({ coin: 'rgb(20, 20, 18)', epaisseur: '3.6px', marge: 16, traitH: 'transparent', traitV: 'transparent', sombre: false });
  // Grand élément sur la moitié sombre : coins et traits de 1 px à 55 %, blanc cassé.
  expect(grand).toMatchObject({ coin: 'rgb(246, 243, 238)', marge: 16, traitH: 'rgba(246,243,238,.55)', traitV: 'rgba(246,243,238,.55)', sombre: true });
  // Épingles : verre champagne et chiffre encre sur fond clair ; verre graphite et chiffre blanc cassé sur fond sombre.
  const pins = await page.locator('.cm-pin').evaluateAll((ps) => ps.map((p) => ({ fond: getComputedStyle(p).backgroundColor, chiffre: getComputedStyle(p).color, h: p.getBoundingClientRect().height })));
  expect(pins).toEqual([
    { fond: 'rgba(236, 232, 224, 0.6)', chiffre: 'rgb(20, 20, 18)', h: 24 },
    { fond: 'rgba(20, 19, 17, 0.66)', chiffre: 'rgb(246, 243, 238)', h: 24 }
  ]);
  // Actif (survol) : métal, sans verre ; les cadres du retour passent à traits pleins.
  await page.locator('.cm-pin').nth(1).hover();
  const actif = await page.locator('.cm-pin').nth(1).evaluate((p) => ({ fond: getComputedStyle(p).backgroundImage, flou: getComputedStyle(p).backdropFilter }));
  expect(actif.fond).toContain('linear-gradient');
  expect(actif.flou).toBe('none');
  expect((await cadreDe(page.locator('.cm-box-outline').nth(1))).traitH).toBe('#f6f3ee');
});

test('25. épingle : voyant « nouveau » et nom accessible ; traité en pointillés ; passage souligné entre deux coins', async ({ page }) => {
  await planche(page);
  await H.addPin(page, '#boutonClair', 'bouton');
  await page.waitForTimeout(1500);                                  // fin de l'effet « vient d'être commenté »
  const [c] = await H.stored(page, 'witmit_planche_v1');
  await expect(page.locator('.cm-pin')).toHaveAttribute('aria-label', 'retour 1');
  await expect(page.locator('.cm-pin')).toHaveAttribute('role', 'button');
  await H.retourColle(page, [c.id + ' pris_en_compte']);            // l'équipe a changé le statut : du nouveau (C5)
  await page.mouse.move(400, 900);
  await expect(page.locator('.cm-pin .wm-voyant-epingle')).toHaveCount(1);
  await expect(page.locator('.cm-pin')).toHaveAttribute('aria-label', 'retour 1, pris en compte, nouveau');
  const v = await page.locator('.cm-pin .wm-voyant-epingle').evaluate((el) => { const cs = getComputedStyle(el), r = el.getBoundingClientRect(); return { w: r.width, h: r.height, fond: cs.backgroundColor, ombre: cs.boxShadow }; });
  expect(v).toEqual({ w: 7, h: 7, fond: 'rgb(255, 242, 0)', ombre: 'none' });
  // Traité : contour en pointillés, ni ombre ni liseré.
  await H.retourColle(page, [c.id + ' resolu']);
  await page.mouse.move(400, 900);                                // aucun survol (ligne de la liste ou épingle)
  const t = await page.locator('.cm-pin').evaluate((p) => ({ trait: getComputedStyle(p).outlineStyle, ombre: getComputedStyle(p).boxShadow }));
  expect(t).toEqual({ trait: 'dashed', ombre: 'none' });
  // Passage de texte sur la moitié sombre : souligné de 2 px blanc cassé, coins witmit de 7 px au début et à la fin.
  await page.locator('#cmPanelBtn').click();                      // ferme la liste (le voyant s'éteint : vu)
  await expect(page.locator('.cm-pin .wm-voyant-epingle')).toHaveCount(0);
  await page.waitForTimeout(400);                                   // fin du retour de la page (liste en mode « pousser »)
  const p = await H.visibleBox(page, '#moitieSombre > p');
  await H.drag(page, p.x + 4, p.y + 10, p.x + 160, p.y + 10, { shift: true });
  await page.locator('.cm-popup textarea').fill('passage');
  await page.locator('.cm-popup textarea').press('Enter');
  await page.waitForTimeout(1500);
  // Taille RENDUE des coins (largeur + bordures si le navigateur est en content-box), mesurée comme sur un site sans
  // remise à zéro : la planche pose * { box-sizing: border-box }, qu'on annule ici pour la mesure.
  await page.addStyleTag({ content: '*, *::before, *::after { box-sizing: content-box; }' });
  const passage = () => page.locator('mark.cm-highlight').evaluateAll((ms) => ms.map((el) => {
    const cs = getComputedStyle(el), rendu = (ps) => ps.content === 'none' ? null
      : (ps.boxSizing === 'border-box' ? parseFloat(ps.width) : parseFloat(ps.width) + parseFloat(ps.borderLeftWidth) + parseFloat(ps.borderRightWidth));
    return { fond: cs.backgroundColor, marge: cs.marginLeft + ' ' + cs.marginRight, trait: cs.textDecorationThickness, couleur: cs.textDecorationColor,
      debut: el.classList.contains('wm-debut') ? rendu(getComputedStyle(el, '::before')) : null, fin: el.classList.contains('wm-fin') ? rendu(getComputedStyle(el, '::after')) : null };
  }));
  // Repos : souligné de 2 px, coins de 7 px ; aucune marge (witmit ne touche qu'au trait, relecture de Paula).
  let m = await passage();
  expect(m[0]).toMatchObject({ fond: 'rgba(0, 0, 0, 0)', marge: '0px 0px', trait: '2px', couleur: 'rgb(246, 243, 238)', debut: 7 });
  expect(m[m.length - 1].fin).toBe(7);
  // Actif (fenêtre ouverte depuis son épingle) : souligné de 3 px, coins de 10 px.
  await page.locator('.cm-pin').nth(1).click();
  await expect(page.locator('mark.cm-highlight').first()).toHaveClass(/cm-focus/);
  m = await passage();
  expect(m[0]).toMatchObject({ trait: '3px', debut: 10 });
  expect(m[m.length - 1].fin).toBe(10);
  // Échap ferme la fenêtre et rend le focus à l'épingle qui l'avait ouverte (comme la visionneuse).
  await page.keyboard.press('Escape');
  await expect(page.locator('.cm-popup')).toHaveCount(0);
  await expect(page.locator('.cm-pin').nth(1)).toBeFocused();
});

test('26. zone en édition : 6 carrés de 8 px et 2 coins witmit ; la fenêtre ne recouvre ni le cadre ni l’épingle', async ({ page }) => {
  await planche(page);
  const img = await H.visibleBox(page, '#imageVive');
  await H.drag(page, img.x + 40, img.y + 30, img.x + 260, img.y + 160);
  await expect(page.locator('.cm-box-editable .cm-handle')).toHaveCount(8);
  const poignees = await page.locator('.cm-box-editable .cm-handle').evaluateAll((hs) => hs.map((h) => {
    const r = h.getBoundingClientRect(), a = getComputedStyle(h, '::after');
    return { dir: h.dataset.dir, prise: Math.round(r.width), carre: a.content === 'none' ? null : a.width };
  }));
  // Zone de plus de 88 px de côté : prise de 44 px ; les coins haut gauche et bas droit n'ont pas de carré.
  for (const h of poignees) expect(h, h.dir).toEqual({ dir: h.dir, prise: 44, carre: h.dir === 'nw' || h.dir === 'se' ? null : '8px' });
  await page.locator('.cm-popup textarea').fill('zone');
  await page.locator('.cm-popup textarea').press('Enter');
  await page.locator('.cm-pin').click();
  // Les 8 poignées se saisissent, même celle du coin haut droit, sous l'épingle (sa zone de 44 px les laisse passer).
  await expect(page.locator('.cm-box-editable .cm-handle')).toHaveCount(8);
  const touchees = await page.locator('.cm-box-editable .cm-handle').evaluateAll((hs) => hs.map((h) => {
    const r = h.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return h.dataset.dir + ':' + (e === h);
  }));
  expect(touchees).toEqual(['nw:true', 'n:true', 'ne:true', 'e:true', 'se:true', 's:true', 'sw:true', 'w:true']);
  const pop = await page.locator('.cm-popup').boundingBox(), pin = await page.locator('.cm-pin').boundingBox(), box = await page.locator('.cm-box-editable').boundingBox();
  const chevauche = (a, b) => !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
  expect(chevauche(pop, pin)).toBe(false);
  expect(chevauche(pop, box)).toBe(false);
});
