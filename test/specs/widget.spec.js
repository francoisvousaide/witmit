// Suite commune : les mêmes vérifications rejouées sur 2 maquettes TellUs + 1 page générique (Kiosque).
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const PAGES = [
  {
    name: 'TellUs — Accueil', file: 'tellus-accueil.html', key: 'annotate_tellus_v1', hasFab: false,
    pinTarget: '.mcard.active .mcard-title', textTarget: '.mcard.active .mcard-desc', boxTarget: '.mcard.active',
    blockedButton: 'a.nav-brand',
  },
  {
    name: 'TellUs — Proposer (formulaire à étapes)', file: 'tellus-proposer.html', key: 'annotate_tellus_v1', hasFab: false,
    pinTarget: '#stepPanel1 .fcard-title', textTarget: '#stepPanel1 .field-hint', boxTarget: '#stepPanel1 .fcard',
    blockedButton: '#btnNext',
  },
  {
    name: 'Kiosque — page générique', file: 'generic-dashboard.html', key: 'annotate_kiosque_v1', hasFab: true,
    pinTarget: 'tbody tr:first-child td:nth-child(2)', textTarget: 'tbody tr:nth-child(3) td:nth-child(2)', boxTarget: '.kpi-row',
    blockedButton: '#tabBtnForm',
  },
];

for (const P of PAGES) {
  test.describe(P.name, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(H.fileUrl(P.file));
      await H.clearStorage(page);
      await page.reload();
    });

    test('1. le widget s’installe seul : style + interface injectés, une seule fois', async ({ page }) => {
      for (const id of ['cmStyles', 'cmFrame', 'cmPill', 'cmPanel', 'cmStatus', 'cmToggleBtn', 'cmPanelBtn', 'cmCount']) {
        await expect(page.locator('#' + id), id).toHaveCount(1);
      }
      await expect(page.locator('.cm-fab')).toHaveCount(P.hasFab ? 1 : 0);
      await expect(page.locator('#cmToggleBtn')).toBeVisible();
    });

    test('2. bouton 💬 : active/désactive le mode (cadre + pastille)', async ({ page }) => {
      await expect(page.locator('#cmFrame')).not.toHaveClass(/show/);
      await H.activate(page);
      await expect(page.locator('#cmFrame')).toHaveClass(/show/);
      await expect(page.locator('#cmPill')).toBeVisible();
      await expect(page.locator('#cmToggleBtn .cm-btn-on')).toBeVisible();
      await H.deactivate(page);
      await expect(page.locator('#cmFrame')).not.toHaveClass(/show/);
      await expect(page.locator('#cmPill')).toBeHidden();
    });

    test('3. raccourci clavier propre à la plateforme', async ({ page }) => {
      await page.keyboard.press(H.SHORTCUT);
      await expect(page.locator('body')).toHaveClass(/cm-active/);
      await page.keyboard.press(H.SHORTCUT);
      await expect(page.locator('body')).not.toHaveClass(/cm-active/);
    });

    test('4. clic sur un élément → popup avec libellé de zone → pastille + stockage', async ({ page }) => {
      await H.activate(page);
      const box = await H.visibleBox(page, P.pinTarget);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      const popup = page.locator('.cm-popup');
      await expect(popup).toBeVisible();
      await expect(popup.locator('.cm-zone')).not.toBeEmpty();
      await expect(page.locator('.cm-box-editing')).toHaveCount(1); // contour de l'objet visé
      await popup.locator('textarea').fill('Premier retour');
      await popup.locator('textarea').press('Enter');
      await expect(popup).toHaveCount(0);
      await expect(page.locator('.cm-pin')).toHaveCount(1);
      const data = await H.stored(page, P.key);
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({ type: 'pin', text: 'Premier retour', page: P.file });
      expect(data[0].anchor.path).toBeTruthy();       // chemin DOM stable, pas des pixels bruts
      expect(data[0].anchor.relX).toBeGreaterThanOrEqual(0);
      expect(data[0].anchor.relX).toBeLessThanOrEqual(1);
      await expect(page.locator('#cmCount')).toHaveText('1');
    });

    test('5. Annuler / clic ailleurs → rien n’est enregistré', async ({ page }) => {
      await H.activate(page);
      const box = await H.visibleBox(page, P.pinTarget);
      await page.mouse.click(box.x + 5, box.y + 5);
      await page.locator('.cm-popup textarea').fill('brouillon');
      await page.locator('.cm-popup .cm-cancel').click();
      await expect(page.locator('.cm-popup')).toHaveCount(0);
      await expect(page.locator('.cm-pin')).toHaveCount(0);
      expect(await H.stored(page, P.key)).toHaveLength(0);
    });

    test('6. glisser → encadré d’une zone', async ({ page }) => {
      await H.activate(page);
      const b = await H.visibleBox(page, P.boxTarget);
      await H.drag(page, b.x + 10, b.y + 10, b.x + b.width - 10, b.y + Math.min(b.height - 10, 120));
      await expect(page.locator('.cm-popup')).toBeVisible();
      await page.locator('.cm-popup textarea').fill('Toute cette zone');
      await page.locator('.cm-popup textarea').press('Enter');
      await expect(page.locator('.cm-box.cm-box-saved')).toHaveCount(1);
      const data = await H.stored(page, P.key);
      expect(data[0].type).toBe('box');
      expect(data[0].anchor.relW).toBeGreaterThan(0);
    });

    test('7. Maj + glisser sur du texte → surlignage + citation', async ({ page }) => {
      await H.activate(page);
      const t = await H.visibleBox(page, P.textTarget);
      const y = t.y + Math.min(10, t.height / 2);
      await H.drag(page, t.x + 2, y, t.x + Math.min(t.width - 2, 160), y, { shift: true });
      await expect(page.locator('.cm-popup')).toBeVisible();
      await expect(page.locator('.cm-popup .cm-zone')).toContainText('«');
      await page.locator('.cm-popup textarea').fill('Ce passage');
      await page.locator('.cm-popup textarea').press('Enter');
      expect(await page.locator('mark.cm-highlight').count()).toBeGreaterThan(0);
      const data = await H.stored(page, P.key);
      expect(data[0].type).toBe('text');
      expect(data[0].zone.startsWith('«')).toBe(true);
    });

    test('8. clic sur la pastille → édition pré-remplie, puis suppression', async ({ page }) => {
      await H.activate(page);
      await H.addPin(page, P.pinTarget, 'Version initiale');
      await page.locator('.cm-pin').click();
      const ta = page.locator('.cm-popup textarea');
      await expect(ta).toHaveValue('Version initiale');
      await ta.fill('Version corrigée');
      await ta.press('Enter');
      expect((await H.stored(page, P.key))[0].text).toBe('Version corrigée');
      await page.locator('.cm-pin').click();
      await page.locator('.cm-popup .cm-delete').click();
      await expect(page.locator('.cm-pin')).toHaveCount(0);
      expect(await H.stored(page, P.key)).toHaveLength(0);
    });

    test('9. la pastille reste accrochée à son élément après redimensionnement', async ({ page }) => {
      await H.activate(page);
      await H.addPin(page, P.pinTarget, 'Ancrage');
      const before = await page.locator(P.pinTarget).first().boundingBox();
      const pinBefore = await page.locator('.cm-pin').boundingBox();
      await page.setViewportSize({ width: 820, height: 700 });
      await page.waitForTimeout(400); // le recalcul est différé de 150 ms
      const after = await page.locator(P.pinTarget).first().boundingBox();
      const pinAfter = await page.locator('.cm-pin').boundingBox();
      // Point d'ancrage = coin haut-droit de l'élément visé, avant comme après.
      const dxBefore = Math.abs((pinBefore.x + pinBefore.width / 2) - (before.x + before.width));
      const dxAfter = Math.abs((pinAfter.x + pinAfter.width / 2) - (after.x + after.width));
      expect(dxBefore).toBeLessThan(30);
      expect(dxAfter).toBeLessThan(30);
      expect(Math.abs(pinAfter.y - after.y)).toBeLessThan(30);
    });

    test('10. les commentaires survivent au rechargement de la page (pastille, contour, surlignage)', async ({ page }) => {
      await H.activate(page);
      await H.addPin(page, P.pinTarget, 'Persistant');
      const t = await H.visibleBox(page, P.textTarget);
      const y = t.y + Math.min(10, t.height / 2);
      await H.drag(page, t.x + 2, y, t.x + Math.min(t.width - 2, 160), y, { shift: true });
      await page.locator('.cm-popup textarea').fill('Texte persistant');
      await page.locator('.cm-popup textarea').press('Enter');
      const quoteBefore = await page.locator('mark.cm-highlight').allInnerTexts();
      await page.reload();
      await expect(page.locator('#cmCount')).toHaveText('2');
      await H.activate(page);
      await expect(page.locator('.cm-pin')).toHaveCount(2);
      await expect(page.locator('.cm-box-outline')).toHaveCount(1);      // contour de la pastille
      await expect(page.locator('mark.cm-highlight').first()).toBeVisible(); // surlignage retrouvé
      expect((await page.locator('mark.cm-highlight').allInnerTexts()).join('').trim()).toBe(quoteBefore.join('').trim());
    });

    test('10b. hors mode annotation, les repères sont masqués ; ils réapparaissent à l’activation', async ({ page }) => {
      await H.activate(page);
      await H.addPin(page, P.pinTarget, 'Discret');
      await expect(page.locator('.cm-pin')).toBeVisible();
      await expect(page.locator('.cm-box-outline')).toBeVisible();
      await H.deactivate(page);
      await expect(page.locator('.cm-pin')).toBeHidden();
      await expect(page.locator('.cm-box-outline')).toBeHidden();
      await H.activate(page);
      await expect(page.locator('.cm-pin')).toBeVisible();
    });

    test('10c. clic sur un commentaire de la liste → mode activé, repère mis en évidence', async ({ page }) => {
      await H.activate(page);
      await H.addPin(page, P.pinTarget, 'Retrouve-moi');
      await H.deactivate(page);
      await page.locator('#cmPanelBtn').click();
      await page.locator('.cm-panel-item .body').click();
      await expect(page.locator('body')).toHaveClass(/cm-active/);
      await expect(page.locator('#cmPanel')).toHaveClass(/show/); // le bloc reste ouvert
      await expect(page.locator('.cm-pin')).toBeVisible();
      await expect(page.locator('.cm-box-outline')).toHaveClass(/cm-ola/); // onde sur le cadre
      await expect(page.locator('.cm-popup textarea')).toHaveValue('Retrouve-moi'); // et la bulle s'ouvre
      await expect(page.locator('.cm-box-outline')).toHaveClass(/cm-focus/);   // cadre et pastille changent de couleur…
      await expect(page.locator('.cm-pin')).toHaveClass(/cm-focus/);
      await expect(page.locator('.cm-panel-item')).toHaveClass(/cm-current/);  // l'item est marqué dans la liste
      await page.keyboard.press('Escape');
      await expect(page.locator('.cm-panel-item')).not.toHaveClass(/cm-current/);
      await expect(page.locator('.cm-pin')).not.toHaveClass(/cm-focus/);       // …jusqu'à la fermeture de la bulle
      await page.mouse.click(30, 400); // clic en dehors → le bloc se referme…
      await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
      await page.waitForTimeout(400);
      await expect(page.locator('.cm-popup')).toHaveCount(0); // …et ne crée rien (mode actif pourtant)
    });

    test('11. panneau : ouverture, liste, fermeture par clic extérieur, suppression ✕', async ({ page }) => {
      await H.activate(page);
      await H.addPin(page, P.pinTarget, 'Dans la liste');
      await H.deactivate(page);
      await page.locator('#cmPanelBtn').click();
      await expect(page.locator('#cmPanel')).toHaveClass(/show/);
      await expect(page.locator('.cm-panel-item')).toHaveCount(1);
      await expect(page.locator('.cm-panel-item .txt')).toHaveText('Dans la liste');
      await expect(page.locator('#cmPanelCount')).toHaveText('1');
      await page.mouse.click(30, 400);
      await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
      await page.locator('#cmPanelBtn').click();
      await page.locator('.cm-panel-item .del').click();
      await expect(page.locator('.cm-panel-item')).toHaveCount(0);
      await expect(page.locator('.cm-pin')).toHaveCount(0);
    });

    test('10d. passer d’un commentaire à l’autre garde la couleur active à jour ; après enregistrement, teal puis orange', async ({ page }) => {
      await H.activate(page);
      await H.addPin(page, P.pinTarget, 'Premier');
      // juste après l'enregistrement : encore en teal, puis retour à l'orange
      await expect(page.locator('.cm-pin').first()).toHaveClass(/cm-focus/);
      await expect(page.locator('.cm-pin').first()).not.toHaveClass(/cm-focus/, { timeout: 3000 });
      await H.addPin(page, P.boxTarget, 'Second');
      await page.waitForTimeout(1200);
      // clic sur une pastille alors qu'une bulle est déjà ouverte → la nouvelle prend la couleur
      const pins = page.locator('.cm-pin');
      await pins.nth(0).click();
      await expect(pins.nth(0)).toHaveClass(/cm-focus/);
      await pins.nth(1).click();
      await expect(pins.nth(1)).toHaveClass(/cm-focus/);
      await expect(pins.nth(0)).not.toHaveClass(/cm-focus/);
      // depuis la liste, en changeant d'item
      await page.keyboard.press('Escape');
      await H.deactivate(page);
      await page.locator('#cmPanelBtn').click();
      await page.locator('.cm-panel-item .body').nth(0).click();
      await expect(page.locator('.cm-panel-item').nth(0)).toHaveClass(/cm-current/);
      await page.locator('.cm-panel-item .body').nth(1).click();
      await expect(page.locator('.cm-panel-item').nth(1)).toHaveClass(/cm-current/);
      await expect(page.locator('.cm-panel-item').nth(0)).not.toHaveClass(/cm-current/);
      await expect(page.locator('.cm-pin').nth(1)).toHaveClass(/cm-focus/);
      await expect(page.locator('.cm-pin').nth(0)).not.toHaveClass(/cm-focus/);
    });

    test('11b. ouvrir le tiroir abandonne une bulle non enregistrée', async ({ page }) => {
      await H.activate(page);
      const box = await H.visibleBox(page, P.pinTarget);
      await page.mouse.click(box.x + 5, box.y + 5);
      await page.locator('.cm-popup textarea').fill('pas enregistré');
      await page.locator('#cmPanelBtn').click();
      await expect(page.locator('#cmPanel')).toHaveClass(/show/);
      await expect(page.locator('.cm-popup')).toHaveCount(0);
      await expect(page.locator('.cm-box-editing')).toHaveCount(0);
      expect(await H.stored(page, P.key)).toHaveLength(0);
      // même chose si le clic simple est encore en attente (moins de 250 ms)
      await page.mouse.click(30, 400); // referme le tiroir
      await page.mouse.click(box.x + 5, box.y + 5);
      await page.locator('#cmPanelBtn').click();
      await page.waitForTimeout(400);
      await expect(page.locator('.cm-popup')).toHaveCount(0);
      await expect(page.locator('#cmPanel')).toHaveClass(/show/);
    });

    test('12. en mode annotation, un clic sur un bouton de la page ne déclenche pas son action', async ({ page }) => {
      await H.activate(page);
      const btn = page.locator(P.blockedButton);
      const urlBefore = page.url();
      const b = await H.visibleBox(page, P.blockedButton);
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await expect(page.locator('.cm-popup')).toBeVisible();
      await expect(page.locator('.cm-popup .cm-zone')).toContainText((await btn.innerText()).trim().split('\n')[0].slice(0, 8));
      await expect(page.locator('body')).toHaveClass(/cm-active/);
      expect(page.url()).toBe(urlBefore); // un lien href="#" n'a pas navigué
    });

    test('13. pastille d’état déplaçable, position mémorisée', async ({ page }) => {
      await H.activate(page);
      const pill = page.locator('#cmPill');
      const before = await pill.boundingBox();
      const handle = await pill.locator('.cm-drag-handle').boundingBox();
      await H.drag(page, handle.x + 3, handle.y + 3, handle.x + 3 - 200, handle.y + 3 + 150);
      const after = await pill.boundingBox();
      expect(after.x).toBeLessThan(before.x - 100);
      expect(after.y).toBeGreaterThan(before.y + 100);
      const pos = await page.evaluate(() => JSON.parse(localStorage.getItem('annotate_pill_pos')));
      expect(pos.left).toBeCloseTo(after.x, 0);
      await expect(page.locator('.cm-popup')).toHaveCount(0); // le glisser de la pastille ne crée pas de commentaire
    });

    test('14. Copier : rapport texte avec en-tête projet et numérotation', async ({ page }) => {
      await H.activate(page);
      await H.addPin(page, P.pinTarget, 'Retour A');
      await H.addPin(page, P.boxTarget, 'Retour B');
      await H.deactivate(page);
      await page.locator('#cmPanelBtn').click();
      await page.locator('.cm-panel-foot button', { hasText: 'Copier' }).click();
      await expect(page.locator('#cmStatus')).toContainText('Copié');
      const txt = await page.evaluate(() => navigator.clipboard.readText());
      expect(txt.split('\n')[0]).toBe(P.key.replace('annotate_', '').replace('_v1', '') + ' — Rapport de commentaires (site)');
      expect(txt).toContain('#1 [');
      expect(txt).toContain('#2 [');
      expect(txt).toContain('Retour A');
      expect(txt).toContain('Retour B');
    });

    test('15. Effacer (page) puis Vider tout (site) avec confirmation', async ({ page }) => {
      await H.activate(page);
      await H.addPin(page, P.pinTarget, 'À effacer');
      await H.deactivate(page);
      await page.locator('#cmPanelBtn').click();
      await page.locator('.cm-panel-foot button', { hasText: 'Effacer (page)' }).click();
      await expect(page.locator('.cm-pin')).toHaveCount(0);
      expect(await H.stored(page, P.key)).toHaveLength(0);
      // Vider tout : refuser la confirmation ne supprime rien
      await page.evaluate((k) => localStorage.setItem(k, JSON.stringify([{ id: 'x', type: 'pin', page: 'autre.html', zone: 'z', text: 't', date: '' }])), P.key);
      await page.reload();
      await page.locator('#cmPanelBtn').click();
      page.once('dialog', (d) => d.dismiss());
      await page.locator('.cm-panel-foot button', { hasText: 'Vider tout' }).click();
      expect(await H.stored(page, P.key)).toHaveLength(1);
      page.once('dialog', (d) => d.accept());
      await page.locator('.cm-panel-foot button', { hasText: 'Vider tout' }).click();
      await expect(page.locator('#cmStatus')).toContainText('supprimés');
      expect(await H.stored(page, P.key)).toHaveLength(0);
    });

    test('16. couleurs : la pastille est orange même sans variables CSS TellUs', async ({ page }) => {
      await H.activate(page);
      await H.addPin(page, P.pinTarget, 'Couleur');
      const pinBg = await page.locator('.cm-pin').evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(pinBg).toBe('rgb(252, 128, 5)');
      await page.locator('.cm-pin').click();
      const popupBg = await page.locator('.cm-popup').evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(popupBg).toBe('rgb(255, 255, 255)');
      const popupText = await page.locator('.cm-popup textarea').evaluate((el) => getComputedStyle(el).color);
      expect(popupText).toBe('rgb(26, 25, 23)');
    });
  });
}
