// witmit 0.4.0, lot 3 : la fenêtre de commentaire (fiche Fenetre, a2, h1, i1), les types et les mots (fiche Icones, R18 à
// R21), la corbeille (d1, appel « retirer » simulé), la liste par page (g2 version 2), l'interrupteur gris / orange (e1),
// ZB-303 et les finitions de ZB-280. Toutes les actions passent par la souris et le clavier.
const { test, expect } = require('@playwright/test');
const path = require('path');
const H = require('./helpers');

const FORM = 'formulaire.html';
const AUTRE = 'liste-autre.html';
const KEY = 'witmit_formulaire-test_v1';
const chemin = (nom) => path.join(path.resolve(__dirname, '..', 'pages'), nom);
const sansInsecables = (t) => (t || '').replace(/ /g, ' ');

// Retours posés dans le navigateur avant le chargement (deux pages du même projet).
function retour(id, page, texte, date, extra = {}) {
  return { id, type: 'pin', status: 'nouveau', page, path: chemin(page), pageTitle: page === AUTRE ? 'File d’attente du comité' : 'Proposer une expérience',
    zone: 'bloc « En attente »', cible: { genre: 'bloc', nom: page === AUTRE ? 'En attente' : 'Comité de validation', desc: '' },
    anchor: { path: page === AUTRE ? 'div:nth-of-type(1)' : 'div:nth-of-type(1)', relX: 0.9, relY: 0.1 }, fallback: { x: 100, y: 100 },
    text: texte, date, vuLe: date, category: 'a-classer', ...extra };
}
async function poser(page, retours, nom = FORM) {
  await page.goto(H.fileUrl(nom));
  await page.evaluate(([k, r]) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem(k, JSON.stringify(r)); }, [KEY, retours]);
  await page.goto(H.fileUrl(nom));
}
async function viser(page, selecteur, dx, dy) {
  const b = await H.visibleBox(page, selecteur);
  await page.mouse.click(b.x + (dx ?? b.width / 2), b.y + (dy ?? b.height / 2));
  await expect(page.locator('.cm-popup')).toHaveCount(1);
  return b;
}
const titre = (page) => page.locator('.cm-popup .cm-titre');
const ligne2 = async (page) => sansInsecables(await page.locator('.cm-popup .cm-zone-txt').textContent());

test.describe('fenêtre de commentaire', () => {
  test.beforeEach(async ({ page }) => { await poser(page, []); await H.activate(page); });

  test('1. 300 px, centrée 8 px sous la sélection ; tête a2 ; un seul bouton ; ni points, ni libellés, ni catégorie, ni « annuler »', async ({ page }) => {
    await viser(page, '#carte', 12, 12);
    const pop = page.locator('.cm-popup');
    const r = await pop.boundingBox();
    expect(Math.round(r.width)).toBe(300);
    const cadre = await page.locator('.cm-box-editing > .wm-cadre').boundingBox();
    expect(Math.abs((r.x + r.width / 2) - (cadre.x + cadre.width / 2))).toBeLessThan(1.5);
    expect(Math.round(r.y - (cadre.y + cadre.height))).toBe(8);
    await expect(titre(page)).toHaveText('bloc');
    await expect(pop.locator('.cm-type-ico svg[data-icone="Rectangle"]')).toHaveCount(1);
    await expect(pop.locator('.cm-type-ico svg')).toHaveAttribute('style', /width:16px/);
    expect(await ligne2(page)).toBe('Comité de validation · Outil multi-utilisateur pour relire et valider les expériences proposées. Actif');
    await expect(pop.locator('.cm-zone-txt')).toHaveCSS('text-overflow', 'ellipsis');
    await expect(pop.locator('.cm-tete')).toHaveAttribute('title', 'glisse pour déplacer la fenêtre');
    const croix = pop.locator('.cm-fermer');
    await expect(croix).toHaveAttribute('aria-label', 'fermer');
    expect(Math.round((await croix.boundingBox()).width)).toBe(24);
    await expect(pop.locator('[data-icone="DotsSixVertical"], .cm-libelle, .cm-cat, .cm-cancel')).toHaveCount(0);
    await expect(pop.locator('button.wm-principale')).toHaveCount(1);
    await expect(pop.getByRole('button', { name: 'annuler' })).toHaveCount(0);
    const ta = pop.locator('textarea');
    await expect(ta).toHaveAttribute('placeholder', 'ta remarque, ta question ou ta critique…');
    await expect(ta).toHaveAttribute('title', /^maj\+entrée\s:\saller à la ligne$/);
    expect(Math.round((await ta.boundingBox()).height)).toBe(64);
    // Bloc intérieur à 8 px des bords ; crochets G à 5 px (trait de 2 px, axe à 6 px, bras jusqu'à 16 px).
    const bloc = await pop.locator('.wm-bloc').boundingBox();
    expect(Math.round(bloc.x - r.x)).toBe(8);
    expect(Math.round(r.x + r.width - bloc.x - bloc.width)).toBe(8);
    expect(await pop.locator('.wm-contour path').first().getAttribute('d')).toBe('M6 16V9Q6 6 9 6H16');
    // Le champ grandit avec le texte jusqu'à 240 px.
    await ta.fill('ligne\n'.repeat(30));
    expect(Math.round((await ta.boundingBox()).height)).toBe(240);
  });

  test('2. au-dessus, toujours centrée, quand la place manque dessous ; jamais hors de l’écran ni sous la liste', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 520 });
    await page.locator('#defile').scrollIntoViewIfNeeded();
    const b = await page.locator('#envoyer').boundingBox();
    await page.evaluate((y) => window.scrollBy(0, y - 440), b.y);
    await viser(page, '#envoyer');
    const r = await page.locator('.cm-popup').boundingBox();
    const cadre = await page.locator('.cm-box-editing > .wm-cadre').boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(cadre.y - 8 + 0.5);
    expect(r.y).toBeGreaterThanOrEqual(8);
    const liste = await page.locator('#cmPanel').boundingBox();
    expect(r.x + r.width).toBeLessThanOrEqual(liste.x);
  });

  test('3. clic dehors : ferme la fenêtre sans rien viser ; le second clic vise', async ({ page }) => {
    await viser(page, '#carte', 12, 12);
    const b = await H.visibleBox(page, '#envoyer');
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(page.locator('.cm-popup')).toHaveCount(0);
    await page.waitForTimeout(400);
    await expect(page.locator('.cm-popup')).toHaveCount(0);
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(titre(page)).toHaveText('bouton');
  });

  test('4. champ rempli : « abandonner ce retour ? » dans la fenêtre, « garder » a le focus, Échap garde ; aucun confirm() natif', async ({ page }) => {
    let natif = 0;
    page.on('dialog', async (d) => { natif++; await d.dismiss(); });
    await viser(page, '#carte', 12, 12);
    await page.locator('.cm-popup textarea').fill('Le titre pourrait dire « comité » tout court.');
    // la croix
    await page.locator('.cm-popup .cm-fermer').click();
    const q = page.locator('.cm-popup .cm-abandon');
    await expect(q).toBeVisible();
    await expect(q.locator('.cm-abandon-question')).toHaveText('abandonner ce retour ?');
    expect(await q.locator('.cm-abandon-question').textContent()).toBe('abandonner ce retour ?');
    await expect(page.locator('.cm-popup .cm-popup-actions')).toBeHidden();
    await expect(q.getByRole('button', { name: 'garder' })).toBeFocused();
    await expect(q.locator('button')).toHaveText(['abandonner', 'garder']);
    await expect(q.locator('button.wm-principale')).toHaveCount(0);
    // Échap garde
    await page.keyboard.press('Escape');
    await expect(q).toBeHidden();
    await expect(page.locator('.cm-popup textarea')).toBeFocused();
    // Échap avec du texte : la question ; Entrée sur « garder » garde
    await page.keyboard.press('Escape');
    await expect(q).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(q).toBeHidden();
    // clic dehors avec du texte : la question, rien n'est visé
    const b = await H.visibleBox(page, '#envoyer');
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(q).toBeVisible();
    await expect(titre(page)).toHaveText('bloc');
    // « réduire » avec du texte : la question, witmit reste ouvert
    await page.locator('#cmPanel .cm-panel-reduire').click();
    await expect(q).toBeVisible();
    await expect(page.locator('#cmPanel')).toHaveClass(/show/);
    await q.getByRole('button', { name: 'abandonner' }).click();
    await expect(page.locator('.cm-popup')).toHaveCount(0);
    expect(await H.stored(page, KEY)).toHaveLength(0);
    expect(natif).toBe(0);
    // Plus aucun confirm() dans le code du widget.
    const fs = require('fs');
    expect(fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'witmit.js'), 'utf8')).not.toMatch(/\bconfirm\(\s*[^)\s]/);
  });

  test('5. types et mots : case (cochée ou non, R19), champ vide (R20), liste déroulante (R21), étiquette, lien, icône, bouton', async ({ page }) => {
    const cas = [
      ['#nouvelles', 'case à cocher', 'CheckSquare', 'Recevoir les nouvelles EIC · cochée'],
      ['#rappel', 'case à cocher', 'CheckSquare', "M'envoyer un rappel · non cochée"],
      ['#ville', 'champ', 'Textbox', 'Ville · vide, texte grisé « Ville (ex : Bangkok) »'],
      ['#langue', 'liste déroulante', 'CaretUpDown', 'Langue · « Français » choisi, 3 choix'],
      ['#badge', 'étiquette', 'TagSimple', 'Actif · dans « Comité de validation »'],
      ['#lien', 'lien', 'Link', "Lire l'aide"],
      ['#icone', 'icône ou image', 'Image', 'Aide'],
      ['#envoyer', 'bouton', 'CursorClick', 'Suivant'],
    ];
    for (const [sel, type, ico, l2] of cas) {
      await viser(page, sel);
      await expect(titre(page)).toHaveText(type);
      await expect(page.locator('.cm-popup .cm-type-ico svg')).toHaveAttribute('data-icone', ico);
      expect(await ligne2(page)).toBe(l2);
      await page.keyboard.press('Escape');
      await expect(page.locator('.cm-popup')).toHaveCount(0);
    }
    // R21 : la liste déroulante fermée ; ses choix et celui qui est choisi partent dans le champ zone du ticket.
    await viser(page, '#langue');
    await page.locator('.cm-popup textarea').fill('Ajouter le portugais.');
    await page.keyboard.press('Enter');
    const t = (await H.stored(page, KEY))[0];
    expect(t.zone).toBe('liste déroulante « Langue » · « Français » choisi, 3 choix · choix : Français, English, Español');
    expect(t.zone.length).toBeLessThanOrEqual(300);
    await expect(page.locator('#cmList .cm-panel-item .zone-txt')).toHaveText('liste déroulante « Langue »');
    await expect(page.locator('#cmList .cm-panel-item .zone svg[data-icone="CaretUpDown"]')).toHaveCount(1);
  });

  test('6. types et mots : mot (double-clic), texte (clic sur un paragraphe), zone, point, plusieurs éléments', async ({ page }) => {
    const p = await H.visibleBox(page, '.carte-desc');
    await page.mouse.dblclick(p.x + 30, p.y + 10);
    await expect(titre(page)).toHaveText('mot');
    await expect(page.locator('.cm-popup .cm-type-ico svg')).toHaveAttribute('data-icone', 'TextAa');
    expect(await ligne2(page)).toBe('« Outil » · dans « Comité de validation »');
    await page.keyboard.press('Escape');
    await viser(page, '.carte-desc', 30, 10);
    await expect(titre(page)).toHaveText('texte');
    await expect(page.locator('.cm-popup .cm-type-ico svg')).toHaveAttribute('data-icone', 'Highlighter');
    expect(await ligne2(page)).toMatch(/^« Outil multi-utilisateur pour relire et valider les expériences proposées\. Actif » · dans « Comité de validation »$/);
    await page.keyboard.press('Escape');
    // zone tracée
    const c = await H.visibleBox(page, '#carte');
    await H.drag(page, c.x - 6, c.y - 6, c.x + c.width + 6, c.y + c.height + 6);
    await expect(titre(page)).toHaveText('zone');
    await expect(page.locator('.cm-popup .cm-type-ico svg')).toHaveAttribute('data-icone', 'BoundingBox');
    expect(await ligne2(page)).not.toMatch(/zone/);
    await page.keyboard.press('Escape');
    // point : clic dans le vide de la page
    await page.mouse.click(900, 120);
    await expect(titre(page)).toHaveText('point');
    await expect(page.locator('.cm-popup .cm-type-ico svg')).toHaveAttribute('data-icone', 'Crosshair');
    await page.keyboard.press('Escape');
    // plusieurs éléments
    await viser(page, '#envoyer');
    const l = await H.visibleBox(page, '#lien');
    await page.keyboard.down(H.IS_MAC ? 'Meta' : 'Control');
    await page.mouse.click(l.x + l.width / 2, l.y + l.height / 2);
    await page.keyboard.up(H.IS_MAC ? 'Meta' : 'Control');
    await expect(titre(page)).toHaveText('plusieurs éléments');
    expect(await ligne2(page)).toBe("Suivant, Lire l'aide · 2 éléments");
    // ZB-280 : le message passager ne répète plus l'aide « ⌘+clic » déjà dans la fenêtre.
    await expect(page.locator('#cmStatus')).toHaveText('2 éléments sélectionnés');
    await expect(page.locator('.cm-popup .cm-aide-multi')).toBeVisible();
  });

  test('7. R18 : un clic sur la bande d’une barre de défilement vise la barre du bloc qui défile, cadre fin le long de la barre', async ({ page }) => {
    const d = await H.visibleBox(page, '#defile');
    await page.mouse.click(d.x + d.width - 5, d.y + 50);
    await expect(page.locator('.cm-popup')).toHaveCount(1);
    await expect(titre(page)).toHaveText('barre de défilement');
    await expect(page.locator('.cm-popup .cm-type-ico svg')).toHaveAttribute('data-icone', 'ArrowsDownUp');
    expect(await ligne2(page)).toBe('Ligne 1 du bloc qui défile. · verticale');
    const cadre = await page.locator('.cm-box-editing').boundingBox();
    expect(cadre.width).toBeLessThanOrEqual(16);
    expect(Math.abs(cadre.height - (d.height - 2))).toBeLessThan(2);
    expect(Math.abs(cadre.x + cadre.width - (d.x + d.width - 1))).toBeLessThan(2);
    await page.locator('.cm-popup textarea').fill('La barre est trop fine.');
    await page.keyboard.press('Enter');
    const t = (await H.stored(page, KEY))[0];
    expect(t.barre).toBe('verticale');
    expect(t.zone).toBe('barre de défilement « Ligne 1 du bloc qui défile. » · verticale');
    // Après rechargement, son cadre reste fin le long de la barre.
    await page.reload();
    await H.activate(page);
    const enreg = await page.locator('.cm-box-saved').first().boundingBox();
    expect(enreg.width).toBeLessThanOrEqual(16);
  });

  test('8. lecture seule : verrou, statut, « · non modifiable », le texte ; ni bouton ni corbeille ; la croix ferme', async ({ page }) => {
    await poser(page, [retour('r1', FORM, 'Déjà pris en compte', '2026-11-01T10:00:00.000Z', { status: 'pris_en_compte', anchor: { path: 'div:nth-of-type(1)', relX: 0.5, relY: 0.5 } })]);
    await H.activate(page);
    await page.locator('.cm-pin[data-id="r1"]').click();
    const pop = page.locator('.cm-popup');
    await expect(pop.locator('.cm-lock-line')).toHaveText(/pris en compte\s·\snon modifiable/);
    await expect(pop.locator('.cm-texte-lu')).toHaveText('« Déjà pris en compte »');
    await expect(pop.locator('button.wm-touche, .cm-delete, textarea')).toHaveCount(0);
    await pop.locator('.cm-fermer').click();
    await expect(pop).toHaveCount(0);
  });
});

test.describe('corbeille (d1)', () => {
  const PAGE = 'generic-dashboard-sync.html';
  const KS = 'witmit_kiosque-sync_v1';
  let state;
  test.beforeEach(async ({ page }) => {
    state = {};
    await H.mockSupabase(page, state);
    await page.goto(H.fileUrl(PAGE));
    await H.clearStorage(page);
    await page.goto(H.fileUrl(PAGE) + '?witmit=on');
  });
  const envoye = (page) => expect.poll(async () => (((await H.stored(page, KS))[0] || {}).sync || {}).state, { timeout: 15000 }).toBe('sent');

  test('9. retour pas encore parti : il s’efface ici ; envoyé : « retirer » appelle le guichet (simulé) et il quitte la liste', async ({ page }) => {
    await H.activate(page);
    // envoyé
    await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'À retirer');
    await envoye(page);
    await page.locator('.cm-pin').first().click();
    const corbeille = page.locator('.cm-popup .cm-delete');
    await expect(corbeille).toHaveAttribute('aria-label', 'retirer ce retour');
    const c = await corbeille.boundingBox();
    const act = await page.locator('.cm-popup .wm-principale').boundingBox();
    expect(Math.round(c.width)).toBe(30);
    expect(c.x).toBeLessThan(act.x);
    await corbeille.click();
    await expect.poll(() => state.retraits.length).toBe(1);
    expect(state.retraits[0].body).toEqual({ ticket_id: 'srv-1' });
    expect(state.retraits[0].headers['authorization']).toBe('Bearer jeton-A');
    await expect(page.locator('.cm-popup')).toHaveCount(0);
    await expect.poll(async () => (await H.stored(page, KS)).length).toBe(0);
    await expect(page.locator('#cmList .cm-panel-item')).toHaveCount(0);
    // pas encore parti : effacé ici, sans appel au guichet
    state.failNext = { status: 409, erreur: 'refusé' };
    await H.addPin(page, 'tbody tr:nth-child(2) td:nth-child(2)', 'Jamais parti');
    await expect.poll(async () => (((await H.stored(page, KS))[0] || {}).sync || {}).state, { timeout: 15000 }).toBe('error');
    await page.locator('.cm-pin').first().click();
    await expect(page.locator('.cm-popup .cm-delete')).toHaveAttribute('aria-label', 'supprimer ce retour');
    await page.locator('.cm-popup .cm-delete').click();
    expect(await H.stored(page, KS)).toHaveLength(0);
    expect(state.retraits).toHaveLength(1);
  });

  test('10. 409 (plus « nouveau ») : le retour reste, « pris en compte », plus de corbeille ; pris en compte : jamais de corbeille', async ({ page }) => {
    await H.activate(page);
    await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Trop tard');
    await envoye(page);
    state.failRetrait = { status: 409, erreur: 'déjà pris en charge' };
    await page.locator('.cm-pin').first().click();
    await page.locator('.cm-popup .cm-delete').click();
    await expect(page.locator('#cmStatus')).toHaveText("retrait impossible : l'équipe a déjà pris ce retour en compte.");
    await expect.poll(async () => (await H.stored(page, KS))[0].status).toBe('pris_en_compte');
    await page.keyboard.press('Escape');
    await page.locator('.cm-pin').first().click();
    await expect(page.locator('.cm-popup .cm-delete')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.cm-popup')).toHaveCount(0);
    const ligne = page.locator('#cmList .cm-panel-item').first();
    await H.ouvrirRetour(page, ligne);
    await expect(ligne.locator('.del')).toHaveCount(0);
  });
});

test.describe('liste par page (g2 version 2)', () => {
  const a = retour('a1', FORM, 'Le titre pourrait dire « comité ».', '2026-11-01T09:00:00.000Z');
  const b1 = retour('b1', AUTRE, 'Premier retour de la file.', '2026-10-30T09:00:00.000Z', { anchor: { path: 'div:nth-of-type(1)', relX: 0.9, relY: 0.1 } });
  const b2 = retour('b2', AUTRE, 'Second retour de la file.', '2026-11-01T12:00:00.000Z', { status: 'resolu', resolvedBy: 'moi', anchor: { path: 'div:nth-of-type(2)', relX: 0.9, relY: 0.1 }, cible: { genre: 'bloc', nom: 'Archives', desc: '' } });
  const c1 = { ...retour('c1', 'vieille-page.html', 'Une page plus ancienne.', '2026-10-20T09:00:00.000Z'), pageTitle: 'Vieille page' };

  test('11. page en cours d’abord, dépliée ; autres pages repliées, la plus récente d’abord ; numéros par page', async ({ page }) => {
    await poser(page, [c1, b1, a, b2]);
    await H.activate(page);
    const pages = page.locator('#cmList .cm-page');
    await expect(pages).toHaveCount(3);
    await expect(pages.nth(0).locator('.cm-page-nom')).toHaveText('Proposer une expérience · cette page');
    await expect(pages.nth(0).locator('.cm-page-chemin')).toHaveText('formulaire.html');
    await expect(pages.nth(0).locator('.cm-page-aller')).toHaveCount(0);
    await expect(pages.nth(0).locator('.cm-panel-item')).toHaveCount(1);
    await expect(pages.nth(1).locator('.cm-page-nom')).toHaveText('File d’attente du comité');
    await expect(pages.nth(2).locator('.cm-page-nom')).toHaveText('Vieille page');
    await expect(pages.nth(1).locator('.cm-panel-item')).toHaveCount(0);
    await expect(pages.nth(1).locator('.cm-page-compte')).toHaveText('2 retours · 1 à suivre');
    await expect(pages.nth(1).locator('.cm-page-afficher')).toHaveText('afficher');
    await expect(pages.nth(1).locator('.cm-page-afficher svg')).toHaveAttribute('data-icone', 'CaretDown');
    await expect(pages.nth(1).locator('.cm-page-aller')).toHaveText('aller');
    await expect(pages.nth(1).locator('.cm-page-aller svg')).toHaveAttribute('data-icone', 'ArrowRight');
    // Titre hors du bloc : 13 px semi-gras ; bloc à 10 px des bords de la liste.
    await expect(pages.nth(0).locator('.cm-page-nom')).toHaveCSS('font-weight', '600');
    await expect(pages.nth(0).locator('.cm-page-nom')).toHaveCSS('font-size', '13px');
    const liste = await page.locator('#cmPanel').boundingBox(), bloc = await pages.nth(0).locator('.cm-page-bloc').boundingBox();
    expect(Math.round(bloc.x - liste.x)).toBe(10);
    // afficher / masquer
    await pages.nth(1).locator('.cm-page-plier').click();
    await expect(pages.nth(1).locator('.cm-panel-item')).toHaveCount(2);
    await expect(pages.nth(1).locator('.cm-panel-item .num')).toHaveText(['1', '2']);
    await expect(pages.nth(1).locator('.cm-page-afficher')).toHaveText('masquer');
    // « masquer les terminés » : vaut pour toutes les pages ; une page dont tout est masqué disparaît.
    await page.locator('#cmPanel .cm-hide-done').click();
    await expect(pages.nth(1).locator('.cm-panel-item')).toHaveCount(1);
    await pages.nth(1).locator('.cm-page-plier').click();
    // Noms accessibles : une liste de tout le site.
    await expect(page.locator('#cmPanel')).toHaveAttribute('aria-label', 'witmit : tes retours sur ce site');
    await expect(page.locator('#cmList')).toHaveAttribute('aria-label', 'tes retours sur ce site, page par page');
  });

  test('12. « aller » ouvre l’autre page, witmit reste ouvert ; un clic sur un retour d’une autre page y mène et l’ouvre', async ({ page }) => {
    await poser(page, [a, b1, b2]);
    await H.activate(page);
    await page.locator('#cmList .cm-page').nth(1).locator('.cm-page-aller').click();
    await page.waitForURL(/liste-autre\.html/);
    await expect(page.locator('#cmPanel')).toHaveClass(/show/);
    await expect(page.locator('body')).toHaveClass(/cm-active/);
    await expect(page.locator('#cmList .cm-page').first().locator('.cm-page-nom')).toHaveText('File d’attente du comité · cette page');
    // retour à la première page par un clic sur son retour : la page s'ouvre, le retour est choisi et sa fenêtre ouverte
    await page.locator('#cmList .cm-page').nth(1).locator('.cm-page-plier').click();
    await page.locator('#cmList .cm-panel-item[data-id="a1"] .txt').click();
    await page.waitForURL(/formulaire\.html/);
    await expect(page.locator('#cmPanel')).toHaveClass(/show/);
    await expect(page.locator('#cmList .cm-panel-item[data-id="a1"]')).toHaveClass(/cm-current/);
    await expect(page.locator('.cm-popup')).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('.cm-popup textarea')).toHaveValue('Le titre pourrait dire « comité ».');
  });

  test('13. liste vide : l’aide reste juste (un clic sur un paragraphe le prend comme passage)', async ({ page }) => {
    await poser(page, []);
    await H.activate(page);
    await expect(page.locator('#cmList .cm-vide-gestes li').first()).toHaveText('clic : un élément ou un paragraphe');
    await expect(page.locator('#cmList .cm-page-nom')).toHaveText('Proposer une expérience · cette page');
  });

  test('14. ZB-303 : sur un retour réduit, « à renvoyer » (icône rouge et mot) avant l’élément visé et le voyant « nouveau » devant ; deux lignes', async ({ page }) => {
    const sync = 'generic-dashboard-sync.html';
    const st = {};
    await H.mockSupabase(page, st);
    await page.goto(H.fileUrl(sync));
    await H.clearStorage(page);
    await page.goto(H.fileUrl(sync) + '?witmit=on');
    st.failNext = { status: 429, erreur: 'trop de tickets' };
    await H.activate(page);
    await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Ticket refusé');
    await expect.poll(async () => ((await H.stored(page, 'witmit_kiosque-sync_v1'))[0].sync || {}).state, { timeout: 15000 }).toBe('error');
    await page.evaluate(() => { const k = 'witmit_kiosque-sync_v1', r = JSON.parse(localStorage.getItem(k)); r[0].equipeLe = new Date(Date.now() + 1000).toISOString(); localStorage.setItem(k, JSON.stringify(r)); });
    st.failNext = { status: 429, erreur: 'trop de tickets' };
    await page.reload();
    await H.activate(page);
    const ligne = page.locator('#cmList .cm-panel-item').first();
    const z = ligne.locator('.zone');
    await expect(z.locator('> .wm-voyant')).toBeVisible();
    await expect(z.locator('> .cm-sync-error')).toBeVisible();
    await expect(z.locator('> .cm-sync-error svg')).toHaveClass(/wm-signal/);
    await expect(z.locator('> .cm-sync-error')).toHaveText('à renvoyer');
    const ordre = await z.evaluate((el) => Array.prototype.map.call(el.children, (x) => x.className.baseVal !== undefined ? 'svg' : x.className));
    expect(ordre[0]).toMatch(/wm-voyant/);
    expect(ordre.findIndex((x) => /cm-sync-error/.test(x))).toBeLessThan(ordre.findIndex((x) => /zone-txt/.test(x)));
    const h = (await ligne.boundingBox()).height;
    expect(h).toBeLessThan(62);   // deux lignes (9 + 19 + 18 + 9 px, et l'arrondi)
  });
});

test.describe('interrupteur gris / orange (e1)', () => {
  test('15. absent sans l’attribut ; présent, effet immédiat, mémorisé dans le navigateur', async ({ page }) => {
    await page.goto(H.fileUrl('selection.html'));
    await H.clearStorage(page);
    await page.reload();
    await H.activate(page);
    await expect(page.locator('#cmPanel .cm-interrupteur')).toBeHidden();
    await poser(page, []);
    await H.activate(page);
    const sw = page.locator('#cmPanel .cm-interrupteur');
    await expect(sw).toBeVisible();
    await expect(sw).toHaveAttribute('role', 'switch');
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await expect(sw).toHaveText('sélections en orange');
    const pastille = await sw.locator('.wm-switch').boundingBox();
    expect([Math.round(pastille.width), Math.round(pastille.height)]).toEqual([28, 16]);
    await expect(page.locator('body')).toHaveAttribute('data-wm-selection', 'gris');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('body')).toHaveAttribute('data-wm-selection', 'orange');
    await expect(sw.locator('.wm-switch')).toHaveCSS('background-color', 'rgb(247, 130, 26)');
    await page.reload();
    await H.activate(page);
    await expect(page.locator('body')).toHaveAttribute('data-wm-selection', 'orange');
    await expect(page.locator('#cmPanel .cm-interrupteur')).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('finitions (ZB-280)', () => {
  test('16. espaces insécables avant « : ? ! » et dans « » ; le texte de la personne reste intact', async ({ page }) => {
    await poser(page, [retour('r1', FORM, 'Pourquoi « comité » ? Voilà : tout.', '2026-11-01T10:00:00.000Z')]);
    await H.activate(page);
    const aide = await page.locator('#cmPanelAide span').textContent();
    expect(aide).toBe('glisser : une zone · échap : réduire witmit');
    expect(await page.locator('#cmList .cm-panel-item .zone-txt').textContent()).toBe('bloc « Comité de validation »');
    expect(await page.locator('#cmList .cm-panel-item .txt').textContent()).toBe('Pourquoi « comité » ? Voilà : tout.');
    expect(await page.locator('#cmPanel .cm-hide-done').textContent()).toBe('masquer les terminés');
    await viser(page, '#ville');
    expect(await page.locator('.cm-popup .cm-zone-txt').textContent()).toBe('Ville · vide, texte grisé « Ville (ex : Bangkok) »');
  });

  test('17. message passager, liste ouverte, entre 481 et 747 px : centré dans la page rétrécie, jamais sur la liste', async ({ page }) => {
    await poser(page, []);
    await page.setViewportSize({ width: 700, height: 700 });
    await H.activate(page);
    await viser(page, '#envoyer');
    await page.locator('.cm-popup textarea').fill('Un retour');
    await page.keyboard.press('Enter');
    const s = await page.locator('#cmStatus > .wm-verre').boundingBox();
    const liste = await page.locator('#cmPanel').boundingBox();
    expect(s.x + s.width).toBeLessThanOrEqual(liste.x);
    expect(Math.abs((s.x + s.width / 2) - liste.x / 2)).toBeLessThan(2);
  });

  test('18. ⌥ et ⌘ en icônes dans les messages passagers', async ({ page }) => {
    await poser(page, []);
    await page.keyboard.press(H.CACHER);
    const st = page.locator('#cmStatus');
    await expect(st.locator('.wm-repere svg[data-icone="' + (H.IS_MAC ? 'Option' : 'Option') + '"]')).toHaveCount(H.IS_MAC ? 1 : 0);
    if (!H.IS_MAC) await expect(st).toContainText('alt+A');
    else await expect(st).toHaveText(/option\+A/);
  });

  test('19. rapport : « <id du retour> » ; visionneuse : la date reste visible, plus de « zone · zone encadrée »', async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page);
    await page.reload();
    await H.activate(page);
    const b = await H.visibleBox(page, '.kpi-row');
    await H.drag(page, b.x - 6, b.y - 6, b.x + b.width + 6, b.y + b.height + 6);
    await page.locator('.cm-popup textarea').fill('Les tuiles');
    await page.keyboard.press('Enter');
    await expect.poll(async () => !!((await H.stored(page, 'witmit_kiosque_v1'))[0].shot || {}).dataUrl, { timeout: 15000 }).toBe(true);
    const ligne = page.locator('#cmList .cm-panel-item').first();
    await H.ouvrirRetour(page, ligne);
    await ligne.locator('.cm-vignette').click();
    const meta = page.locator('.cm-lightbox .cm-lb-meta');
    await expect(meta.locator('.cm-lb-date')).toBeVisible();
    expect(sansInsecables(await meta.textContent())).not.toMatch(/zone · zone/);
    expect(sansInsecables(await meta.locator('.cm-lb-cible').textContent())).toMatch(/^retour 1 · zone /);
    await page.keyboard.press('Escape');
    await page.evaluate(() => { window.__md = null; navigator.clipboard.writeText = (t) => { window.__md = t; return Promise.resolve(); }; });
    await page.locator('#cmPanel .cm-panel-report').getByRole('button', { name: 'copier' }).click();
    // Des retours à marquer : la question au pied de la liste (plus de confirm() natif) ; « sans marquer ».
    await expect(page.locator('#cmPanelPied .cm-confirme-question')).toHaveText(/^marquer 1 retour comme signalé dans le rapport R-/);
    await page.locator('#cmPanelPied .cm-confirme').getByRole('button', { name: 'sans marquer' }).click();
    await expect.poll(() => page.evaluate(() => !!window.__md)).toBe(true);
    const md = await page.evaluate(() => window.__md);
    expect(md).toContain('<id du retour> pris_en_compte');
    expect(md).not.toContain('<id du ticket>');
  });

  test('20. message arrivé mais pas gardé dans le fil (500 « publié ») : marqué « envoyé », plus « à renvoyer »', async ({ page }) => {
    const st = {};
    await H.mockSupabase(page, st);
    await page.goto(H.fileUrl('generic-dashboard-sync.html'));
    await H.clearStorage(page);
    const now = new Date().toISOString();
    await page.evaluate((d) => localStorage.setItem('witmit_kiosque-sync_v1', JSON.stringify([{ id: 'x1', type: 'pin', status: 'pris_en_compte', page: 'generic-dashboard-sync.html', zone: 'cellule', text: 'Un retour', date: d, vuLe: d, recuLe: d,
      anchor: { path: 'main:nth-of-type(1)', relX: 0.5, relY: 0.5 }, fallback: { x: 10, y: 10 }, category: 'a-classer',
      sync: { state: 'sent', id: 'srv-9', statut: 'en_cours', at: d }, thread: [{ de: 'equipe', texte: 'Vu', cree_le: d }],
      replies: [{ id: 'm1', date: d, text: 'Merci', rouvrir: false, sync: { state: 'error', status: 500, error: 'publié sur GitHub mais non enregistré', renvoi: false, at: d } }] }])), now);
    await page.goto(H.fileUrl('generic-dashboard-sync.html') + '?witmit=on');
    await H.activate(page);
    const ligne = page.locator('#cmList .cm-panel-item').first();
    await H.ouvrirRetour(page, ligne);
    const msg = ligne.locator('.cm-msg-pending');
    await expect(msg.locator('.cm-sync-chip')).toHaveText('envoyé');
    await expect(msg.locator('.cm-sync-error')).toHaveCount(0);
    await expect(msg.locator('.cm-msg-drop')).toHaveAttribute('aria-label', "retirer ce message d'ici");
    // « × » : la question sous le message, dans la liste (plus de confirm() natif)
    const q = H.accepterConfirmation(page);
    await msg.locator('.cm-msg-drop').click();
    expect(await q).toBe("retirer ce message d'ici ? il ne sera pas renvoyé.");
    await expect(ligne.locator('.cm-msg-pending')).toHaveCount(0);
  });
});
