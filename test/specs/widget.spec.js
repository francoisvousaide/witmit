// Suite commune : les mêmes vérifications rejouées sur 2 maquettes TellUs + 1 page générique (Kiosque).
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const PAGES = [
  {
    name: 'TellUs — Accueil', file: 'tellus-accueil.html', key: 'witmit_tellus_v1', hasFab: false,
    pinTarget: '.mcard.active .mcard-title', textTarget: '.mcard.active .mcard-desc', boxTarget: '.mcard.active',
    blockedButton: 'a.nav-brand',
  },
  {
    name: 'TellUs — Proposer (formulaire à étapes)', file: 'tellus-proposer.html', key: 'witmit_tellus_v1', hasFab: false,
    pinTarget: '#stepPanel1 .fcard-title', textTarget: '#stepPanel1 .field-hint', boxTarget: '#stepPanel1 .fcard',
    blockedButton: '#btnNext',
  },
  {
    name: 'Kiosque — page générique', file: 'generic-dashboard.html', key: 'witmit_kiosque_v1', hasFab: true,
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
      for (const id of ['cmStyles', 'cmFrame', 'cmPill', 'cmPanel', 'cmStatus', 'cmToggleBtn', 'cmPanelBtn', 'cmCount', 'cmNewBtn']) {
        await expect(page.locator('#' + id), id).toHaveCount(1);
      }
      await expect(page.locator('.cm-fab')).toHaveCount(P.hasFab ? 1 : 0);
      await expect(page.locator('#cmToggleBtn')).toBeVisible();
    });

    test('2. bouton du mode : active/désactive (halo + bandeau)', async ({ page }) => {
      await expect(page.locator('#cmFrame')).not.toHaveClass(/show/);
      await H.activate(page);
      await expect(page.locator('#cmFrame')).toHaveClass(/show/);
      await expect(page.locator('#cmPill')).toBeVisible();
      await expect(page.locator('#cmToggleBtn')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#cmPanelBtn')).toHaveAttribute('aria-expanded', 'false');
      await H.deactivate(page);
      await expect(page.locator('#cmFrame')).not.toHaveClass(/show/);
      await expect(page.locator('#cmPill')).toBeHidden();
    });

    test('3. raccourci clavier propre à la plateforme', async ({ page }) => {
      await page.keyboard.press(H.ANNOTER);
      await expect(page.locator('body')).toHaveClass(/cm-active/);
      await page.keyboard.press(H.ANNOTER);
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
      await expect(page.locator('#cmPanelSub')).toContainText('1 à suivre');          // le nombre « à suivre » (Léa 2.1)
      await expect(page.locator('#cmCount')).toHaveAttribute('data-zero', '1');       // voyant : ton propre retour n'est pas du nouveau (C5)
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
      // Ancrage F6 (fiche Reperes) : bord droit de l'épingle aligné sur le cadre de l'élément (16 px de marge),
      // bord bas 22 px au-dessus de l'élément (6 px au-dessus du cadre), ou 22 px sous lui faute de place en haut.
      const ancrage = async () => {
        const cible = await page.locator(P.pinTarget).first().boundingBox();
        const el = await page.locator('.cm-box-outline').boundingBox();   // boîte de l'élément visé
        const pin = await page.locator('.cm-pin').boundingBox();
        const dessous = await page.locator('.cm-pin').evaluate((e) => e.classList.contains('wm-dessous'));
        return {
          droite: Math.abs((pin.x + pin.width) - (el.x + el.width + 16)),
          bas: dessous ? Math.abs(pin.y - (el.y + el.height + 22)) : Math.abs((pin.y + pin.height) - (el.y - 22)),
          surLaCible: Math.abs((el.x + el.width) - (cible.x + cible.width)) < 30 && Math.abs(el.y - cible.y) < 30,
          hauteur: pin.height
        };
      };
      const avant = await ancrage();
      await page.setViewportSize({ width: 820, height: 700 });
      await page.waitForTimeout(400); // le recalcul est différé de 150 ms
      const apres = await ancrage();
      for (const a of [avant, apres]) {
        expect(a.droite).toBeLessThan(2);
        expect(a.bas).toBeLessThan(2);
        expect(a.surLaCible).toBe(true);
        expect(a.hauteur).toBe(24);
      }
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
      await expect(page.locator('#cmPanelSub')).toContainText('2 à suivre');
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
      await expect(page.locator('.cm-popup')).toHaveCount(0);                // pas de bulle…
      await expect(page.locator('.cm-panel-item textarea')).toHaveValue('Retrouve-moi'); // …on modifie dans la liste
      await expect(page.locator('.cm-box-outline')).toHaveClass(/cm-focus/);   // cadre et pastille en couleur active
      await expect(page.locator('.cm-pin')).toHaveClass(/cm-focus/);
      await expect(page.locator('.cm-panel-item')).toHaveClass(/cm-current/);  // l'item est marqué dans la liste
      await page.locator('.cm-panel-item textarea').fill('Modifié depuis la liste');
      await page.locator('.cm-panel-item textarea').press('Enter');
      await expect(page.locator('.cm-panel-item .txt')).toHaveText('Modifié depuis la liste');
      expect((await H.stored(page, P.key))[0].text).toBe('Modifié depuis la liste');
      await expect(page.locator('.cm-pin')).toHaveClass(/cm-focus/);           // toujours sélectionné
      await page.locator('#cmPanel .cm-panel-head-row button[aria-label="fermer"]').click();      // fermer le tiroir → fin de sélection
      await expect(page.locator('.cm-pin')).not.toHaveClass(/cm-focus/);
      await page.locator('#cmPanelBtn').click();
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
      await expect(page.locator('.cm-pin').nth(0)).not.toHaveClass(/cm-focus/, { timeout: 3000 });
      // fermer une bulle par Échap ou Annuler : retour à l'orange immédiat (pas d'effet, réservé à l'enregistrement)
      await page.locator('#cmPanel .cm-panel-head-row button[aria-label="fermer"]').click();
      await page.locator('.cm-pin').nth(0).click();
      await page.keyboard.press('Escape');
      await expect(page.locator('.cm-pin').nth(0)).not.toHaveClass(/cm-focus/);
      await page.locator('.cm-pin').nth(0).click();
      await page.locator('.cm-popup .cm-cancel').click();
      await expect(page.locator('.cm-pin').nth(0)).not.toHaveClass(/cm-focus/);
      // …alors qu'Enregistrer sur un commentaire existant le déclenche
      await page.locator('.cm-pin').nth(0).click();
      await page.locator('.cm-popup textarea').press('Enter');
      await expect(page.locator('.cm-pin').nth(0)).toHaveClass(/cm-focus/);
      await expect(page.locator('.cm-pin').nth(0)).not.toHaveClass(/cm-focus/, { timeout: 3000 });
    });

    test('11b. ouvrir le tiroir abandonne une bulle non enregistrée (après confirmation)', async ({ page }) => {
      await H.activate(page);
      const box = await H.visibleBox(page, P.pinTarget);
      await page.mouse.click(box.x + 5, box.y + 5);
      await page.locator('.cm-popup textarea').fill('pas enregistré');
      // Le texte n'est pas parti : le bouton witmit demande d'abord (Léa 3.9) ; refuser ne change rien.
      const messages = [];
      page.once('dialog', (d) => { messages.push(d.message()); d.dismiss(); });
      await page.locator('#cmPanelBtn').click();
      await expect(page.locator('.cm-popup textarea')).toHaveValue('pas enregistré');
      await expect(page.locator('#cmPanel')).not.toHaveClass(/show/);
      page.once('dialog', (d) => { messages.push(d.message()); d.accept(); });
      await page.locator('#cmPanelBtn').click();
      expect(messages).toEqual(["fermer quand même ? ce que tu viens d'écrire n'est pas parti et sera perdu.", "fermer quand même ? ce que tu viens d'écrire n'est pas parti et sera perdu."]);
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
      const pos = await page.evaluate(() => JSON.parse(localStorage.getItem('witmit_pill_pos')));
      expect(pos.left).toBeCloseTo(after.x, 0);
      await expect(page.locator('.cm-popup')).toHaveCount(0); // le glisser de la pastille ne crée pas de commentaire
    });

    test('14. Copier : rapport Markdown avec en-tête projet, identifiant et numérotation', async ({ page }) => {
      await H.activate(page);
      await H.addPin(page, P.pinTarget, 'Retour A');
      await H.addPin(page, P.boxTarget, 'Retour B');
      await H.deactivate(page);
      await page.locator('#cmPanelBtn').click();
      page.once('dialog', (d) => d.dismiss()); // « Annuler » = rapport sans marquer les tickets
      await page.locator('.cm-panel-foot button', { hasText: 'Copier' }).click();
      await expect(page.locator('#cmStatus')).toContainText('copié');
      const txt = await page.evaluate(() => navigator.clipboard.readText());
      const project = P.key.replace('witmit_', '').replace('_v1', '');
      expect(txt.split('\n')[0]).toMatch(new RegExp('^# ' + project + ' — Rapport de retours R-\\d{4}-\\d{2}-\\d{2}-\\d+$'));
      expect(txt).toContain('### #1 · ');
      expect(txt).toContain('### #2 · ');
      expect(txt).toContain('Retour A');
      expect(txt).toContain('Retour B');
      expect(txt).toContain('```json');
      expect(txt).toContain('witmit-retour R-');
      expect((await H.stored(page, P.key)).every((c) => c.status === 'nouveau')).toBe(true); // non marqués
    });

    test('15. Effacer (page) puis Vider tout (site) avec confirmation', async ({ page }) => {
      await H.activate(page);
      await H.addPin(page, P.pinTarget, 'À effacer');
      await H.deactivate(page);
      await page.locator('#cmPanelBtn').click();
      const question = H.accepterConfirmation(page);                       // « effacer (page) » demande confirmation (Léa 3.9)
      await page.locator('.cm-panel-foot button', { hasText: 'effacer (page)' }).click();
      expect(await question).toBe("effacer le retour de cette page ? c'est définitif.");
      await expect(page.locator('.cm-pin')).toHaveCount(0);
      expect(await H.stored(page, P.key)).toHaveLength(0);
      // Vider tout : refuser la confirmation ne supprime rien
      await page.evaluate((k) => localStorage.setItem(k, JSON.stringify([{ id: 'x', type: 'pin', page: 'autre.html', zone: 'z', text: 't', date: '' }])), P.key);
      await page.reload();
      await page.locator('#cmPanelBtn').click();
      page.once('dialog', (d) => d.dismiss());
      await page.locator('.cm-panel-foot button', { hasText: 'vider tout' }).click();
      expect(await H.stored(page, P.key)).toHaveLength(1);
      const q2 = H.accepterConfirmation(page);
      await page.locator('.cm-panel-foot button', { hasText: 'vider tout' }).click();
      expect(await q2).toBe("effacer le retour du site ? c'est définitif.");
      await expect(page.locator('#cmStatus')).toContainText('tous les retours du site sont effacés.');
      expect(await H.stored(page, P.key)).toHaveLength(0);
    });

    test('16. couleurs : épingle, verre et encre aux jetons de witmit, que la page ait ses variables CSS ou non', async ({ page }) => {
      // Jetons de la charte V2 (design system, tokens.json) : le verre prend le thème du site.
      const JETONS = {
        'client-sombre': { verre: 'rgba(27, 27, 27, 0.7)', encre: 'rgb(255, 255, 255)', repere: 'rgb(244, 244, 244)' },
        'client-clair': { verre: 'rgba(250, 250, 250, 0.72)', encre: 'rgb(20, 20, 20)', repere: 'rgb(20, 20, 20)' }
      };
      await H.activate(page);
      await H.addPin(page, P.pinTarget, 'Couleur');
      await page.waitForTimeout(1800); // laisse passer l'effet « vient d'être commenté »
      // Épingle (fiches Epingle et Reperes) : face en verre des fenêtres choisie d'après le fond derrière elle,
      // titane clair et chiffre encre sur fond clair, titane sombre et chiffre clair sur fond sombre.
      const pin = await page.locator('.cm-pin').evaluate((el) => ({ fond: getComputedStyle(el).backgroundColor, chiffre: getComputedStyle(el).color, sombre: el.classList.contains('wm-sur-sombre') }));
      expect(pin.fond).toBe(pin.sombre ? JETONS['client-sombre'].verre : JETONS['client-clair'].verre);
      expect(pin.chiffre).toBe(pin.sombre ? JETONS['client-sombre'].repere : JETONS['client-clair'].repere);
      const t = await page.getAttribute('body', 'data-wm-theme');
      expect(Object.keys(JETONS)).toContain(t);
      await page.locator('.cm-pin').click();
      const popupBg = await page.locator('.cm-popup .wm-verre').evaluate((el) => getComputedStyle(el).backgroundColor); // couche de verre (F2)
      expect(popupBg).toBe(JETONS[t].verre);
      const popupText = await page.locator('.cm-popup textarea').evaluate((el) => getComputedStyle(el).color);
      expect(popupText).toBe(JETONS[t].encre);
    });
  });
}
