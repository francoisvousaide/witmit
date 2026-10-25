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
    expect(await fondDe(page, '#cmPanel')).toBe('rgba(236, 232, 224, 0.6)');
  });

  for (const nom of ['tellus-accueil.html', 'planche-charte.html']) {
    test(`2. bascule en direct, liste ouverte comprise (${nom})`, async ({ page }) => {
      await page.goto(H.fileUrl(nom));
      await H.clearStorage(page); await page.reload();
      await page.locator('#cmPanelBtn').click();
      await expect(page.locator('#cmPanel')).toHaveClass(/show/);
      expect(await theme(page)).toBe('client-sombre');
      expect(await fondDe(page, '#cmPanel')).toBe('rgba(20, 19, 17, 0.66)');
      await basculerTheme(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect.poll(() => theme(page), { timeout: 1000 }).toBe('client-clair');
      await expect.poll(() => fondDe(page, '#cmPanel'), { timeout: 1000 }).toBe('rgba(236, 232, 224, 0.6)');
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
    expect(await fondDe(page, '#cmPanel')).toBe('rgba(20, 19, 17, 0.66)');
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
    expect(await fondDe(page, '.cm-popup')).toBe('rgba(20, 19, 17, 0.66)');
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
      await page.keyboard.press(H.SHORTCUT); // ⌥+A / alt+A lance le mode
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
      await page.keyboard.press(H.SHORTCUT);
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
