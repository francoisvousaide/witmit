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

test.describe('Cycle de vie (Kiosque)', () => {
  test('✓ = résolu par moi : verrouillé, grisé, compteurs, persistant ; pas de retour arrière', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#cmCount')).toHaveText('2');
    await page.locator('.cm-panel-item').nth(0).locator('.st').click();
    await expect(page.locator('.cm-panel-item').nth(0)).toHaveClass(/cm-done/);
    await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-status-chip')).toContainText('Résolu le');
    await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-status-chip')).toContainText('(par moi)');
    await expect(page.locator('.cm-panel-item').nth(0).locator('button.st')).toHaveCount(0); // plus de bouton : verrouillé
    await expect(page.locator('#cmCount')).toHaveText('1');
    await expect(page.locator('#cmPanelSub')).toContainText('1 restant(s) · 1 résolu(s)');
    const data = await H.stored(page, KEY);
    expect(data[0]).toMatchObject({ status: 'resolu', resolvedBy: 'moi' });
    expect(data[0].history[0].status).toBe('resolu');
    // verrouillé : la bulle est en lecture seule, la liste ne propose pas l'édition
    await page.mouse.click(30, 600);
    await H.activate(page);
    await expect(page.locator('.cm-pin').nth(0)).toHaveClass(/cm-done/);
    await page.locator('.cm-pin').nth(0).click();
    await expect(page.locator('.cm-popup')).toHaveClass(/cm-locked/);
    await expect(page.locator('.cm-popup textarea')).toHaveAttribute('readonly', '');
    await expect(page.locator('.cm-popup .cm-save')).toHaveCount(0);
    await expect(page.locator('.cm-popup .cm-lock-line')).toContainText('non modifiable');
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
    expect(md).toContain('### #1 · 📍 1 240 € — À classer · nouveau');
    expect(md).toContain('"texte": "Premier"');
    expect(md).toContain('"selecteur": "main');
    expect(md).toContain('## Pour répondre à ce rapport');
    const data = await H.stored(page, KEY);
    expect(data.every((c) => c.status === 'signale' && c.signaledAt && c.reports.length === 1)).toBe(true);
    expect(md).toContain('Identifiants de ce rapport : `' + data[0].id + '`, `' + data[1].id + '`');
    await expect(page.locator('.cm-panel-item .cm-status-chip').nth(0)).toContainText('Signalé le');
    await expect(page.locator('.cm-panel-item .reopen')).toHaveCount(2);
    // verrouillé : bulle en lecture seule
    await page.mouse.click(30, 600); await H.activate(page);
    await page.locator('.cm-pin').nth(0).click();
    await expect(page.locator('.cm-popup')).toHaveClass(/cm-locked/);
    await page.keyboard.press('Escape');
    // un second rapport « nouveautés » : plus rien à signaler
    await H.deactivate(page); await page.locator('#cmPanelBtn').click();
    await page.locator('.cm-panel-foot button', { hasText: 'Copier' }).click();
    await expect(page.locator('#cmStatus')).toContainText('Rien de nouveau');
    // « Rapport complet » : tout, avec les statuts
    await page.locator('#cmFullReport').check();
    const full = await copyReport(page, false);
    expect(full).toContain('R-');
    expect(full).toContain('périmètre : complet');
    expect(full).toContain('· Signalé le');
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
      page.locator('.cm-panel-foot button', { hasText: 'Télécharger' }).click(),
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
    await page.locator('.cm-panel-foot button', { hasText: 'Coller un retour' }).click();
    await page.locator('#cmFeedbackBox textarea').fill([
      'witmit-retour R-2026-09-20-1',
      a + ' pris en compte',
      b + ' complement | Quelle ligne exactement ?',
      'xxx_inconnu resolu',
      'ligne sans sens',
    ].join('\n'));
    await page.locator('#cmFeedbackBox button', { hasText: 'Appliquer' }).click();
    await expect(page.locator('#cmStatus')).toContainText('2 ticket(s) mis à jour · 1 identifiant(s) inconnu(s) · 1 ligne(s) ignorée(s)');
    await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-status-chip')).toContainText('Pris en compte');
    await expect(page.locator('.cm-panel-item').nth(1).locator('.cm-status-chip')).toContainText('Complément demandé');
    await expect(page.locator('.cm-panel-item').nth(1).locator('.cm-feedback-q')).toContainText('Quelle ligne exactement ?');
    // répondre au complément depuis la liste
    await page.locator('.cm-panel-item').nth(1).locator('.body').click();
    await expect(page.locator('.cm-panel-item textarea.cm-inline-reply')).toBeVisible();
    await page.locator('.cm-panel-item textarea.cm-inline-reply').fill('La ligne 1042, Café des Arts');
    await page.locator('.cm-panel-item textarea.cm-inline-reply').press('Enter');
    await expect(page.locator('.cm-panel-item').nth(1).locator('.cm-reply')).toContainText('La ligne 1042');
    await expect(page.locator('.cm-panel-item').nth(1).locator('.cm-reply')).toContainText('à envoyer');
    // le prochain rapport « nouveautés » contient la réponse, puis le ticket repasse signalé
    const md = await copyReport(page, true);
    expect(md).toContain('↳ Réponse du');
    expect(md).toContain('La ligne 1042, Café des Arts');
    expect(md).toContain('"complement_demande": "Quelle ligne exactement ?"');
    expect(md).not.toContain('"texte": "Premier"');
    let d2 = await H.stored(page, KEY);
    expect(d2[1].status).toBe('signale');
    expect(d2[1].replies[0].sentIn).toMatch(/^R-/);
    // résolu par retour
    await page.locator('.cm-panel-foot button', { hasText: 'Coller un retour' }).click();
    await page.locator('#cmFeedbackBox textarea').fill(a + ' résolu | Police unifiée\n' + b + ' resolu');
    await page.locator('#cmFeedbackBox button', { hasText: 'Appliquer' }).click();
    await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-status-chip')).toContainText('Résolu le');
    await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-feedback')).toContainText('Police unifiée');
    d2 = await H.stored(page, KEY);
    expect(d2[0]).toMatchObject({ status: 'resolu', resolvedBy: 'retour', feedbackMessage: 'Police unifiée' });
    expect(d2[0].history.map((h) => h.status)).toEqual(['signale', 'pris_en_compte', 'resolu']);
    await expect(page.locator('#cmCount')).toHaveAttribute('data-zero', '1'); // plus rien à traiter
    await expect(page.locator('.cm-panel-empty')).toHaveCount(0);
    await page.locator('.cm-hide-done').click();
    await expect(page.locator('.cm-panel-empty')).toContainText('Tout est résolu');
  });

  test('bulle d’un complément : la réponse s’enregistre depuis la bulle', async ({ page }) => {
    await setup(page);
    await copyReport(page, true);
    const [a] = (await H.stored(page, KEY)).map((c) => c.id);
    await page.locator('.cm-panel-foot button', { hasText: 'Coller un retour' }).click();
    await page.locator('#cmFeedbackBox textarea').fill(a + ' complement | Sur quel écran ?');
    await page.locator('#cmFeedbackBox button', { hasText: 'Appliquer' }).click();
    await page.mouse.click(30, 600); await H.activate(page);
    await page.locator('.cm-pin').nth(0).click();
    await expect(page.locator('.cm-popup .cm-feedback-q')).toContainText('Sur quel écran ?');
    await expect(page.locator('.cm-popup textarea').first()).toHaveAttribute('readonly', '');
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
    await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-status-chip')).toContainText('Résolu le 02/09/2026 (par moi)');
    await expect(page.locator('.cm-panel-item').nth(1).locator('.cm-status-chip')).toHaveCount(0);
  });
});
