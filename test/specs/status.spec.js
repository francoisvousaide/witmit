// Étapes 3 + 4 : cycle de vie (nouveau → signalé → pris en compte / complément → résolu), verrouillage,
// rapport (nouveautés / complet, identifiant, marquage), retour collé.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');
const KEY = 'witmit_kiosque_v1';

async function setup(page) {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  await H.addPin(page, '.kpi-tile:nth-child(1) .kpi-value', 'Premier');
  await H.addPin(page, 'tbody tr:nth-child(2) td:nth-child(4)', 'Second');
  await page.waitForTimeout(1300);
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
}
async function copyReport(page, accept) {
  page.once('dialog', (d) => (accept ? d.accept() : d.dismiss()));
  await page.locator('.cm-panel-foot button', { hasText: 'Copier' }).click();
  await expect(page.locator('#cmStatus')).toContainText('copié');
  return page.evaluate(() => navigator.clipboard.readText());
}

test('marquer un seul retour : la confirmation est au singulier, « sans le marquer » (Léa 3.9, accords)', async ({ page }) => {
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  await H.addPin(page, '.kpi-tile:nth-child(1) .kpi-value', 'Seul');
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
  const confirmation = new Promise((resolve) => page.once('dialog', async (d) => { const m = d.message(); await d.dismiss(); resolve(m); }));
  await page.locator('.cm-panel-foot button', { hasText: 'copier' }).click();
  expect(await confirmation).toMatch(/^marquer 1 retour comme signalé dans le rapport R-\d{4}-\d{2}-\d{2}-\d+ \? il ne sera plus modifiable\. annuler : le rapport est créé sans le marquer\.$/);
  await expect(page.locator('#cmStatus')).toContainText('copié');
});

test.describe('Cycle de vie (Kiosque)', () => {
  test('✓ = résolu par moi : verrouillé, grisé, compteurs, persistant ; pas de retour arrière', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#cmPanelSub')).toContainText('2 à suivre');            // le nombre « à suivre » (Léa 2.1)
    await page.locator('.cm-panel-item').nth(0).locator('.st').click();
    await expect(page.locator('.cm-panel-item').nth(0)).toHaveClass(/cm-done/);
    await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-status-chip')).toHaveText('résolu par moi');
    await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-status-chip')).toHaveAttribute('title', /^résolu par moi le \d\d\/\d\d\/\d{4}$/);
    await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-verrou')).toHaveAttribute('title', 'non modifiable');
    await expect(page.locator('.cm-panel-item').nth(0).locator('button.st')).toHaveCount(0); // plus de bouton : verrouillé
    await expect(page.locator('#cmCount')).toHaveAttribute('data-zero', '1');       // voyant éteint : c'est toi qui as rangé ce retour (C5)
    await expect(page.locator('#cmPanelSub')).toHaveText('1 à suivre · 1 terminé — 2 retours sur 1 page du site');
    const data = await H.stored(page, KEY);
    expect(data[0]).toMatchObject({ status: 'resolu', resolvedBy: 'moi' });
    expect(data[0].history[0].status).toBe('resolu');
    // verrouillé : la bulle est en lecture seule, la liste ne propose pas l'édition
    await page.mouse.click(30, 600);
    await H.activate(page);
    await expect(page.locator('.cm-pin').nth(0)).toHaveClass(/cm-done/);
    await page.locator('.cm-pin').nth(0).click();
    await expect(page.locator('.cm-popup')).toHaveClass(/cm-locked/);
    await expect(page.locator('.cm-popup textarea')).toHaveCount(0);                    // lecture seule : plus de champ
    await expect(page.locator('.cm-popup .cm-texte-lu')).toHaveText(/^« (Premier|Second) »$/);
    await expect(page.locator('.cm-popup .cm-save')).toHaveCount(0);
    await expect(page.locator('.cm-popup .cm-lock-line')).toHaveText('résolu par moi · non modifiable');
    await expect(page.locator('.cm-popup .cm-cancel')).toHaveText('fermer');
    await expect(page.locator('.cm-popup .cm-delete')).toHaveCount(0);                 // une seule action, « fermer » (fiche Fenetre)
    await page.keyboard.press('Escape');
    await H.deactivate(page);
    await page.locator('#cmPanelBtn').click();
    await page.locator('.cm-panel-item').nth(0).locator('.body').click();
    await expect(page.locator('.cm-panel-item textarea')).toHaveCount(0);
    await expect(page.locator('#cmStatus')).toContainText('non modifiable');
    await page.reload();
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('.cm-panel-item').nth(0)).toHaveClass(/cm-done/);
  });

  test('rapport « nouveautés » : Markdown + JSON, identifiant, marquage signalé après confirmation, verrouillage', async ({ page }) => {
    await setup(page);
    const md = await copyReport(page, true);
    expect(md).toMatch(/^# kiosque — Rapport de retours R-\d{4}-\d{2}-\d{2}-1\n/);
    expect(md).toContain('périmètre : nouveautés');
    expect(md).toContain('## Page : Kiosque');
    expect(md).toContain('### #1 · élément : 1 240 € — à classer · nouveau');   // Léa 3.12
    expect(md).toContain('"texte": "Premier"');
    expect(md).toContain('"selecteur": "main');
    expect(md).toContain('## Pour répondre à ce rapport');
    const data = await H.stored(page, KEY);
    expect(data.every((c) => c.status === 'signale' && c.signaledAt && c.reports.length === 1)).toBe(true);
    expect(md).toContain('Identifiants de ce rapport : `' + data[0].id + '`, `' + data[1].id + '`');
    await expect(page.locator('.cm-panel-item .cm-status-chip').nth(0)).toHaveText('signalé');
    await expect(page.locator('.cm-panel-item .del')).toHaveCount(2);               // maquette : la corbeille reste, signalé compris
    await expect(page.locator('.cm-panel-item .reopen')).toHaveCount(2);
    // verrouillé : bulle en lecture seule
    await page.mouse.click(30, 600); await H.activate(page);
    await page.locator('.cm-pin').nth(0).click();
    await expect(page.locator('.cm-popup')).toHaveClass(/cm-locked/);
    await page.keyboard.press('Escape');
    // un second rapport « nouveautés » : plus rien à signaler
    await H.deactivate(page); await page.locator('#cmPanelBtn').click();
    await page.locator('.cm-panel-foot button', { hasText: 'Copier' }).click();
    await expect(page.locator('#cmStatus')).toContainText('rien de nouveau à signaler.');
    // « Rapport complet » : tout, avec les statuts
    await page.locator('#cmFullReport').check();
    const full = await copyReport(page, false);
    expect(full).toContain('R-');
    expect(full).toContain('périmètre : complet');
    expect(full).toContain('· signalé');
  });

  test('rouvrir un signalé : redevient modifiable, renvoyé avec « remplace la version du »', async ({ page }) => {
    await setup(page);
    await copyReport(page, true);
    await page.locator('.cm-panel-item').nth(0).locator('.reopen').click();
    let data = await H.stored(page, KEY);
    expect(data[0].status).toBe('nouveau');
    expect(data[0].supersedes).toBeTruthy();
    await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-status-chip')).toHaveCount(0);
    await page.locator('.cm-panel-item').nth(0).locator('.body').click();
    await expect(page.locator('.cm-panel-item textarea')).toHaveValue('Premier');
    await page.locator('.cm-panel-item textarea').fill('Premier (corrigé)');
    await page.locator('.cm-panel-item textarea').press('Enter');
    const md = await copyReport(page, true);
    expect(md).toContain('remplace la version du');
    expect(md).toContain('Premier (corrigé)');
    expect(md).not.toContain('Second'); // pas renvoyé : déjà signalé
    data = await H.stored(page, KEY);
    expect(data[0].reports).toHaveLength(2);
  });

  test('téléchargement du rapport .md', async ({ page }) => {
    await setup(page);
    page.once('dialog', (d) => d.accept());
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.cm-panel-foot button', { hasText: 'télécharger' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^witmit-kiosque-R-\d{4}-\d{2}-\d{2}-1\.md$/);
    const fs = require('fs');
    const content = fs.readFileSync(await download.path(), 'utf8');
    expect(content).toContain('# kiosque — Rapport de retours');
    await expect(page.locator('#cmStatus')).toContainText('téléchargé');
  });

  test('retour collé : pris en compte, complément (réponse, puis renvoi), résolu — et inconnus', async ({ page }) => {
    await setup(page);
    await copyReport(page, true);
    const data = await H.stored(page, KEY);
    const [a, b] = data.map((c) => c.id);
    await page.locator('.cm-panel-foot button', { hasText: 'coller un retour' }).click();
    await page.locator('#cmFeedbackBox textarea').fill([
      'witmit-retour R-2026-09-20-1',
      a + ' pris en compte',
      b + ' complement | Quelle ligne exactement ?',
      'xxx_inconnu resolu',
      'ligne sans sens',
    ].join('\n'));
    await page.locator('#cmFeedbackBox button', { hasText: 'appliquer' }).click();
    await expect(page.locator('#cmStatus')).toContainText('2 retours mis à jour · 1 identifiant inconnu · 1 ligne ignorée');
    await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-status-chip')).toHaveText('pris en compte');
    await expect(page.locator('.cm-panel-item').nth(1).locator('.cm-status-chip')).toHaveText('complément demandé');
    await expect(page.locator('.cm-panel-item').nth(1).locator('.del')).toHaveCount(1);   // maquette : corbeille sur un complément aussi
    await expect(page.locator('.cm-panel-item').nth(1).locator('.cm-feedback-q')).toContainText('Quelle ligne exactement ?');
    // répondre au complément depuis la liste
    await page.locator('.cm-panel-item').nth(1).locator('.body').click();
    await expect(page.locator('.cm-panel-item textarea.cm-inline-reply')).toBeVisible();
    await page.locator('.cm-panel-item textarea.cm-inline-reply').fill('La ligne 1042, Café des Arts');
    await page.locator('.cm-panel-item textarea.cm-inline-reply').press('Enter');
    await expect(page.locator('.cm-panel-item').nth(1).locator('.cm-reply')).toContainText('La ligne 1042');
    await expect(page.locator('.cm-panel-item').nth(1).locator('.cm-reply')).toContainText('pour le prochain rapport');
    // le prochain rapport « nouveautés » contient la réponse, puis le ticket repasse signalé
    const md = await copyReport(page, true);
    expect(md).toContain('> Réponse du');
    expect(md).toContain('La ligne 1042, Café des Arts');
    expect(md).toContain('"complement_demande": "Quelle ligne exactement ?"');
    expect(md).not.toContain('"texte": "Premier"');
    let d2 = await H.stored(page, KEY);
    expect(d2[1].status).toBe('signale');
    expect(d2[1].replies[0].sentIn).toMatch(/^R-/);
    // résolu par retour
    await page.locator('.cm-panel-foot button', { hasText: 'coller un retour' }).click();
    await page.locator('#cmFeedbackBox textarea').fill(a + ' résolu | Police unifiée\n' + b + ' resolu');
    await page.locator('#cmFeedbackBox button', { hasText: 'appliquer' }).click();
    await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-status-chip')).toHaveText('résolu');
    await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-feedback')).toContainText('Police unifiée');
    d2 = await H.stored(page, KEY);
    expect(d2[0]).toMatchObject({ status: 'resolu', resolvedBy: 'retour', feedbackMessage: 'Police unifiée' });
    expect(d2[0].history.map((h) => h.status)).toEqual(['signale', 'pris_en_compte', 'resolu']);
    await expect(page.locator('#cmPanelSub')).toContainText('0 à suivre · 2 terminés');   // plus rien à traiter
    await expect(page.locator('#cmCount')).toHaveAttribute('data-zero', '0');               // l'équipe a écrit : voyant allumé (C5)
    await expect(page.locator('.cm-panel-empty')).toHaveCount(0);
    await page.locator('.cm-hide-done').click();
    // L'équipe vient de les résoudre : ils restent affichés avec « nouveau » jusqu'à la fermeture de la liste (C5).
    await expect(page.locator('.cm-panel-item .cm-nouveau')).toHaveCount(2);
    await page.locator('#cmPanelBtn').click(); await page.locator('#cmPanelBtn').click();
    await expect(page.locator('.cm-panel-empty')).toHaveText('tous les retours de cette page sont terminés.');
  });

  test('bulle d’un complément : la réponse s’enregistre depuis la bulle', async ({ page }) => {
    await setup(page);
    await copyReport(page, true);
    const [a] = (await H.stored(page, KEY)).map((c) => c.id);
    await page.locator('.cm-panel-foot button', { hasText: 'coller un retour' }).click();
    await page.locator('#cmFeedbackBox textarea').fill(a + ' complement | Sur quel écran ?');
    await page.locator('#cmFeedbackBox button', { hasText: 'appliquer' }).click();
    await page.mouse.click(30, 600); await H.activate(page);
    await page.locator('.cm-pin').nth(0).click();
    await expect(page.locator('.cm-popup .cm-feedback-q')).toContainText('Sur quel écran ?');
    await expect(page.locator('.cm-popup textarea')).toHaveCount(1);                    // seul le champ de réponse
    await expect(page.locator('.cm-popup .cm-feedback-q')).toContainText('complément demandé :');
    await expect(page.locator('.cm-popup .cm-save')).toBeDisabled();                  // désactivée tant que la réponse est vide
    await page.locator('.cm-popup .cm-reply-ta').fill('Le tableau de bord');
    await page.locator('.cm-popup .cm-save').click();
    await expect(page.locator('.cm-popup')).toHaveCount(0);
    expect((await H.stored(page, KEY))[0].replies[0].text).toBe('Le tableau de bord');
  });

  test('anciens tickets « traité » migrés en « résolu par moi »', async ({ page }) => {
    await page.goto(H.fileUrl('generic-dashboard.html'));
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify([{ id: 'old1', type: 'pin', page: 'generic-dashboard.html', zone: 'z', text: 'ancien', date: '2026-09-01T10:00:00.000Z', status: 'traite', doneAt: '2026-09-02T10:00:00.000Z' }, { id: 'old2', type: 'pin', page: 'generic-dashboard.html', zone: 'z', text: 'ancien 2', date: '2026-09-01T10:00:00.000Z' }])), KEY);
    await page.reload();
    await page.locator('#cmPanelBtn').click();
    await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-status-chip')).toHaveText('résolu par moi');
    await expect(page.locator('.cm-panel-item').nth(1).locator('.cm-status-chip')).toHaveCount(0);
  });
});
