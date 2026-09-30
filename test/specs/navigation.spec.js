// V2.4 — deux bugs vus sur TellUs-app (Next.js) le 30/09/2026 :
//  1. navigation sans rechargement : les tickets restaient rangés sous la page de départ ;
//  2. zone intérieure qui défile (la fenêtre, elle, ne bouge pas) : les repères restaient figés à l'écran.
// La page de test est servie en https:// (interception réseau) pour que pushState change vraiment le chemin.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const ORIGIN = 'https://appli.test'; // https : contexte sécurisé, nécessaire au défi Altcha (crypto.subtle)
const KEY = 'witmit_spa_v1';
const SRC = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'witmit.js'), 'utf8');
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'pages', 'spa-defilement.html'), 'utf8');

async function serve(page, modeAttrs = '') {
  await page.route(ORIGIN + '/**', (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/witmit.js') return route.fulfill({ contentType: 'application/javascript', body: SRC });
    return route.fulfill({ contentType: 'text/html', body: HTML.replace('MODE_ATTRS', modeAttrs) });
  });
}
const pinsCount = (page) => page.locator('.cm-pin:not(.cm-pin-secondary)').count();
const nav = async (page, label) => { await page.locator('header a', { hasText: label }).click(); await expect(page.locator('#titre')).toHaveText(label); };

test.describe('Navigation sans rechargement', () => {
  test.beforeEach(async ({ page }) => {
    await serve(page);
    await page.goto(ORIGIN + '/accueil');
    await H.clearStorage(page);
    await page.goto(ORIGIN + '/accueil');
  });

  test('1. un ticket créé après un changement d’onglet est rangé sous la bonne page', async ({ page }) => {
    await H.activate(page);
    await H.addPin(page, '#r2', 'Sur l’accueil');
    await H.deactivate(page);
    await nav(page, 'Adhésion');
    await expect.poll(() => pinsCount(page)).toBe(0); // le repère de l'accueil ne suit pas sur l'autre page (redessin juste après le changement d'URL)
    await H.activate(page);
    await H.addPin(page, '#r3', 'Sur l’adhésion');
    await H.deactivate(page);
    const t = await H.stored(page, KEY);
    expect(t.map((c) => c.page)).toEqual(['/accueil', '/adhesion']);
    expect(t[1].pageTitle).toBe('Adhésion — Appli');
    await expect(page.locator('#cmPanelCount')).toHaveText('1');
    // retour arrière du navigateur : on retrouve le ticket de l'accueil, seul
    await page.goBack();
    await expect(page.locator('#titre')).toHaveText('Accueil');
    await expect.poll(() => pinsCount(page)).toBe(1);
    await expect(page.locator('#cmPanelCount')).toHaveText('1');
  });

  test('2. « Effacer (page) » n’efface que la page affichée', async ({ page }) => {
    await H.activate(page); await H.addPin(page, '#r2', 'Accueil'); await H.deactivate(page);
    await nav(page, 'Adhésion');
    await H.activate(page); await H.addPin(page, '#r3', 'Adhésion'); await H.deactivate(page);
    await page.evaluate(() => window.cmClearAll());
    const t = await H.stored(page, KEY);
    expect(t.map((c) => c.page)).toEqual(['/accueil']);
  });
});

test.describe('Zone intérieure qui défile', () => {
  test.beforeEach(async ({ page }) => {
    await serve(page);
    await page.goto(ORIGIN + '/accueil');
    await H.clearStorage(page);
    await page.goto(ORIGIN + '/accueil');
  });

  test('3. le repère suit le contenu quand la zone défile, et disparaît quand sa cible sort de la zone', async ({ page }) => {
    await H.activate(page);
    await H.addPin(page, '#r5', 'Ligne 5');
    await page.waitForTimeout(1500); // effet teal → orange de l'enregistrement terminé
    // la pastille est redessinée à chaque défilement : on relit sa position sans supposer qu'elle existe à l'instant T
    const pinTop = async () => { const b = await page.locator('.cm-pin').first().boundingBox().catch(() => null); return b ? Math.round(b.y) : null; };
    const y0 = await pinTop();
    expect(y0).not.toBeNull();
    await page.locator('#scroller').evaluate((el) => { el.scrollTop = 120; });
    await expect.poll(pinTop).toBe(y0 - 120);
    // la ligne 5 remonte sous l'en-tête : plus de repère flottant par-dessus
    await page.locator('#scroller').evaluate((el) => { el.scrollTop = 1200; });
    await expect.poll(() => pinsCount(page)).toBe(0);
    await page.locator('#scroller').evaluate((el) => { el.scrollTop = 0; });
    await expect.poll(() => pinsCount(page)).toBe(1);
  });

  test('4. un encadré suit aussi le contenu', async ({ page }) => {
    await H.activate(page);
    const r = await page.locator('#r4').boundingBox();
    await H.drag(page, r.x + 20, r.y + 5, r.x + 300, r.y + 110);
    const ta = page.locator('.cm-popup textarea');
    await ta.fill('Deux lignes'); await ta.press('Enter');
    await expect(page.locator('.cm-popup')).toHaveCount(0);
    // l'encadré est redessiné à chaque défilement : on relit sa position sans supposer qu'il existe à l'instant T
    const top = async () => { const b = await page.locator('.cm-box-saved').first().boundingBox().catch(() => null); return b ? Math.round(b.y) : null; };
    await expect.poll(top).not.toBeNull();
    await page.waitForTimeout(1500); // laisse passer l'effet teal → orange de l'enregistrement (il redessine les repères)
    const y0 = await top();
    await page.locator('#scroller').evaluate((el) => { el.scrollTop = 100; });
    await expect.poll(top).toBe(y0 - 100);
  });
});

test.describe('Mode live : la page du serveur fait foi', () => {
  test('5. un ancien ticket mal rangé est recalé sur la page enregistrée au serveur', async ({ page }) => {
    const state = {};
    await H.mockSupabase(page, state);
    await serve(page, 'data-mode="live" data-supabase-url="https://witmit.test/" data-supabase-key="sb_publishable_test" data-capture="false"');
    await page.goto(ORIGIN + '/accueil?witmit=on');
    await H.clearStorage(page);
    await page.goto(ORIGIN + '/accueil?witmit=on');
    await H.activate(page);
    await H.addPin(page, '#r2', 'Envoyé depuis l’accueil');
    await expect.poll(async () => (((await H.stored(page, KEY))[0] || {}).sync || {}).state, { timeout: 15000 }).toBe('sent');
    expect(state.posts[0].body.page).toBe('/accueil');
    await H.deactivate(page);
    // on simule le bug d'avant : ticket rangé localement sous « adhesion » (la page de départ figée)
    await page.evaluate((k) => { const t = JSON.parse(localStorage.getItem(k)); t[0].page = 'adhesion'; delete t[0].path; localStorage.setItem(k, JSON.stringify(t)); }, KEY);
    await page.reload();
    const t = (await H.stored(page, KEY))[0];
    state.rows = [{ id_local: t.id, page: '/accueil', statut: 'nouveau', message_retour: null, mis_a_jour_le: '2026-09-30T08:00:00Z' }];
    await page.locator('#cmPanelBtn').click();
    await expect.poll(async () => (await H.stored(page, KEY))[0].page).toBe('/accueil');
    await expect(page.locator('#cmPanelCount')).toHaveText('1');
  });
});

test.describe('Tiroir du site ouvert pendant que la liste witmit est ouverte', () => {
  test('6. un tiroir animé (animation « both ») ouvert après la liste est poussé à gauche, pas recouvert', async ({ page }) => {
    await serve(page);
    await page.goto(ORIGIN + '/accueil');
    await H.clearStorage(page);
    await page.goto(ORIGIN + '/accueil');
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('#cmPanel')).toBeVisible();
    // comme TiroirLateral de TellUs-app : fixed, right:0, entrée animée par transform avec fill-mode both
    await page.evaluate(() => {
      const st = document.createElement('style');
      st.textContent = '@keyframes entree{from{transform:translateX(100%)}to{transform:translateX(0)}} #tiroirSite{position:fixed;top:0;bottom:0;right:0;width:360px;background:#fff;z-index:400;animation:entree 200ms ease both}';
      document.head.appendChild(st);
      const d = document.createElement('div'); d.id = 'tiroirSite'; d.textContent = 'Fiche membre';
      document.body.appendChild(d);
    });
    const panelLeft = Math.round((await page.locator('#cmPanel').boundingBox()).x);
    await expect.poll(async () => Math.round((await page.locator('#tiroirSite').boundingBox()).x + 360)).toBeLessThanOrEqual(panelLeft + 1);
    // liste refermée : le tiroir du site revient contre le bord
    await page.locator('#cmPanelBtn').click();
    const vw = await page.evaluate(() => document.documentElement.clientWidth);
    await expect.poll(async () => Math.round((await page.locator('#tiroirSite').boundingBox()).x + 360)).toBe(vw);
  });
});
