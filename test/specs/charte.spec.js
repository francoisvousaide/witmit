// Charte V2 (avant : « Objet ») : jetons, thème du site, isolation, police système, fin de l'ancienne palette, halo orange.
// Spécification technique de la course d'habillage (section 3.3, fichier charte.spec.js).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const SRC_DIR = path.resolve(__dirname, '..', '..', 'src');
const WIDGET_URL = 'file://' + path.join(SRC_DIR, 'witmit.js');
// Familles des polices embarquées de 0.2.0 : plus aucune n'est déclarée ni chargée depuis la V2 (police système).
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
  test('1. thème automatique : page claire → titane clair, page sombre → titane sombre (witmit suit le site)', async ({ page }) => {
    await page.goto(H.fileUrl('tellus-accueil.html'));
    await expect.poll(() => theme(page)).toBe('client-clair');
    await page.goto(H.fileUrl('planche-charte.html'));
    await expect.poll(() => theme(page)).toBe('client-clair');
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await expect.poll(() => theme(page)).toBe('client-sombre');
    await page.locator('#cmPanelBtn').click();
    expect(await fondDe(page, '#cmPanel > .wm-verre')).toBe('rgb(27, 27, 27)');   // liste mate, titane sombre
  });

  for (const nom of ['tellus-accueil.html', 'planche-charte.html']) {
    test(`2. bascule en direct, liste ouverte comprise (${nom})`, async ({ page }) => {
      await page.goto(H.fileUrl(nom));
      await H.clearStorage(page); await page.reload();
      await page.locator('#cmPanelBtn').click();
      await expect(page.locator('#cmPanel')).toHaveClass(/show/);
      expect(await theme(page)).toBe('client-clair');
      expect(await fondDe(page, '#cmPanel > .wm-verre')).toBe('rgb(250, 250, 250)');   // liste mate, titane clair
      await basculerTheme(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect.poll(() => theme(page), { timeout: 1000 }).toBe('client-sombre');
      await expect.poll(() => fondDe(page, '#cmPanel > .wm-verre'), { timeout: 1000 }).toBe('rgb(27, 27, 27)');
      await expect(page.locator('#cmPanel')).toHaveClass(/show/); // la liste est restée ouverte
      await basculerTheme(page);
      await expect.poll(() => theme(page), { timeout: 1000 }).toBe('client-clair');
    });
  }

  test('3. réglage par l’hôte : data-host-theme="dark" sur une page claire donne le titane sombre', async ({ page }) => {
    await page.goto(pageEssai('hote-sombre', { fond: '#ffffff', attrs: 'data-host-theme="dark"' }));
    await expect.poll(() => theme(page)).toBe('client-sombre');
    await page.goto(pageEssai('hote-clair', { fond: '#101010', attrs: 'data-host-theme="light"' }));
    await expect.poll(() => theme(page)).toBe('client-clair');
    await page.goto(pageEssai('hote-auto', { fond: '#101010' }));
    await expect.poll(() => theme(page)).toBe('client-sombre');
  });

  test('4. isolation : les variables de la page n’entrent pas dans witmit, et les nôtres n’en sortent pas', async ({ page }) => {
    await page.goto(pageEssai('isolation', { rootCss: '--surface:red;--text:lime;--border:blue;' }));
    await page.locator('#cmPanelBtn').click();
    expect(await fondDe(page, '#cmPanel > .wm-verre')).toBe('rgb(250, 250, 250)');   // page blanche : liste titane clair
    const couleur = await page.locator('#cmPanel .cm-panel-head-row').evaluate((el) => getComputedStyle(el).color);
    expect(couleur).toBe('rgb(20, 20, 20)');
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
    expect(await fondDe(page, '.cm-popup > .wm-verre')).toBe('rgba(250, 250, 250, 0.72)');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface').trim())).toBe('#FFFFFF');
  });
});

test.describe('Thème suivi et matières (V2)', () => {
  // Matières d'une fenêtre ouverte sur une page d'essai au fond donné : verre, flou, ombre, métal du bouton witmit.
  async function matieres(page, nom, fond) {
    await page.goto(pageEssai(nom, { fond }));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    const b = await H.visibleBox(page, '#bloc');
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(page.locator('.cm-popup textarea')).toBeVisible();
    return page.evaluate(() => {
      const verre = getComputedStyle(document.querySelector('.cm-popup > .wm-verre'));
      const ombre = document.querySelector('.cm-popup > .wm-ombre');
      const btn = getComputedStyle(document.getElementById('cmPanelBtn'));
      return {
        theme: document.body.getAttribute('data-wm-theme'),
        fond: verre.backgroundColor, flou: verre.backdropFilter || verre.webkitBackdropFilter,
        ombre: getComputedStyle(ombre.firstElementChild).backgroundColor, ombreDecalage: getComputedStyle(ombre).top, ombreFlou: getComputedStyle(ombre).filter,
        encre: getComputedStyle(document.querySelector('.cm-popup .cm-titre')).color,
        metal: btn.color,
      };
    });
  }

  test('4b. thème suivi : site clair → witmit clair, site sombre → witmit sombre, boutons ronds compris', async ({ page }) => {
    const clair = await matieres(page, 'v2-site-clair', '#ffffff');
    expect(clair).toMatchObject({ theme: 'client-clair', encre: 'rgb(20, 20, 20)', metal: 'rgb(20, 20, 20)' });   // métal clair, signe encre
    const sombre = await matieres(page, 'v2-site-sombre', '#101010');
    expect(sombre).toMatchObject({ theme: 'client-sombre', encre: 'rgb(255, 255, 255)', metal: 'rgb(244, 244, 244)' });   // métal sombre, signe clair
  });

  test('4c. verre 72 % en clair et 70 % en sombre, flou de 40 px, saturation 1,9 ; ombre macOS à 34 % ; lueur blanche à 22 %', async ({ page }) => {
    const clair = await matieres(page, 'v2-verre-clair', '#ffffff');
    expect(clair).toMatchObject({ fond: 'rgba(250, 250, 250, 0.72)', flou: 'blur(40px) saturate(1.9)', ombre: 'rgba(0, 0, 0, 0.34)', ombreDecalage: '22px', ombreFlou: 'blur(28px)' });
    const sombre = await matieres(page, 'v2-verre-sombre', '#101010');
    expect(sombre).toMatchObject({ fond: 'rgba(27, 27, 27, 0.7)', flou: 'blur(40px) saturate(1.9)', ombre: 'rgba(255, 255, 255, 0.22)', ombreDecalage: '22px', ombreFlou: 'blur(28px)' });
  });
});

test.describe('Champs et textes de la personne (V2, relecture de Paula)', () => {
  // Couleur rgba lue par getComputedStyle → [r, g, b, a].
  const lire = (c) => { const n = c.match(/[\d.]+/g).map(Number); return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1]; };
  const poser = (dessus, dessous) => { const a = dessus[3]; return [0, 1, 2].map((i) => dessus[i] * a + dessous[i] * (1 - a)); };
  const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contraste = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };

  async function fenetre(page, nom, fond) {
    await page.goto(pageEssai(nom, { fond }));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    const b = await H.visibleBox(page, '#bloc');
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(page.locator('.cm-popup textarea')).toBeVisible();
  }

  test('É1. texte d’aide du champ de la fenêtre à 60 % : au moins 4,6:1 sur la face du champ, en clair et en sombre, focus compris', async ({ page }) => {
    for (const [nom, fond] of [['champ-clair', '#ffffff'], ['champ-sombre', '#101010']]) {
      await fenetre(page, nom, fond);
      for (const focus of [false, true]) {
        if (focus) await page.locator('.cm-popup textarea').focus();
        const c = await page.evaluate(() => {
          const ta = document.querySelector('.cm-popup textarea');
          return { site: getComputedStyle(document.body).backgroundColor, verre: getComputedStyle(document.querySelector('.cm-popup > .wm-verre')).backgroundColor,
            bloc: getComputedStyle(document.querySelector('.cm-popup .wm-bloc')).backgroundColor,
            champ: getComputedStyle(ta).backgroundColor, aide: getComputedStyle(ta, '::placeholder').color };
        });
        // Face réelle : le champ, posé sur le bloc intérieur (lot 3), posé sur le verre, posé sur le site.
        const face = poser(lire(c.champ), poser(lire(c.bloc), poser(lire(c.verre), lire(c.site).slice(0, 3))));
        expect(c.bloc, nom).toMatch(nom === 'champ-clair' ? /^rgba\(0, 0, 0, 0\.02[78]\)$/ : /^rgba\(255, 255, 255, 0\.04\)$/);   // 2,8 % (le navigateur arrondit l'alpha au 1/255)
        const ratio = contraste(poser(lire(c.aide), face), face);
        expect(c.champ, nom).toBe(nom === 'champ-clair' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.06)');
        expect(lire(c.aide)[3], nom).toBeCloseTo(0.6, 2);
        expect(ratio, `${nom}${focus ? ' (focus)' : ''} : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.6);
      }
    }
  });

  test('É2. texte d’aide : 14 px dans le champ de la fenêtre, 13 px dans la liste (réponse)', async ({ page }) => {
    await fenetre(page, 'aide-fenetre', '#ffffff');
    expect(await page.locator('.cm-popup textarea').evaluate((ta) => getComputedStyle(ta, '::placeholder').fontSize)).toBe('14px');
    await page.locator('.cm-popup textarea').fill('Un retour');
    await page.locator('.cm-popup textarea').press('Enter');
    await H.deactivate(page);
    const [c] = await H.stored(page, 'witmit_essai-aide-fenetre_v1');
    await H.retourColle(page, [c.id + ' complement | Quelle ligne ?']);
    await H.ouvrirRetour(page, page.locator('.cm-panel-item').first());   // c1 (V2) : le champ de réponse s'ouvre avec le retour
    await expect(page.locator('.cm-panel-item textarea.cm-inline-reply')).toBeVisible();
    expect(await page.locator('.cm-panel-item textarea.cm-inline-reply').evaluate((ta) => getComputedStyle(ta, '::placeholder').fontSize)).toBe('13px');
  });

  test('É3. liste : texte de la personne et champ de modification à 14 px (face du champ de la fenêtre) ; champ de réponse à 15 px', async ({ page }) => {
    await fenetre(page, 'liste-tailles', '#ffffff');
    await page.locator('.cm-popup textarea').fill('Un retour');
    await page.locator('.cm-popup textarea').press('Enter');
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    expect(await page.locator('.cm-panel-item .txt').evaluate((el) => getComputedStyle(el).fontSize)).toBe('14px');
    await H.ouvrirRetour(page, page.locator('.cm-panel-item').first());   // c1 (V2) : le champ s'ouvre avec le retour
    const edition = page.locator('.cm-panel-item textarea.cm-inline-edit:not(.cm-inline-reply)');
    await expect(edition).toBeVisible();
    expect(await edition.evaluate((ta) => [getComputedStyle(ta).fontSize, getComputedStyle(ta).backgroundColor])).toEqual(['14px', 'rgba(255, 255, 255, 0.8)']);
    await edition.press('Escape');
    const [c] = await H.stored(page, 'witmit_essai-liste-tailles_v1');
    await H.retourColle(page, [c.id + ' complement | Quelle ligne ?']);
    await H.ouvrirRetour(page, page.locator('.cm-panel-item').first());
    await expect(page.locator('.cm-panel-item textarea.cm-inline-reply')).toBeVisible();
    expect(await page.locator('.cm-panel-item textarea.cm-inline-reply').evaluate((ta) => getComputedStyle(ta).fontSize)).toBe('15px');
  });

  test('É4. encart « coller un retour » : titre en graisse 500, champ en 13 px, interligne 1,5', async ({ page }) => {
    await page.goto(pageEssai('coller-retour'));
    await page.locator('#cmPanelBtn').click();
    await page.locator('#cmPasteBtn').click();
    await expect(page.locator('#cmFeedbackBox textarea')).toBeVisible();
    const m = await page.evaluate(() => {
      const t = getComputedStyle(document.querySelector('#cmFeedbackBox .cm-feedback-title')), ta = getComputedStyle(document.querySelector('#cmFeedbackBox textarea'));
      return { titre: t.fontWeight, taille: ta.fontSize, interligne: ta.lineHeight };
    });
    expect(m).toEqual({ titre: '500', taille: '13px', interligne: '19.5px' });
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

test.describe('Police système (V2)', () => {
  // Une requête de police : fichier de police, ou feuille d'un service de polices.
  const estPolice = (u) => /\.(woff2?|ttf|otf|eot)(\?|#|$)/i.test(u) || /fonts\.(googleapis|gstatic)\.com|use\.typekit|fonts\.bunny/i.test(u);
  const policesDeclarees = (page) => page.evaluate(() => [...document.fonts].map((f) => f.family.replace(/"/g, '')));

  test('6a. aucune police embarquée chargée ni déclarée : liste, fenêtre et bandeau ouverts', async ({ page }) => {
    const polices = [];
    page.on('request', (r) => { if (estPolice(r.url())) polices.push(r.url()); });
    await page.goto(H.fileUrl('planche-charte.html'));
    await page.locator('#cmPanelBtn').hover();
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('#cmPanel')).toHaveClass(/show/);
    await page.locator('#cmPanelBtn').click();
    await H.activate(page);
    await H.addPin(page, '#carteClaire p', 'police');
    await page.locator('.cm-pin').click();
    await expect(page.locator('.cm-popup textarea')).toBeVisible();
    await page.waitForTimeout(800);
    expect(polices).toEqual([]);
    expect(await page.locator('#cmStyles').evaluate((el) => el.textContent.indexOf('@font-face'))).toBe(-1);
    const declarees = await policesDeclarees(page);
    for (const fam of FAMILLES) expect(declarees, fam).not.toContain(fam);
    expect(fs.existsSync(path.join(SRC_DIR, 'witmit-polices')), 'dossier witmit-polices/ retiré').toBe(false);
    // police système partout, texte de la personne compris ; aucune famille de 0.2.0
    const familles = await page.evaluate(() => ['.cm-popup .cm-titre', '.cm-popup textarea', '#cmPill', '#cmPanelBtn'].map((sel) => getComputedStyle(document.querySelector(sel)).fontFamily));
    for (const f of familles) {
      expect(f).toMatch(/^-apple-system, /);
      for (const fam of ['Tektur', 'Martian', 'Syne', 'Doto']) expect(f).not.toContain(fam);
    }
  });

  test('6b. data-fonts est ignoré : aucune requête de police, quelle que soit sa valeur', async ({ page }) => {
    const polices = [];
    page.on('request', (r) => { if (estPolice(r.url())) polices.push(r.url()); });
    for (const [nom, v] of [['sans-polices', 'none'], ['polices-ailleurs', 'https://polices.exemple.test/witmit/']]) {
      await page.goto(pageEssai(nom, { attrs: `data-fonts="${v}"` }));
      await page.locator('#cmPanelBtn').hover();
      await page.locator('#cmPanelBtn').click();
      await page.waitForTimeout(800);
      expect(await page.locator('#cmStyles').evaluate((el) => el.textContent.indexOf('@font-face'))).toBe(-1);
    }
    expect(polices).toEqual([]);
  });

  test('7. live : aucune requête de police, ni avant ni après la révélation', async ({ page }) => {
    const polices = [];
    page.on('request', (r) => { if (estPolice(r.url())) polices.push(r.url()); });
    await page.goto(H.fileUrl('generic-dashboard-live.html'));
    await H.clearStorage(page); await page.reload();
    await expect(page.locator('body')).toHaveClass(/cm-concealed/);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.cmReveal(true));
    await page.locator('#cmPanelBtn').hover();
    await page.locator('#cmPanelBtn').click();
    await page.waitForTimeout(1000);
    expect(polices).toEqual([]);
  });

  test('7b. tailles et graisses V2 : aucun texte sous 13 px ; titres semi-gras ; texte de la personne 15 px normal ; principal 500', async ({ page }) => {
    await page.goto(H.fileUrl('planche-charte.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    await H.addPin(page, '#carteClaire p', 'tailles');
    await page.locator('.cm-pin').click();
    await expect(page.locator('.cm-popup textarea')).toBeVisible();
    const m = await page.evaluate(() => {
      const cs = (sel) => getComputedStyle(document.querySelector(sel));
      // Texte visible : ni réservé aux lecteurs d'écran (.wm-lu), ni sorti de la vue (nombre du voyant), ni en taille 0 (bouton à icône).
      // Couches de witmit seulement (la planche pose aussi des spécimens .cm-ui légendés par la page elle-même).
      const textes = [...document.querySelectorAll('.cm-ui, .cm-ui *')].filter((el) => !el.closest('.wm-specimen')).filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim()) && el.getClientRects().length
        && !el.closest('.wm-lu') && parseFloat(getComputedStyle(el).textIndent) > -100 && parseFloat(getComputedStyle(el).fontSize) > 0);
      return {
        petits: textes.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => el.tagName + '.' + el.className + ' ' + getComputedStyle(el).fontSize + ' ' + el.textContent.trim().slice(0, 20)),
        titre: [cs('.cm-popup .cm-titre').fontSize, cs('.cm-popup .cm-titre').fontWeight],
        voix: [cs('.cm-popup textarea').fontSize, cs('.cm-popup textarea').fontWeight],
        principal: cs('.cm-popup .cm-save').fontWeight,
        touche: cs('.cm-popup .cm-save').fontSize,
      };
    });
    expect(m.petits).toEqual([]);
    expect(m.titre).toEqual(['15px', '600']);
    expect(m.voix).toEqual(['15px', '400']);
    expect(m.principal).toBe('500');
    expect(m.touche).toBe('14px');
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

  test('9. halo orange (#F7821A), sans autre teinte, identique sur une page claire et une page sombre', async ({ page }) => {
    const releves = {};
    for (const nom of ['tellus-accueil.html', 'generic-dashboard.html']) {
      await page.goto(H.fileUrl(nom));
      await page.keyboard.press(H.ANNOTER); // ⌥+A / alt+A lance le mode
      await expect(page.locator('body')).toHaveClass(/cm-active/);
      await expect(page.locator('#cmFrame')).toBeVisible();
      const halo = await lireHalo(page);
      releves[nom] = halo;
      const toutes = Object.values(halo).flatMap((v) => couleurs(v.ombre + ' ' + v.bord));
      expect(toutes.some((c) => c.r === 247 && c.g === 130 && c.b === 26 && c.a === 1), JSON.stringify(halo)).toBe(true);
      expect(toutes.some((c) => c.r === 10 && c.g === 10 && c.b === 10 && Math.abs(c.a - 0.9) < 0.001), 'filet sombre').toBe(true);
      for (const c of toutes) {
        if (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) > 40) {
          expect(Math.abs(teinte(c) - 28), `teinte de ${c.txt}`).toBeLessThanOrEqual(3);   // orange de macOS (28°)
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

  test('9b. fondu de 200 ms sur l’opacité du halo, à l’apparition et à la disparition (caché par visibility)', async ({ page }) => {
    await page.goto(H.fileUrl('planche-charte.html'));
    // Transitions CSS en cours sur #cmFrame, lues dans le même instant que le changement de mode.
    const basculer = (on) => page.evaluate((on) => {
      const el = document.getElementById('cmFrame');
      window.cmToggle(on);
      const tr = document.getAnimations().filter((a) => a.effect && a.effect.target === el && a.transitionProperty)
        .map((a) => ({ prop: a.transitionProperty, duree: a.effect.getTiming().duration, delai: a.effect.getTiming().delay }));
      return { tr, visibilite: getComputedStyle(el).visibility, display: getComputedStyle(el).display };
    }, on);
    const entree = await basculer(true);
    expect(entree.tr.find((t) => t.prop === 'opacity'), JSON.stringify(entree)).toMatchObject({ duree: 200 });
    expect(entree.visibilite).toBe('visible');                        // visible dès le premier instant du fondu
    await expect.poll(() => page.locator('#cmFrame').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    const sortie = await basculer(false);
    expect(sortie.tr.find((t) => t.prop === 'opacity'), JSON.stringify(sortie)).toMatchObject({ duree: 200 });
    expect(sortie.visibilite).toBe('visible');                        // le fondu de sortie se joue…
    expect(sortie.display).not.toBe('none');                          // …parce que la couche n'est pas cachée par display
    await expect.poll(() => page.locator('#cmFrame').evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden');
    expect(await page.locator('#cmFrame').evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
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
    expect(etat.bord).toContain('rgb(247, 130, 26)');
    // disparition sans fondu non plus : caché dans l'instant (Léa 48)
    const sortie = await page.evaluate(() => {
      const el = document.getElementById('cmFrame');
      window.cmToggle(false);
      return { visibilite: getComputedStyle(el).visibility, opacite: getComputedStyle(el).opacity, transitions: document.getAnimations().filter((a) => a.effect && a.effect.target === el).length };
    });
    expect(sortie).toEqual({ visibilite: 'hidden', opacite: '0', transitions: 0 });
    await page.evaluate(() => window.cmToggle(true));
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
    // pendant le fondu d'apparition non plus
    const pendantFondu = await page.evaluate(() => { window.cmToggle(false); window.cmToggle(true); const el = document.elementFromPoint(3, window.innerHeight / 2); return el ? (el.id || el.tagName) : null; });
    expect(pendantFondu).not.toBe('cmFrame');
    // un clic à 4 px du bord gauche, sur la barre de navigation du site, ouvre la fenêtre de saisie
    await page.mouse.click(4, 28);
    await expect(page.locator('.cm-popup textarea')).toBeVisible();
  });
});

test('13. liste : le numéro du retour sélectionné est lisible (V2 : face ink, chiffre dans la couleur du fond de la liste)', async ({ page }) => {
  for (const [nom, fond, chiffre] of [['tellus-accueil.html', 'rgb(20, 20, 20)', 'rgb(250, 250, 250)'], ['generic-dashboard.html', 'rgb(255, 255, 255)', 'rgb(27, 27, 27)']]) {
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

test('15. habiller : fenêtre, liste, bandeau, message passager et visionneuse portent ombre, verre et contour, arrondis sans angle cassé', async ({ page }) => {
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
      clip: cs.clipPath, rayon: cs.borderRadius, rayonOmbre: getComputedStyle(el.querySelector(':scope > .wm-ombre > i')).borderRadius,
      clipOmbre: getComputedStyle(el.querySelector(':scope > .wm-ombre > i')).clipPath, flou: cs.backdropFilter || cs.webkitBackdropFilter,
      parentNu: getComputedStyle(el).clipPath === 'none' && getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)',
    };
  }));
  for (const f of r) {
    expect(f.premiers, f.sel).toEqual(['wm-ombre', 'wm-verre', 'wm-contour']);
    expect(f.muets, f.sel).toBe(true);
    expect(f.coins, f.sel).toBe(f.sel === '#cmStatus' ? 0 : 2);      // messages passagers : sans coins witmit
    // V2 : plus d'angle cassé ; arrondi de 9 px (liste : côté page seulement ; message passager : 8 px), copie d'ombre comprise.
    const rayon = { '#cmPanel': '9px 0px 0px 9px', '#cmStatus': '8px' }[f.sel] || '9px';
    expect(f.clip, f.sel).toBe('none');
    expect(f.clipOmbre, f.sel).toBe('none');
    expect(f.rayon, f.sel).toBe(rayon);
    expect(f.rayonOmbre, f.sel).toBe(rayon);
    // La liste est mate (V2, fiche Tiroir : titane neutre opaque, sans verre) : pas de flou derrière elle.
    expect(f.flou, f.sel).toBe(f.sel === '#cmPanel' ? 'none' : 'blur(40px) saturate(1.9)');
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
  await expect(page.locator('.cm-panel-item img.cm-shot')).toHaveCount(1, { timeout: 15000 });
  await H.ouvrirRetour(page, page.locator('.cm-panel-item').first());   // c1 (V2) : la vignette est dans le retour ouvert
  await expect(page.locator('.cm-panel-item img.cm-shot')).toBeVisible();
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

test('17. contour retracé à la taille réelle : plus de trait d’angles cassés, coins witmit au coude arrondi de 3 px', async ({ page }) => {
  await ouvrirFenetres(page, 'planche-charte.html', '#carteClaire p');
  const lire = () => page.locator('.cm-popup').evaluate((el) => {
    const svg = el.querySelector(':scope > .wm-contour');
    return { W: el.offsetWidth, H: el.offsetHeight, w: +svg.getAttribute('width'), h: +svg.getAttribute('height'),
      polygones: svg.querySelectorAll('polygon').length, coins: Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d')) };
  });
  const n = (v) => +v.toFixed(2);
  let c = await lire();
  expect([c.w, c.h]).toEqual([c.W, c.H]);
  expect(c.polygones).toBe(0);                                          // V2 : le bord est porté par le verre arrondi
  expect(c.coins[0]).toBe('M8.4 16.8V11.4Q8.4 8.4 11.4 8.4H16.8');       // haut gauche : coude en quart de cercle de 3 px
  expect(c.coins[1]).toBe(`M${n(c.W - 8.4)} ${n(c.H - 16.8)}V${n(c.H - 11.4)}Q${n(c.W - 8.4)} ${n(c.H - 8.4)} ${n(c.W - 11.4)} ${n(c.H - 8.4)}H${n(c.W - 16.8)}`);
  // la fenêtre grandit : le même ResizeObserver retrace le contour
  await page.locator('.cm-popup').evaluate((el) => { el.style.width = '400px'; });
  await expect.poll(async () => (await lire()).w).toBe(400);
  c = await lire();
  expect(c.coins[1]).toBe(`M${400 - 8.4} ${n(c.H - 16.8)}V${n(c.H - 11.4)}Q${400 - 8.4} ${n(c.H - 8.4)} ${400 - 11.4} ${n(c.H - 8.4)}H${400 - 16.8}`);
});

test('18. boutons macOS (fiche Touche) : arrondi de 6 px sur ::before, principal orange, secondaire et annuler gris, désactivé', async ({ page }) => {
  await ouvrirFenetres(page, 'planche-charte.html', '#carteClaire p');
  const st = (sel, pseudo) => page.locator(sel).first().evaluate((el, ps) => {
    const cs = getComputedStyle(el, ps);
    return { clip: cs.clipPath, rayon: cs.borderRadius, bord: cs.borderTopColor, couleur: cs.color, fond: cs.backgroundColor, curseur: cs.cursor, graisse: cs.fontWeight };
  }, pseudo || null);
  const jetons = await page.locator('.cm-popup').evaluate((el) => {
    const cs = getComputedStyle(el), v = (n) => cs.getPropertyValue(n).trim();
    const rgb = (c) => { const d = document.createElement('i'); d.style.color = c; el.appendChild(d); const r = getComputedStyle(d).color; d.remove(); return r; };
    return { faint: rgb(v('--wm-ink-faint')), ink: rgb(v('--wm-ink')), face: rgb(v('--wm-face-touche')), lisere: rgb(v('--wm-touche-lisere')) };
  });
  const sombre = (await theme(page)) === 'client-sombre';
  expect(jetons.face).toBe(sombre ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.07)');   // face-touche
  expect(jetons.lisere).toBe(sombre ? 'rgba(0, 0, 0, 0)' : 'rgba(0, 0, 0, 0.08)');         // liseré à peine visible en clair, aucun en sombre
  // Champ vide : le principal est désactivé ; on le remplit pour le voir disponible.
  await page.locator('.cm-popup textarea').fill('Un retour');
  const save = await st('.cm-popup .cm-save'), saveAvant = await st('.cm-popup .cm-save', '::before');
  expect(save.clip).toBe('none');                                       // le bouton n'est pas découpé (son focus ne serait pas rogné)
  expect(saveAvant.clip).toBe('none');                                  // V2 : plus d'angle cassé
  expect(saveAvant.rayon).toBe('6px');                                  // arrondi radius-bouton
  expect(saveAvant.fond).toBe('rgb(247, 130, 26)');                     // principal disponible : orange accent (#F7821A)
  expect(save.couleur).toBe('rgb(255, 255, 255)');                      // libellé blanc
  expect(save.graisse).toBe('500');                                     // en graisse 500
  const sec = await st('#cmPanel .cm-panel-foot .wm-touche:not(.wm-principale)'), secAvant = await st('#cmPanel .cm-panel-foot .wm-touche:not(.wm-principale)', '::before');
  expect(secAvant.fond).toBe(jetons.face);                              // secondaire : face grise
  expect(secAvant.bord).toBe(jetons.lisere);
  expect([sec.couleur, sec.graisse]).toEqual([jetons.ink, '400']);      // libellé ink, graisse normale
  const annuler = await st('.cm-popup .cm-cancel'), annulerAvant = await st('.cm-popup .cm-cancel', '::before');
  expect(annulerAvant.fond).toBe(jetons.face);                          // « annuler » : un vrai bouton gris, plus un texte seul
  expect(annulerAvant.rayon).toBe('6px');
  expect([annuler.couleur, annuler.graisse]).toEqual([jetons.ink, '400']);
  // désactivé (fiches Touche et Etats) : face grise au lieu de l'orange, libellé ink-faint (60 %), curseur par défaut, aucune opacité
  await page.locator('.cm-popup textarea').fill('');
  await expect(page.locator('.cm-popup .cm-save')).toBeDisabled();
  const off = await st('.cm-popup .cm-save'), offAvant = await st('.cm-popup .cm-save', '::before');
  expect(off.couleur).toBe(jetons.faint);
  expect(off.curseur).toBe('default');
  expect(offAvant.fond).toBe(jetons.face);
  expect(await page.locator('.cm-popup .cm-save').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
});

test('19. focus clavier : anneau arrondi qui suit la touche, outline sur un cercle, rien au clic souris', async ({ page }) => {
  await ouvrirFenetres(page, 'planche-charte.html', '#carteClaire p');
  const anneau = (sel) => page.locator(sel).evaluate((el) => {
    const cs = getComputedStyle(el, '::after');
    return { contenu: cs.content, clip: cs.clipPath, fond: cs.backgroundColor, l: cs.left, t: cs.top, trait: cs.borderTopWidth + ' ' + cs.borderTopStyle, encre: cs.borderTopColor, rayon: cs.borderRadius,
      ink: (() => { const d = document.createElement('i'); d.style.color = getComputedStyle(el).getPropertyValue('--wm-ink'); el.appendChild(d); const r = getComputedStyle(d).color; d.remove(); return r; })() };
  });
  // au clic souris : pas d'anneau
  await page.locator('#cmPanel .cm-panel-foot .wm-touche', { hasText: 'Copier' }).hover();
  await page.mouse.down(); await page.mouse.up();
  expect((await anneau('#cmPanel .cm-panel-foot .wm-touche >> text=Copier')).contenu).toBe('none');
  // au clavier : Tab jusqu'à « envoyer par email », anneau de 2 px à 2 px de la forme, qui suit son arrondi
  await page.locator('#cmPanel .cm-panel-foot .wm-touche', { hasText: 'Copier' }).focus();
  await page.keyboard.press('Tab');
  const envoyer = '#cmPanel .cm-panel-report .wm-touche >> text=envoyer par email';
  await expect(page.locator(envoyer)).toBeFocused();
  const a = await anneau(envoyer);
  expect(a.contenu).toBe('""');
  expect([a.l, a.t]).toEqual(['-4px', '3px']);                         // 2 px à 2 px de la face de 30 px, posée à 7 px du haut de la zone de 44 px
  expect(a.clip).toBe('none');                                          // V2 : plus de découpe
  expect(a.trait).toBe('2px solid');
  expect(a.encre).toBe(a.ink);
  expect(a.rayon).toBe('10px');                                         // 6 px de la touche + 4 px d'écart
  // forme ronde : outline de 2 px à 2 px
  await page.locator('#cmPanel .wm-cercle[aria-label="fermer"]').focus();
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  const o = await page.locator('#cmPanel .wm-cercle[aria-label="fermer"]').evaluate((el) => [getComputedStyle(el).outlineStyle, getComputedStyle(el).outlineWidth, getComputedStyle(el).outlineOffset]);
  expect(o).toEqual(['solid', '2px', '2px']);
});

// ---------- Habillage V2, lot 2 : formes (README « Formes », tokens.json onglet Rayons, fiches Fenetre, Touche, Epingle) ----------

test('19b. arrondis V2 : jetons de rayon et rayon de chaque élément (fenêtres, liste, bandeau, message, touche, champ, ligne, épingle, cadre)', async ({ page }) => {
  await ouvrirFenetres(page, 'planche-charte.html', '#carteClaire p');
  await page.evaluate(() => document.getElementById('cmStatus').classList.add('show'));
  const r = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.cm-popup'));
    const jeton = (n) => cs.getPropertyValue('--wm-radius-' + n).trim();
    const rayon = (sel, ps) => { const el = document.querySelector(sel); return el ? getComputedStyle(el, ps || null).borderRadius : null; };
    return {
      jetons: ['fenetre', 'bloc', 'bouton', 'epingle', 'champ', 'message', 'coude'].map(jeton),
      fenetre: rayon('.cm-popup > .wm-verre'), liste: rayon('#cmPanel > .wm-verre'), bandeau: rayon('#cmPill > .wm-verre'), message: rayon('#cmStatus > .wm-verre'),
      touche: rayon('.cm-popup .cm-save', '::before'), categorie: rayon('.cm-popup .cm-cat', '::before'), annuler: rayon('.cm-popup .cm-cancel', '::before'),
      champ: rayon('.cm-popup .wm-champ > textarea'), champColler: rayon('#cmFeedbackBox .wm-champ > textarea'), ligne: rayon('#cmPanel .cm-panel-item', '::before'),
      epingle: rayon('.cm-pin'), cadre: rayon('.cm-box'), traceCadre: rayon('.cm-box > .wm-cadre'),
    };
  });
  expect(r.jetons).toEqual(['9px', '7px', '6px', '6px', '5px', '8px', '3px']);
  expect(r).toMatchObject({ fenetre: '9px', liste: '9px 0px 0px 9px', bandeau: '9px', message: '8px', touche: '6px', categorie: '6px', annuler: '6px',
    champ: '5px', champColler: '5px', ligne: '6px', epingle: '6px', cadre: '6px', traceCadre: '6px' });
});

test('19c. plus aucun angle cassé : aucun clip-path sur une couche de witmit, pseudo-éléments compris (clair et sombre)', async ({ page }) => {
  for (const [nom, cible] of PAGES_LOT2) {
    await ouvrirFenetres(page, nom, cible);
    await page.evaluate(() => document.getElementById('cmStatus').classList.add('show'));
    const fautes = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.cm-ui, .cm-ui *').forEach((el) => {
        for (const ps of [null, '::before', '::after']) {
          const c = getComputedStyle(el, ps).clipPath;
          if (c && c !== 'none') out.push((el.id || el.className.baseVal || el.className) + (ps || '') + ' : ' + c);
        }
      });
      return out;
    });
    expect(fautes, nom).toEqual([]);
  }
});

test('19d. coins witmit : haut gauche et bas droit de la fenêtre, de la liste et du bandeau, trait de 2,1 px, coude arrondi de 3 px ; aucun sur le message passager', async ({ page }) => {
  await ouvrirFenetres(page, 'planche-charte.html', '#carteClaire p');
  const r = await page.evaluate(() => ['.cm-popup', '#cmPanel', '#cmPill', '#cmStatus'].map((sel) => {
    const el = document.querySelector(sel), W = el.offsetWidth, H = el.offsetHeight;
    const paths = Array.from(el.querySelectorAll(':scope > .wm-contour path'));
    return { sel, W, H, d: paths.map((p) => p.getAttribute('d')), trait: paths.map((p) => getComputedStyle(p).strokeWidth), joint: paths.map((p) => getComputedStyle(p).strokeLinejoin),
      encre: paths.map((p) => getComputedStyle(p).stroke), ink: getComputedStyle(el).color };
  }));
  for (const f of r) {
    if (f.sel === '#cmStatus') { expect(f.d, f.sel).toEqual([]); continue; }
    expect(f.d.length, f.sel).toBe(2);
    // haut gauche : de (8,4 ; 16,8) au coude (8,4 ; 8,4), arrondi en quart de cercle de 3 px, puis jusqu'à (16,8 ; 8,4)
    expect(f.d[0], f.sel).toBe('M8.4 16.8V11.4Q8.4 8.4 11.4 8.4H16.8');
    // bas droit : même coin retourné, à 8,4 px des bords droit et bas
    const m = f.d[1].match(/^M([\d.]+) ([\d.]+)V([\d.]+)Q([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)H([\d.]+)$/).slice(1).map(Number);
    const attendu = [f.W - 8.4, f.H - 16.8, f.H - 11.4, f.W - 8.4, f.H - 8.4, f.W - 11.4, f.H - 8.4, f.W - 16.8];
    m.forEach((v, i) => expect(v, f.sel + ' ' + i).toBeCloseTo(attendu[i], 2));
    expect(f.trait, f.sel).toEqual(['2.1px', '2.1px']);
    expect(f.joint, f.sel).toEqual(['round', 'round']);
    expect(f.encre, f.sel).toEqual([f.ink, f.ink]);
  }
});

test('19e. bord du verre visible sans découpe : trait de 1 px et ombre de contact en clair ; liseré 16 % dedans et 5 % dehors en sombre', async ({ page }) => {
  for (const [nom, fond] of [['bord-clair', '#ffffff'], ['bord-sombre', '#101010']]) {
    await page.goto(pageEssai(nom, { fond }));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    const b = await H.visibleBox(page, '#bloc');
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(page.locator('.cm-popup textarea')).toBeVisible();
    const v = await page.locator('.cm-popup > .wm-verre').evaluate((el) => ({ clip: getComputedStyle(el).clipPath, ombre: getComputedStyle(el).boxShadow.replace(/\s+/g, ' ') }));
    expect(v.clip, nom).toBe('none');                                  // rien ne rogne plus l'ombre ni le liseré
    if (nom === 'bord-clair') {
      expect(v.ombre).toContain('rgba(0, 0, 0, 0.14) 0px 0px 0px 1px inset');   // trait contour-fenetre
      expect(v.ombre).toContain('rgba(0, 0, 0, 0.14) 0px 1px 3px 0px');         // ombre de contact
    } else {
      expect(v.ombre).toBe('rgba(255, 255, 255, 0.16) 0px 0px 0px 1px inset, rgba(255, 255, 255, 0.05) 0px 0px 0px 1px');   // un seul trait dedans
    }
  }
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
  for (const nom of ['CrosshairSimple', 'Info', 'CursorClick', 'BoundingBox', 'TextT', 'SelectionPlus', 'SealQuestion', 'CheckCircle', 'WarningCircle',
    'CircleNotch', 'Trash', 'Broom', 'X', 'ArrowElbowDownLeft', 'Command', 'Option', 'DotsSixVertical', 'EyeSlash']) {
    expect(src, nom).toMatch(new RegExp('\\n    ' + nom + ": '<path d=\"M"));
  }
});

// Signe du bouton witmit : le logo B1 calé à 28 px (fiche BoutonWitmit, décision de François du 25/10/2026), à la place
// de la plume PenNib (22 px, décalée de 2 px), qui ne sert plus nulle part.
test('20b. bouton witmit : logo B1 calé à 28 px, centré, couleur du métal ; voyant à 10 px du haut et 9 px de la droite', async ({ page }) => {
  for (const [nom, fond, encre] of [['b1-site-clair', '#ffffff', 'rgb(20, 20, 20)'], ['b1-site-sombre', '#101010', 'rgb(244, 244, 244)']]) {   // métal du thème du site (V2)
    await page.goto(pageEssai(nom, { fond }));
    await page.goto(pageEssai(nom, { fond }) + '?witmit=on');
    const btn = page.locator('#cmPanelBtn');
    await expect(btn).toBeVisible();
    const mesure = () => btn.evaluate((b) => {
      const svg = b.querySelector('svg.wm-logo'), r = b.getBoundingClientRect(), s = svg.getBoundingClientRect();
      return { nb: b.querySelectorAll('svg').length, logo: svg.dataset.logo, vb: svg.getAttribute('viewBox'), fill: svg.getAttribute('fill'),
        net: svg.getAttribute('shape-rendering'), muet: svg.getAttribute('aria-hidden'), w: s.width, h: s.height,
        dx: (s.left + s.width / 2) - (r.left + r.width / 2), dy: (s.top + s.height / 2) - (r.top + r.height / 2), couleur: getComputedStyle(svg).color,
        d: svg.querySelector('path').getAttribute('d') };
    });
    for (const etat of ['fermé', 'ouvert']) {
      const m = await mesure();
      expect(m, nom + ' ' + etat).toMatchObject({ nb: 1, logo: 'B1', vb: '0 0 28 28', fill: 'currentColor', net: 'crispEdges', muet: 'true', w: 28, h: 28, couleur: encre });
      expect(Math.abs(m.dx), nom + ' ' + etat + ' : centré en largeur').toBeLessThanOrEqual(1);
      expect(Math.abs(m.dy), nom + ' ' + etat + ' : centré en hauteur').toBeLessThanOrEqual(1);
      expect(m.d).toBe('M0,1 L9,1 L9,4 L3,4 L3,10 L0,10 Z M5,6 L9,6 L9,18 L12,18 L12,11 L16,11 L16,18 L19,18 L19,6 L20,6 L23,9 L23,22 L8,22 L5,19 Z M28,27 L19,27 L19,24 L25,24 L25,18 L28,18 Z');
      if (etat === 'fermé') { await btn.click(); await expect(btn).toHaveAttribute('aria-expanded', 'true'); }
    }
    // Voyant allumé de force (rendu seul, sans retour) : 7 px, 10 px du haut et 9 px de la droite du rond.
    const v = await btn.evaluate((b) => {
      const c = b.querySelector('#cmCount'); c.setAttribute('data-zero', '0'); c.textContent = '1';
      const r = b.getBoundingClientRect(), k = c.getBoundingClientRect();
      return { w: k.width, h: k.height, haut: k.top - r.top, droite: r.right - k.right };
    });
    expect(v, nom).toEqual({ w: 7, h: 7, haut: 10, droite: 9 });
  }
  const src = fs.readFileSync(path.join(SRC_DIR, 'witmit.js'), 'utf8');
  expect(src).not.toContain('PenNib');
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
  await H.ouvrirRetour(page, page.locator('.cm-panel-item').first());   // c1 (V2) : les détails sont dans le retour ouvert
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
  for (const [nom, cible, cerne] of [['planche-charte.html', '#carteClaire p', true], ['generic-dashboard.html', 'tbody tr:first-child td:nth-child(2)', false]]) {   // V2 : métal clair sur un site clair
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
    expect(v, nom).toMatchObject({ w: 7, h: 7, rond: '50%', ombre: 'none', fond: 'rgb(247, 130, 26)', cerne, entier: true });
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
async function planche(page, requete = '') {
  await page.goto(H.fileUrl('planche-charte.html') + requete);
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
}
// Cadre de sélection (fiche Selection, V2) : dessin de .wm-cadre et de ses deux crochets witmit (::before haut gauche,
// ::after bas droit). contour : pointillés de l'état inactif (outline), null à l'état actif (contour en box-shadow).
const cadreDe = (loc) => loc.evaluate((b) => {
  const c = b.querySelector(':scope > .wm-cadre'), cs = getComputedStyle(c), av = getComputedStyle(c, '::before'), ap = getComputedStyle(c, '::after');
  const r = c.getBoundingClientRect(), e = b.getBoundingClientRect();
  return { coin: av.borderLeftColor, coinBas: ap.borderRightColor, trait: av.borderLeftWidth + ' ' + av.borderTopWidth, traitBas: ap.borderRightWidth + ' ' + ap.borderBottomWidth,
    bras: av.width + ' ' + av.height, place: av.left + ' ' + av.top, placeBas: ap.right + ' ' + ap.bottom, coude: av.borderTopLeftRadius + ' ' + ap.borderBottomRightRadius,
    opacite: av.opacity + ' ' + ap.opacity, rayon: cs.borderRadius, fond: cs.backgroundColor, ombre: cs.boxShadow,
    contour: cs.outlineStyle === 'none' ? null : cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor,
    marge: Math.round(e.left - r.left), sombre: b.classList.contains('wm-sur-sombre') };
});

test('24. une seule encre par repère, d’après le fond derrière lui ; un petit élément garde son cadre fermé et ses deux crochets', async ({ page }) => {
  await planche(page);
  await H.addPin(page, '#petitClair', 'petit');
  await H.addPin(page, '#carteSombre', 'grand');
  await page.waitForTimeout(1500);                                  // fin de l'effet « vient d'être commenté »
  const petit = await cadreDe(page.locator('.cm-box-outline').nth(0));
  const grand = await cadreDe(page.locator('.cm-box-outline').nth(1));
  // Petit élément (18 px + 2 × 16 px de marge) : cadre fermé quand même (V2, fiche Selection), crochets #141414 sur fond
  // clair ; inactif : pointillés gris (noir à 42 %).
  expect(petit).toMatchObject({ coin: 'rgb(20, 20, 20)', trait: '2px 2px', marge: 16, rayon: '6px', contour: 'dashed 1px rgba(0, 0, 0, 0.42)', sombre: false });
  // Grand élément sur la moitié sombre : crochets blancs, pointillés blancs à 50 %.
  expect(grand).toMatchObject({ coin: 'rgb(255, 255, 255)', marge: 16, rayon: '6px', contour: 'dashed 1px rgba(255, 255, 255, 0.5)', sombre: true });
  // Épingles : verre titane clair et chiffre encre sur fond clair ; verre titane sombre et chiffre blanc sur fond sombre.
  const pins = await page.locator('.cm-pin').evaluateAll((ps) => ps.map((p) => ({ fond: getComputedStyle(p).backgroundColor, chiffre: getComputedStyle(p).color, h: p.getBoundingClientRect().height })));
  expect(pins).toEqual([
    { fond: 'rgba(250, 250, 250, 0.72)', chiffre: 'rgb(20, 20, 20)', h: 24 },
    { fond: 'rgba(27, 27, 27, 0.7)', chiffre: 'rgb(244, 244, 244)', h: 24 }
  ]);
  // Actif (survol) : métal, sans verre ; les cadres du retour passent au contour plein, gris léger et crochets pleins.
  await page.locator('.cm-pin').nth(1).hover();
  const actif = await page.locator('.cm-pin').nth(1).evaluate((p) => ({ fond: getComputedStyle(p).backgroundImage, flou: getComputedStyle(p).backdropFilter }));
  expect(actif.fond).toContain('linear-gradient');
  expect(actif.flou).toBe('none');
  const survole = await cadreDe(page.locator('.cm-box-outline').nth(1));
  expect(survole).toMatchObject({ contour: null, opacite: '1 1', fond: 'rgba(128, 128, 128, 0.12)' });
  expect(survole.ombre).toContain('rgba(255, 255, 255, 0.42) 0px 0px 0px 1px');
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
  expect(v).toEqual({ w: 7, h: 7, fond: 'rgb(247, 130, 26)', ombre: 'none' });
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
  expect(m[0]).toMatchObject({ fond: 'rgba(0, 0, 0, 0)', marge: '0px 0px', trait: '2px', couleur: 'rgb(244, 244, 244)', debut: 7 });
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
  // …et le garde après le redessin des repères que la fermeture déclenche (~600 ms plus tard).
  await page.waitForTimeout(900);
  await expect(page.locator('.cm-pin').nth(1)).toBeFocused();
});

test('26. zone en édition : 6 petits traits intérieurs et 2 crochets witmit ; la fenêtre ne recouvre ni le cadre ni l’épingle', async ({ page }) => {
  await planche(page);
  const img = await H.visibleBox(page, '#imageVive');
  await H.drag(page, img.x + 40, img.y + 30, img.x + 260, img.y + 160);
  await expect(page.locator('.cm-box-editable .cm-handle')).toHaveCount(8);
  const poignees = await page.locator('.cm-box-editable .cm-handle').evaluateAll((hs) => hs.map((h) => {
    const r = h.getBoundingClientRect(), a = getComputedStyle(h, '::after');
    return { dir: h.dataset.dir, prise: Math.round(r.width), trait: a.content === 'none' ? null : a.width + ' × ' + a.height };
  }));
  // Zone de plus de 88 px de côté : prise de 44 px ; traits de 12 × 2 px au milieu des côtés, petits crochets de 10 px
  // dans les coins haut droit et bas gauche ; les coins haut gauche et bas droit n'ont que le crochet witmit (V2).
  const TRAITS = { n: '12px × 2px', s: '12px × 2px', e: '2px × 12px', w: '2px × 12px', ne: '10px × 10px', sw: '10px × 10px', nw: null, se: null };
  for (const h of poignees) expect(h, h.dir).toEqual({ dir: h.dir, prise: 44, trait: TRAITS[h.dir] });
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

// ---------- Habillage V2, lot 5 : cadre de sélection (fiche Selection, décision de François du 26/10 sur la couleur) ----------

// Cadre en cours de tracé (bouton tenu) sur un paragraphe de la planche ; renvoie son dessin, puis lâche la souris.
async function tracerEtLire(page, selecteur) {
  const p = await H.visibleBox(page, selecteur);
  await page.mouse.move(p.x + 6, p.y + 6);
  await page.mouse.down();
  await page.mouse.move(p.x + 220, p.y + 90, { steps: 10 });
  const trace = await page.locator('.cm-box:not(.cm-box-saved):not(.cm-box-editing):not(.cm-box-editable)').evaluate((b) => {
    const cs = getComputedStyle(b);
    return { bord: cs.borderTopStyle + ' ' + cs.borderTopWidth + ' ' + cs.borderTopColor, fond: cs.backgroundColor, ombre: cs.boxShadow, rayon: cs.borderRadius,
      crochets: b.querySelectorAll('.wm-cadre').length, sombre: b.classList.contains('wm-sur-sombre') };
  });
  await page.mouse.up();
  await expect(page.locator('.cm-box-editable')).toHaveCount(1);
  return trace;
}
// Couleur des poignées d'une zone en édition (::after des six poignées hors crochets witmit).
const poigneesDe = (page) => page.locator('.cm-box-editable .cm-handle').evaluateAll((hs) => hs.map((h) => {
  const a = getComputedStyle(h, '::after');
  return a.content === 'none' ? null : (a.backgroundColor !== 'rgba(0, 0, 0, 0)' ? a.backgroundColor : a.borderTopColor || a.borderBottomColor);
}).filter(Boolean));
const OMBRE_DEHORS = 'rgba(0, 0, 0, 0.22) 0px 2px 10px 0px', OMBRE_DEDANS = 'rgba(0, 0, 0, 0.2) 0px 0px 6px 0px inset';

test('34. cadre en tracé : gris à 26 %, contour de 1 px, ombre dehors et dedans, arrondi de 6 px, sans crochets (clair et sombre)', async ({ page }) => {
  await planche(page);
  const clair = await tracerEtLire(page, '#moitieClaire > p');
  expect(clair).toMatchObject({ bord: 'solid 1px rgba(0, 0, 0, 0.3)', fond: 'rgba(128, 128, 128, 0.26)', rayon: '6px', crochets: 0, sombre: false });
  expect(clair.ombre).toContain(OMBRE_DEHORS);
  expect(clair.ombre).toContain(OMBRE_DEDANS);
  await page.keyboard.press('Escape');
  await expect(page.locator('.cm-popup')).toHaveCount(0);
  const sombre = await tracerEtLire(page, '#moitieSombre > p');
  expect(sombre).toMatchObject({ bord: 'solid 1px rgba(255, 255, 255, 0.42)', fond: 'rgba(128, 128, 128, 0.26)', rayon: '6px', crochets: 0, sombre: true });
  expect(sombre.ombre).toContain(OMBRE_DEHORS);
});

test('35. cadre actif fermé (gris léger, contour, ombres, crochets pleins à 5 px du bord) ; inactif en pointillés, crochets à 55 % ; zone et élément, clair et sombre', async ({ page }) => {
  test.setTimeout(40000);
  await planche(page);
  for (const [cible, sombre] of [['#moitieClaire > p', false], ['#moitieSombre > p', true]]) {
    await tracerEtLire(page, cible);
    const coin = sombre ? 'rgb(255, 255, 255)' : 'rgb(20, 20, 20)';
    // Zone lâchée, fenêtre ouverte : actif.
    const actif = await cadreDe(page.locator('.cm-box-editable'));
    expect(actif, cible).toMatchObject({ coin, coinBas: coin, trait: '2px 2px', traitBas: '2px 2px', bras: '12px 12px', place: '5px 5px', placeBas: '5px 5px',
      coude: '3px 3px', opacite: '1 1', rayon: '6px', fond: 'rgba(128, 128, 128, 0.12)', contour: null, marge: 0, sombre });
    expect(actif.ombre).toContain((sombre ? 'rgba(255, 255, 255, 0.42)' : 'rgba(0, 0, 0, 0.3)') + ' 0px 0px 0px 1px');
    expect(actif.ombre).toContain(OMBRE_DEHORS);
    expect(actif.ombre).toContain(OMBRE_DEDANS);
    await page.locator('.cm-popup textarea').fill('zone');
    await page.locator('.cm-popup textarea').press('Enter');
    await expect(page.locator('.cm-popup')).toHaveCount(0);
  }
  await page.mouse.move(640, 790);                                  // aucun survol
  await page.waitForTimeout(1500);                                  // fin de l'effet « vient d'être commenté »
  // Enregistrées, pas sélectionnées : inactives, pointillés de 1 px, ni fond ni ombre, crochets à 55 % (couleur pleine).
  const inactifs = await Promise.all([0, 1].map((n) => cadreDe(page.locator('.cm-box-saved').nth(n))));
  expect(inactifs[0]).toMatchObject({ coin: 'rgb(20, 20, 20)', opacite: '0.55 0.55', fond: 'rgba(0, 0, 0, 0)', ombre: 'none', rayon: '6px', contour: 'dashed 1px rgba(0, 0, 0, 0.42)' });
  expect(inactifs[1]).toMatchObject({ coin: 'rgb(255, 255, 255)', opacite: '0.55 0.55', fond: 'rgba(0, 0, 0, 0)', ombre: 'none', rayon: '6px', contour: 'dashed 1px rgba(255, 255, 255, 0.5)' });
  // Plusieurs éléments (⌘+clic, ctrl+clic hors Mac) : chaque élément visé a le même cadre, 16 px de marge, actif puis inactif.
  const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
  const b1 = await H.visibleBox(page, '#boutonClair'), b2 = await H.visibleBox(page, '#boutonSombre');
  await page.mouse.click(b1.x + b1.width / 2, b1.y + b1.height / 2);
  await expect(page.locator('.cm-popup')).toBeVisible();
  await page.keyboard.down(MOD); await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2); await page.keyboard.up(MOD);
  await expect(page.locator('.cm-box-editing')).toHaveCount(2);
  const enSaisie = await Promise.all([0, 1].map((n) => cadreDe(page.locator('.cm-box-editing').nth(n))));
  expect(enSaisie[0]).toMatchObject({ coin: 'rgb(20, 20, 20)', opacite: '1 1', fond: 'rgba(128, 128, 128, 0.12)', contour: null, marge: 16, rayon: '6px', place: '5px 5px' });
  expect(enSaisie[1]).toMatchObject({ coin: 'rgb(255, 255, 255)', opacite: '1 1', fond: 'rgba(128, 128, 128, 0.12)', contour: null, marge: 16, rayon: '6px' });
  await page.locator('.cm-popup textarea').fill('deux boutons');
  await page.locator('.cm-popup textarea').press('Enter');
  await expect(page.locator('.cm-box-outline')).toHaveCount(2);
  await page.mouse.move(640, 790);
  await page.waitForTimeout(1500);
  const groupe = await Promise.all([0, 1].map((n) => cadreDe(page.locator('.cm-box-outline').nth(n))));
  expect(groupe[0]).toMatchObject({ contour: 'dashed 1px rgba(0, 0, 0, 0.42)', opacite: '0.55 0.55', ombre: 'none', marge: 16 });
  expect(groupe[1]).toMatchObject({ contour: 'dashed 1px rgba(255, 255, 255, 0.5)', opacite: '0.55 0.55', ombre: 'none', marge: 16 });
});

test('36. couleur des sélections (data-selection-color) : gris par défaut, orange au choix du site, valeur inconnue = gris ; crochets pleins et poignées grises quelle que soit la couleur (clair et sombre)', async ({ page }) => {
  test.setTimeout(90000);
  const ORANGE = 'rgb(247, 130, 26)';
  const CAS = [
    ['', 'gris', { clair: ['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.42)'], sombre: ['rgba(255, 255, 255, 0.42)', 'rgba(255, 255, 255, 0.5)'] }],
    ['?selection=orange', 'orange', { clair: [ORANGE, ORANGE], sombre: [ORANGE, ORANGE] }],
    ['?selection=ORANGE', 'orange', { clair: [ORANGE, ORANGE], sombre: [ORANGE, ORANGE] }],
    ['?selection=gray', 'gris', { clair: ['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.42)'], sombre: ['rgba(255, 255, 255, 0.42)', 'rgba(255, 255, 255, 0.5)'] }],
    ['?selection=violet', 'gris', { clair: ['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.42)'], sombre: ['rgba(255, 255, 255, 0.42)', 'rgba(255, 255, 255, 0.5)'] }],
  ];
  for (const [requete, attendu, couleurs] of CAS) {
    await planche(page, requete);
    expect(await page.getAttribute('body', 'data-wm-selection'), requete).toBe(attendu);
    for (const [cible, cote] of [['#moitieClaire > p', 'clair'], ['#moitieSombre > p', 'sombre']]) {
      const [contour, pointilles] = couleurs[cote];
      const trace = await tracerEtLire(page, cible);
      expect(trace.bord, requete + ' ' + cote).toBe('solid 1px ' + contour);
      const actif = await cadreDe(page.locator('.cm-box-editable'));
      expect(actif.ombre, requete + ' ' + cote).toContain(contour + ' 0px 0px 0px 1px');
      // Crochets toujours pleins (#141414 en clair, blanc en sombre) ; poignées toujours grises, jamais orange.
      expect(actif.coin, requete + ' ' + cote).toBe(cote === 'clair' ? 'rgb(20, 20, 20)' : 'rgb(255, 255, 255)');
      expect(actif.opacite).toBe('1 1');
      const prises = await poigneesDe(page);
      expect(prises).toHaveLength(6);
      for (const c of prises) expect(c, requete + ' ' + cote).toBe(cote === 'clair' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.55)');
      await page.locator('.cm-popup textarea').fill('zone ' + cote);
      await page.locator('.cm-popup textarea').press('Enter');
      await expect(page.locator('.cm-popup')).toHaveCount(0);
      await page.mouse.move(640, 790);
      await page.waitForTimeout(1500);
      const inactif = await cadreDe(page.locator('.cm-box-saved').last());
      expect(inactif.contour, requete + ' ' + cote).toBe('dashed 1px ' + pointilles);
      expect(inactif.coin).toBe(cote === 'clair' ? 'rgb(20, 20, 20)' : 'rgb(255, 255, 255)');
    }
  }
});

// Lot 8, relecture de Paula : le message passager ne couvre jamais les deux boutons (fiche BoutonWitmit), et le texte
// d'aide du champ tient dans le champ (fiche Fenetre, Corps).
test('27. message passager : jamais sur les deux boutons, liste ouverte (1280, 1100, 900 px) ou fermée (600 px)', async ({ page }) => {
  test.setTimeout(40000);
  const seTouchent = () => page.evaluate(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect();
    const s = r('cmStatus'), inter = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    return { mode: inter(s, r('cmToggleBtn')), witmit: inter(s, r('cmPanelBtn')), largeur: s.width, bas: Math.round(innerHeight - s.bottom) };
  });
  for (const [w, liste] of [[1280, true], [1100, true], [900, true], [600, false], [1280, false]]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await page.locator('#cmPanelBtn').click();
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('#cmReportFoot .wm-touche:last-child').click());   // échec long : pas d'adresse d'envoi
    if (!liste) { await page.locator('#cmPanelBtn').click(); await page.waitForTimeout(400); }
    await expect(page.locator('#cmStatus')).toHaveClass(/show/);
    const t = await seTouchent();
    expect(t.mode, `${w} px, liste ${liste}`).toBe(false);
    expect(t.witmit, `${w} px, liste ${liste}`).toBe(false);
    expect(t.largeur, `${w} px`).toBeGreaterThan(300);                 // message long : plusieurs lignes, pas un mot
    if (liste) {
      expect(t.bas, `${w} px`).toBe(84);
      // centré dans l'espace à gauche de la liste
      const c = await page.evaluate(() => { const s = document.getElementById('cmStatus').getBoundingClientRect(), p = document.getElementById('cmPanel').getBoundingClientRect(); return { centre: s.left + s.width / 2, libre: document.documentElement.clientWidth - p.width - 8, droite: s.right, liste: p.left }; });
      expect(Math.abs(c.centre - c.libre / 2), `${w} px`).toBeLessThanOrEqual(1);
      expect(c.droite, `${w} px`).toBeLessThanOrEqual(c.liste);
    } else expect(t.bas, `${w} px`).toBe(w <= 680 ? 84 : 20);
  }
});

test('28. fenêtre : le texte d’aide du champ vide tient dans le champ, sans être rogné', async ({ page }) => {
  for (const [nom, cible] of PAGES_LOT2) {
    await page.goto(H.fileUrl(nom));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    const b = await H.visibleBox(page, cible);
    await page.mouse.click(b.x + 4, b.y + 4);
    await expect(page.locator('.cm-popup textarea')).toBeVisible();
    const m = await page.locator('.cm-popup textarea').evaluate((ta) => {
      const cs = getComputedStyle(ta), ph = getComputedStyle(ta, '::placeholder');
      const sonde = document.createElement('div');
      Object.assign(sonde.style, { position: 'absolute', visibility: 'hidden', boxSizing: 'content-box', width: (ta.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) + 'px',
        fontFamily: ph.fontFamily, fontSize: ph.fontSize, lineHeight: ph.lineHeight, fontWeight: ph.fontWeight, letterSpacing: cs.letterSpacing, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' });
      sonde.textContent = ta.placeholder;
      document.body.appendChild(sonde);
      const aide = sonde.getBoundingClientRect().height; sonde.remove();
      return { aide, place: ta.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), lignes: Math.round(aide / parseFloat(ph.lineHeight)) };
    });
    expect(m.lignes, nom).toBeGreaterThan(1);
    expect(m.aide, nom).toBeLessThanOrEqual(m.place + 0.5);
    await page.keyboard.press('Escape');
  }
});

// ---------- Habillage V2, lot 3 : fenêtre et boutons (fiches Fenetre et Touche) ----------
// Pages du lot : planche-charte.html (site clair), generic-dashboard.html (site sombre).
const PAGES_LOT3 = [['planche-charte.html', '#carteClaire p'], ['generic-dashboard.html', 'tbody tr:first-child td:nth-child(2)']];
async function fenetreVide(page, nom, cible) {
  await page.goto(H.fileUrl(nom));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  const b = await H.visibleBox(page, cible);
  await page.mouse.click(b.x + 4, b.y + 4);
  await expect(page.locator('.cm-popup textarea')).toBeVisible();
}
// Boutons visibles d'une couche de witmit, avec leur face (::before) : orange ou non, place, taille.
const lireBoutons = (racine) => Array.from(racine.querySelectorAll('button')).filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').map((el) => {
  const r = el.getBoundingClientRect(), f = getComputedStyle(el, '::before');
  return { nom: el.textContent.trim() || el.getAttribute('aria-label'), touche: el.classList.contains('wm-touche'), orange: f.backgroundColor === 'rgb(247, 130, 26)',
    gauche: r.left, droite: r.right, haut: r.top, bas: r.bottom, largeur: r.width, hauteur: r.height, faceHaut: r.top + (parseFloat(f.top) || 0), faceBas: r.bottom - (parseFloat(f.bottom) || 0) };
});

test('29. fenêtre de saisie à 340 px ; bloc intérieur à 10 px des bords, arrondi de 7 px, fond, liseré, contour et ombre ; pas de filet ni de bande de pied (clair et sombre)', async ({ page }) => {
  for (const [nom, cible] of PAGES_LOT3) {
    await fenetreVide(page, nom, cible);
    const sombre = (await theme(page)) === 'client-sombre';
    const m = await page.evaluate(() => {
      const pop = document.querySelector('.cm-popup'), bloc = pop.querySelector('.wm-bloc'), tete = pop.querySelector('.cm-tete');
      const p = pop.getBoundingClientRect(), b = bloc.getBoundingClientRect(), t = tete.getBoundingClientRect(), cs = getComputedStyle(bloc), a = pop.querySelector('.cm-popup-actions').getBoundingClientRect();
      const champ = pop.querySelector('.wm-champ').getBoundingClientRect(), titre = pop.querySelector('.cm-titre').getBoundingClientRect();
      return { largeur: p.width, gauche: b.left - p.left, droite: p.right - b.right, sousTete: b.top - t.bottom, rayon: cs.borderRadius, fond: cs.backgroundColor, ombre: cs.boxShadow,
        filetTete: getComputedStyle(tete).borderBottomWidth, actionsSousBloc: a.top - b.bottom, piedFond: getComputedStyle(pop.querySelector('.cm-popup-actions')).backgroundColor,
        piedBord: getComputedStyle(pop.querySelector('.cm-popup-actions')).borderTopWidth, alignement: champ.left - titre.left, dansBloc: champ.left >= b.left && champ.right <= b.right && champ.bottom <= b.bottom };
    });
    expect(m.largeur, nom).toBe(340);
    expect([m.gauche, m.droite, m.sousTete], nom).toEqual([10, 10, 8]);
    expect(m.rayon, nom).toBe('7px');
    expect(m.fond, nom).toMatch(sombre ? /^rgba\(255, 255, 255, 0\.04\)$/ : /^rgba\(0, 0, 0, 0\.02[78]\)$/);   // 2,8 % (alpha arrondi au 1/255)
    // liseré intérieur (blanc à 75 % ; 8 % en sombre), contour à peine marqué (noir à 4,5 % ; 35 % en sombre), ombre très douce
    expect(m.ombre, nom).toMatch(sombre
      ? /^rgba\(255, 255, 255, 0\.08\) 0px 0px 0px 1px inset, rgba\(0, 0, 0, 0\.35\) 0px 0px 0px 1px, rgba\(0, 0, 0, 0\.3\) 0px 1px 6px 0px$/
      : /^rgba\(255, 255, 255, 0\.75\) 0px 0px 0px 1px inset, rgba\(0, 0, 0, 0\.04[3-6]\) 0px 0px 0px 1px, rgba\(0, 0, 0, 0\.05\) 0px 1px 6px 0px$/);
    expect(m.filetTete, nom).toBe('0px');                                // plus de filet sous la tête
    expect(m.actionsSousBloc, nom).toBe(10);                             // les boutons sous le bloc
    expect([m.piedFond, m.piedBord], nom).toEqual(['rgba(0, 0, 0, 0)', '0px']);   // sans bande de pied
    expect(m.alignement, nom).toBe(0);                                   // le contenu du bloc reste aligné sur le titre
    expect(m.dansBloc, nom).toBe(true);
    await page.keyboard.press('Escape');
  }
});

test('30. boutons de la fenêtre : 30 px dessinés, à droite, jamais pleine largeur ; un seul orange, et seulement quand il est disponible ; lecture seule sans orange', async ({ page }) => {
  for (const [nom, cible] of PAGES_LOT3) {
    await fenetreVide(page, nom, cible);
    const lire = () => page.evaluate((f) => { const pop = document.querySelector('.cm-popup'); return { p: pop.getBoundingClientRect().toJSON(), b: eval(f)(pop) }; }, lireBoutons.toString());
    // Champ vide : le principal est désactivé, gris ; aucun bouton orange.
    let { p, b } = await lire();
    const actions = b.filter((x) => x.touche && ['annuler', 'enregistrer'].includes(x.nom));
    expect(actions.map((x) => x.nom), nom).toEqual(['annuler', 'enregistrer']);
    expect(b.filter((x) => x.orange), nom).toEqual([]);
    for (const x of actions) {
      expect(x.faceBas - x.faceHaut, `${nom} ${x.nom}`).toBe(30);        // 30 px dessinés
      expect(x.largeur, `${nom} ${x.nom}`).toBeLessThan(p.width / 2);   // jamais sur toute la largeur
    }
    expect(Math.round(p.right - actions[1].droite), nom).toBe(24);       // calés à droite, sur le bord droit du contenu
    expect(Math.round(actions[1].gauche - actions[0].droite), nom).toBe(8);   // 8 px entre deux boutons
    // Rempli : un seul bouton orange, le principal.
    await page.locator('.cm-popup textarea').fill('Un retour');
    ({ p, b } = await lire());
    expect(b.filter((x) => x.orange).map((x) => x.nom), nom).toEqual(['enregistrer']);
    await page.locator('.cm-popup textarea').press('Enter');
    await expect(page.locator('.cm-popup')).toHaveCount(0);
  }
  // Lecture seule : une seule action, « fermer », grise ; aucun orange.
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('witmit_kiosque_v1') || '[]'); d.forEach((c) => { c.status = 'resolu'; c.resolvedBy = 'moi'; }); localStorage.setItem('witmit_kiosque_v1', JSON.stringify(d)); });
  await page.reload();
  await H.activate(page);
  await page.locator('.cm-pin').first().click();
  await expect(page.locator('.cm-popup')).toHaveClass(/cm-locked/);
  const lu = await page.evaluate((f) => eval(f)(document.querySelector('.cm-popup')), lireBoutons.toString());
  expect(lu.filter((x) => x.touche).map((x) => [x.nom, x.orange])).toEqual([['fermer', false]]);
});

test('31. plus aucun raccourci affiché dans un bouton (fenêtre, liste, rapport, champ de réponse, coller un retour) ; il reste dans le nom accessible', async ({ page }) => {
  // « terminer » (bandeau) garde sa puce « échap » jusqu'au lot 7 (fiche Bandeau).
  const fautes = () => page.evaluate(() => Array.from(document.querySelectorAll('.cm-ui button:not(.wm-terminer)')).filter((el) => el.getClientRects().length)
    .flatMap((el) => Array.from(el.querySelectorAll('.wm-repere, svg[data-icone="ArrowElbowDownLeft"], .wm-repere-double')).filter((r) => r.getClientRects().length).map(() => el.textContent.trim())));
  await fenetreVide(page, 'generic-dashboard.html', 'tbody tr:first-child td:nth-child(2)');
  expect(await fautes()).toEqual([]);
  await expect(page.locator('.cm-popup .cm-save')).toHaveAttribute('aria-keyshortcuts', 'Enter');
  await expect(page.locator('.cm-popup .cm-cancel')).toHaveAttribute('aria-keyshortcuts', 'Escape');
  await page.locator('.cm-popup textarea').fill('Un retour');
  await page.locator('.cm-popup textarea').press('Enter');
  await H.deactivate(page);
  const [c] = await H.stored(page, 'witmit_kiosque_v1');
  await H.retourColle(page, [c.id + ' complement | Quelle ligne ?']);
  await page.locator('#cmPasteBtn').click();                            // « coller un retour » rouvert : annuler, appliquer
  await expect(page.locator('#cmFeedbackBox')).toBeVisible();
  expect(await fautes()).toEqual([]);
  await page.locator('#cmFeedbackBox').getByRole('button', { name: 'annuler' }).click();
  await H.ouvrirRetour(page, page.locator('.cm-panel-item').first());   // champ de réponse au complément (c1 : retour ouvert) : annuler, enregistrer
  await expect(page.locator('.cm-panel-item .cm-reponse-actions')).toBeVisible();
  expect(await fautes()).toEqual([]);
  const rep = await page.evaluate((f) => eval(f)(document.querySelector('.cm-panel-item .cm-reponse-actions')), lireBoutons.toString());
  expect(rep.map((x) => [x.nom, x.orange])).toEqual([['annuler', false], ['enregistrer', false]]);   // deux boutons gris, pas de principal ici
  const zone = await page.locator('.cm-panel-item .cm-reponse-actions').boundingBox();
  expect(Math.round(zone.x + zone.width - rep[1].droite)).toBe(0);     // à droite
  await expect(page.locator('.cm-panel-item .cm-rep-annuler')).toHaveAttribute('aria-keyshortcuts', 'Escape');
  await expect(page.locator('.cm-panel-item .cm-rep-envoyer')).toHaveAttribute('aria-keyshortcuts', 'Enter');
  // « nouveau retour » : à sa largeur, à droite, seul bouton orange de la liste, raccourci N dans le nom accessible
  const liste = await page.evaluate((f) => ({ p: document.getElementById('cmPanel').getBoundingClientRect().toJSON(), b: eval(f)(document.getElementById('cmPanel')) }), lireBoutons.toString());
  expect(liste.b.filter((x) => x.orange).map((x) => x.nom)).toEqual(['nouveau retour']);
  const nouveau = liste.b.find((x) => x.nom === 'nouveau retour');
  expect(nouveau.largeur).toBeLessThan(liste.p.width / 2);
  expect(Math.round(liste.p.right - nouveau.droite)).toBe(24);
  await expect(page.locator('#cmNewBtn')).toHaveAttribute('aria-keyshortcuts', 'N');
});

test('32. zone cliquable de 44 px au moins pour chaque bouton dessiné en 30 px (fenêtre, liste, rapport)', async ({ page }) => {
  const mesurer = (sel, toucher) => page.evaluate(([sel, toucher]) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getClientRects().length).map((el) => {
    const b = el.getBoundingClientRect(), f = getComputedStyle(el, '::before'), x = b.left + b.width / 2;
    const touche = (y) => { const t = document.elementFromPoint(x, y); return !!t && t.closest('button') === el; };
    // La zone déborde de la face jusqu'à 44 px (7 px en haut et en bas pour une face de 30 px, 4 px pour 36 px) : un clic
    // à 0,5 px du bord de la zone touche encore le bouton.
    return { nom: el.textContent.trim(), cat: el.matches('.cm-cat, .cm-cat-choix'), zone: b.height, face: b.height - parseFloat(f.top) - parseFloat(f.bottom),
      haut: toucher ? touche(b.top + 0.5) : null, bas: toucher ? touche(b.bottom - 0.5) : null };
  }), [sel, toucher]);
  await fenetreVide(page, 'generic-dashboard.html', 'tbody tr:first-child td:nth-child(2)');
  await page.locator('.cm-popup textarea').fill('Un retour');
  const fenetre = await mesurer('.cm-popup .wm-touche', true);
  expect(fenetre.map((x) => x.nom)).toEqual([expect.stringMatching(/auto/), 'annuler', 'enregistrer']);
  await page.locator('.cm-popup textarea').press('Enter');
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('#cmPanel')).toHaveClass(/show/);
  await page.waitForTimeout(400);
  const nouveau = await mesurer('#cmNewBtn', true);
  // Rapport : boutons à la ligne au besoin, 8 px entre deux rangées (fiche Rapport) : la zone de 44 px de chacun est mesurée sur sa boîte.
  const liste = await mesurer('#cmPanel .wm-touche', false);
  expect(liste.length).toBeGreaterThan(3);
  for (const x of [...fenetre, ...nouveau, ...liste]) {
    expect(x.zone, x.nom).toBeGreaterThanOrEqual(44);
    expect(x.face, x.nom).toBe(x.cat ? 36 : 30);
    if (x.haut !== null) expect([x.haut, x.bas], x.nom).toEqual([true, true]);
  }
});

test('33. texte d’aide du champ : au moins 4,6:1 mesuré à l’écran sur la face réelle du champ (bloc intérieur compris), en clair et en sombre', async ({ page }) => {
  const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contraste = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  for (const [nom, fond, encre] of [['lot3-aide-clair', '#ffffff', [20, 20, 20]], ['lot3-aide-sombre', '#101010', [255, 255, 255]]]) {
    await page.goto(pageEssai(nom, { fond }));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
    const b = await H.visibleBox(page, '#bloc');
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    const ta = page.locator('.cm-popup textarea');
    await expect(ta).toBeVisible();
    expect(await ta.evaluate((t) => getComputedStyle(t, '::placeholder').color)).toBe(fond === '#ffffff' ? 'rgba(20, 20, 20, 0.6)' : 'rgba(255, 255, 255, 0.6)');
    await page.mouse.move(2, 2);
    await ta.evaluate((t) => { t.placeholder = ''; t.blur(); });         // la face nue du champ, sans le texte d'aide
    await page.waitForTimeout(300);
    const r = await ta.boundingBox();
    const png = await page.screenshot({ clip: { x: r.x + 2, y: r.y + 2, width: r.width - 4, height: r.height - 4 } });
    const pixels = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, img.width, img.height).data, out = [];
      for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2]]);
      return out;
    }, png.toString('base64'));
    const pire = Math.min(...pixels.map((f) => contraste([0, 1, 2].map((i) => encre[i] * 0.6 + f[i] * 0.4), f)));
    expect(pire, `${nom} : ${pire.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.6);
  }
});
