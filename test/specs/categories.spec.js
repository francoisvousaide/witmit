// Étape 2 : catégorie par mots-clés (locale) + bloc technique par ticket.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');
const KEY = 'witmit_kiosque_v1';

const CASES = [
  ['Le bouton déborde du cadre sur mobile', 'bug-visuel'],
  ['Le texte est coupé et mal aligné', 'bug-visuel'],
  ['Quand je valide, rien ne se passe', 'bug-fonctionnel'],
  ['Erreur 500 à l’enregistrement', 'bug-fonctionnel'],
  ['Impossible de fermer la fenêtre', 'bug-fonctionnel'],
  ['Le titre est trop petit, agrandir la police', 'ajustement'],
  ['Plus de marge entre les cartes', 'ajustement'],
  ['Faute d’orthographe : « acceuil »', 'texte'],
  ['Remplacer par « Valider ma commande »', 'texte'],
  ['Le clic devrait ouvrir la fiche au lieu de la liste', 'comportement'],
  ['Trier par date par défaut', 'comportement'],
  ['Il faudrait un bouton pour exporter', 'suggestion'],
  ['On pourrait ajouter un filtre par client', 'suggestion'],
  ['À quoi sert ce chiffre ?', 'question'],
  ['Pourquoi ce statut est en rouge ?', 'question'],
  ['Pourquoi le bouton déborde ?', 'bug-visuel'],          // un « ? » ne l’emporte pas sur un mot de bug
  ['Ne se met pas à jour après validation', 'bug-fonctionnel'],
  ['Le total n’apparaît pas', 'bug-fonctionnel'],
  ['Le titre n’est pas aligné avec l’icône', 'ajustement'],
  ['RAS ici', 'a-classer'],
  ['', 'a-classer'],
];

test('catégorisation par mots-clés : phrases types', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  for (const [phrase, expected] of CASES) {
    const got = await page.evaluate((t) => window.cmCategorize(t), phrase);
    expect(got, phrase).toBe(expected);
  }
});

test.describe('Bulle et stockage (Kiosque)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await H.clearStorage(page); await page.reload();
    await H.activate(page);
  });

  // Catégories en touches dépliées dans la fenêtre (I4, fiche Fenetre) : sélecteur fermé en touche pleine largeur,
  // ouvert, huit touches avec aria-pressed ; souris, flèches, Entrée et Échap.
  test('la catégorie suit la frappe, se choisit en touches (souris et clavier), et persiste', async ({ page }) => {
    const b = await H.visibleBox(page, '.kpi-tile:nth-child(1) .kpi-value');
    await page.mouse.click(b.x + 5, b.y + 5);
    const ta = page.locator('.cm-popup textarea');
    const sel = page.locator('.cm-popup .cm-cat');
    const auto = page.locator('.cm-popup .cm-cat-auto');
    const liste = page.locator('.cm-popup .cm-cat-liste');
    const choix = (k) => page.locator(`.cm-popup .cm-cat-choix[data-cat="${k}"]`);
    await expect(sel).toHaveAttribute('data-cat', 'a-classer');
    await expect(sel).toHaveAttribute('aria-expanded', 'false');
    await expect(liste).toBeHidden();
    await expect(auto).toBeVisible();
    await expect(sel).toHaveAttribute('aria-label', 'catégorie : à classer, proposée automatiquement');
    await ta.pressSequentially('Le chiffre déborde de la tuile');
    await expect(sel).toHaveAttribute('data-cat', 'bug-visuel');
    await expect(sel.locator('.cm-cat-nom')).toHaveText('bug visuel');
    await ta.fill('Il faudrait un séparateur de milliers');
    await expect(sel).toHaveAttribute('data-cat', 'suggestion');
    // Ouvert : les huit catégories dans la fenêtre, la catégorie proposée enfoncée, et elle seule.
    await sel.click();
    await expect(sel).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.cm-popup .cm-cat-choix')).toHaveText(['bug visuel', 'bug fonctionnel', 'ajustement visuel', 'texte à changer',
      'changement de comportement', 'suggestion', 'question', 'à classer']);
    await expect(choix('suggestion')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.cm-popup .cm-cat-choix[aria-pressed="true"]')).toHaveCount(1);
    const dedans = await page.evaluate(() => {
      const p = document.querySelector('.cm-popup').getBoundingClientRect();
      return Array.from(document.querySelectorAll('.cm-popup .cm-cat-choix')).every((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= p.left && r.right <= p.right && r.top >= p.top && r.bottom <= p.bottom && r.height === 36;
      });
    });
    expect(dedans).toBe(true);
    // Choix à la souris : la liste se replie, « auto » disparaît, la frappe ne change plus la catégorie.
    await choix('texte').click();
    await expect(sel).toHaveAttribute('data-cat', 'texte');
    await expect(sel).toHaveAttribute('aria-expanded', 'false');
    await expect(auto).toBeHidden();
    await expect(sel).toHaveAttribute('aria-label', 'catégorie : texte à changer');
    await ta.pressSequentially(' — bug');
    await expect(sel).toHaveAttribute('data-cat', 'texte');
    // Au clavier : flèche bas ouvre sur la catégorie choisie ; flèches, début et fin pour aller ; Entrée pour choisir.
    await sel.focus();
    await page.keyboard.press('ArrowDown');
    await expect(choix('texte')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(choix('comportement')).toBeFocused();
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
    await expect(choix('ajustement')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(choix('bug-visuel')).toBeFocused();
    await page.keyboard.press('ArrowLeft');                    // en boucle : de la première à la dernière
    await expect(choix('a-classer')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(choix('question')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(sel).toHaveAttribute('data-cat', 'question');
    await expect(sel).toHaveAttribute('aria-expanded', 'false');
    await expect(sel).toBeFocused();
    // Échap dans les touches : les catégories se replient, la fenêtre reste ouverte.
    await page.keyboard.press('ArrowDown');
    await expect(choix('question')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(liste).toBeHidden();
    await expect(page.locator('.cm-popup')).toHaveCount(1);
    await expect(sel).toBeFocused();
    await ta.press('Enter');
    const data = await H.stored(page, KEY);
    expect(data[0]).toMatchObject({ category: 'question', categoryManual: true });
    await expect(page.locator('.cm-panel-item .cm-cat-chip')).toHaveCount(1);
    // Réouverture : la catégorie choisie est gardée, sans « auto », enfoncée dans la liste.
    await page.locator('.cm-pin').click();
    await expect(page.locator('.cm-popup .cm-cat')).toHaveAttribute('data-cat', 'question');
    await expect(page.locator('.cm-popup .cm-cat-auto')).toBeHidden();
    await page.locator('.cm-popup .cm-cat').click();
    await expect(choix('question')).toHaveAttribute('aria-pressed', 'true');
  });

  test('bloc technique : sélecteur, page, fenêtre, navigateur, thème, erreurs console récentes', async ({ page }) => {
    await page.evaluate(() => { console.error('boom test'); setTimeout(() => { throw new Error('kaboom'); }, 0); });
    await page.waitForTimeout(50);
    await H.addPin(page, '.kpi-tile:nth-child(2) .kpi-value', 'Ne se met pas à jour');
    const t = (await H.stored(page, KEY))[0].tech;
    expect(t.selectors).toHaveLength(1);
    expect(t.selectors[0]).toMatch(/article:nth-of-type\(2\) > div:nth-of-type\(2\)$/);
    expect(t.labels).toEqual(['37']);
    expect(t.type).toBe('clic');
    expect(t.page.file).toBe('generic-dashboard.html');
    expect(t.viewport.width).toBe(1280);
    expect(t.browser).toMatch(/Chrom|Chrome/);
    expect(t.theme).toMatch(/clair|sombre/);
    expect(t.consoleErrors.map((e) => e.message).join(' | ')).toContain('boom test');
    expect(t.consoleErrors.map((e) => e.message).join(' | ')).toContain('kaboom');
    expect(t.consoleErrors.length).toBeLessThanOrEqual(5);
    expect(JSON.stringify(t)).not.toContain('?'); // pas de paramètres d'URL
    // visible dans la liste, replié
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('.cm-panel-item .cm-cat-chip')).toHaveText('bug fonctionnel');
    await expect(page.locator('.cm-panel-item details.cm-tech pre')).toBeHidden();
    await page.locator('.cm-panel-item details.cm-tech summary').click();
    await expect(page.locator('.cm-panel-item details.cm-tech pre')).toContainText('cible : main');
    await expect(page.locator('.cm-panel-item details.cm-tech pre')).toContainText('boom test');
  });

  test('groupe et encadré : plusieurs sélecteurs / type adapté ; rapport texte avec catégorie', async ({ page }) => {
    const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
    const b = await H.visibleBox(page, '.kpi-tile:nth-child(1) .kpi-value');
    await page.mouse.click(b.x + 5, b.y + 5);
    await expect(page.locator('.cm-popup')).toBeVisible();
    const r = await H.visibleBox(page, '.kpi-tile:nth-child(3) .kpi-value');
    await page.keyboard.down(MOD); await page.mouse.click(r.x + 5, r.y + 5); await page.keyboard.up(MOD);
    await page.locator('.cm-popup textarea').fill('Même police pour ces deux chiffres');
    await page.locator('.cm-popup textarea').press('Enter');
    const row = await H.visibleBox(page, 'tbody');
    await H.drag(page, row.x - 4, row.y - 4, row.x + row.width + 4, row.y + row.height + 4);
    await page.locator('.cm-popup textarea').fill('Ce tableau est trop large');
    await page.locator('.cm-popup textarea').press('Enter');
    const data = await H.stored(page, KEY);
    expect(data[0].tech.type).toBe('groupe');
    expect(data[0].tech.selectors).toHaveLength(2);
    expect(data[0].category).toBe('ajustement');
    expect(data[1].tech.type).toBe('encadré');
    expect(data[1].tech.position.relW).toBeGreaterThan(0);
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    page.once('dialog', (d) => d.dismiss());
    await page.locator('.cm-panel-foot button', { hasText: 'Copier' }).click();
    const txt = await page.evaluate(() => navigator.clipboard.readText());
    expect(txt).toContain(' — ajustement visuel · nouveau');
    expect(txt).toContain('"categorie": "ajustement visuel"');   // Léa 3.12 : catégorie en minuscules
  });
});
