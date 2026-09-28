// V2.2 — Mode live : le fil des messages dans le tiroir, « Répondre » et « Ça ne convient pas ? Rouvrir ».
// Supabase est SIMULÉ (helpers.js) ; le widget résout un vrai défi Altcha et envoie de vraies requêtes.
const { test, expect } = require('@playwright/test');
const H = require('./helpers');

const PAGE = 'generic-dashboard-sync.html';
const KEY = 'witmit_kiosque-sync_v1';
const ticket = async (page, i = 0) => (await H.stored(page, KEY))[i];
const EQUIPE = { de: 'equipe', texte: 'Corrigé, peux-tu vérifier ?', rouvre: false, cree_le: '2026-09-28T10:00:00Z' };

let state;
test.beforeEach(async ({ page }) => {
  state = {};
  await H.mockSupabase(page, state);
  await page.goto(H.fileUrl(PAGE));
  await H.clearStorage(page);
  await page.goto(H.fileUrl(PAGE) + '?witmit=on');
});

// Un ticket envoyé au guichet, puis la ligne que le serveur renverra à la relecture ; tiroir ouvert.
async function ticketEnvoye(page, row, i = 0) {
  await H.activate(page);
  await H.addPin(page, `tbody tr:nth-child(${i + 1}) td:nth-child(2)`, 'Ticket ' + (i + 1));
  await expect.poll(async () => ((await ticket(page, i)).sync || {}).state, { timeout: 15000 }).toBe('sent');
  const t = await ticket(page, i);
  state.rows.push({ id_local: t.id, message_retour: null, mis_a_jour_le: '2026-09-28T10:00:00Z', messages: [], ...row });
  await H.deactivate(page);
  await page.locator('#cmPanelBtn').click();
}
const rouvrirTiroir = async (page) => { await page.locator('#cmPanelBtn').click(); await page.locator('#cmPanelBtn').click(); };

test('1. le fil est affiché : messages de l’équipe et les tiens, datés, dans l’ordre', async ({ page }) => {
  await ticketEnvoye(page, {
    statut: 'en_cours', message_retour: EQUIPE.texte,
    messages: [EQUIPE, { de: 'auteur', texte: 'Pas encore', rouvre: false, cree_le: '2026-09-28T11:00:00Z' }, { de: 'auteur', texte: 'Toujours pas', rouvre: true, cree_le: '2026-09-29T09:00:00Z' }],
  });
  const msgs = page.locator('.cm-msg');
  await expect(msgs).toHaveCount(3);
  await expect(msgs.nth(0)).toHaveClass(/cm-msg-equipe/);
  await expect(msgs.nth(0)).toContainText('💬 Équipe · 28/09/2026');
  await expect(msgs.nth(0)).toContainText('Corrigé, peux-tu vérifier ?');
  await expect(msgs.nth(1)).toContainText('↳ Toi');
  await expect(msgs.nth(2)).toContainText('↩ Tu as rouvert le ticket · 29/09/2026');
  await expect(page.locator('.cm-feedback')).toHaveCount(0);   // le fil remplace l'ancien message unique
  expect((await ticket(page)).thread).toHaveLength(3);
});

test('2. Répondre : le texte part au guichet, rejoint le fil ; le statut ne change pas ; cliquer ailleurs n’envoie rien', async ({ page }) => {
  await ticketEnvoye(page, { statut: 'en_cours', messages: [EQUIPE] });
  await expect(page.locator('.cm-reopen-btn')).toHaveCount(0);
  await page.locator('.cm-reply-btn').click();
  const ta = page.locator('.cm-inline-reply');
  await expect(ta).toHaveAttribute('placeholder', /Ta réponse à l’équipe/);
  await ta.fill('Merci, je regarde');
  await page.locator('#cmPanelSub').click();                 // clic ailleurs : rien ne part, le champ reste
  await page.waitForTimeout(500);
  expect(state.replies).toHaveLength(0);
  await expect(ta).toBeVisible();
  await ta.press('Enter');
  await expect.poll(() => state.replies.length, { timeout: 15000 }).toBe(1);
  const r = state.replies[0];
  expect(r.preuveOk).toBe(true);
  expect(r.body).toMatchObject({ ticket_id: 'srv-1', texte: 'Merci, je regarde', rouvrir: false });
  await expect(page.locator('.cm-msg').nth(1)).toContainText('Merci, je regarde');
  await expect(page.locator('.cm-msg-pending')).toHaveCount(0);
  await expect(page.locator('.cm-status-chip')).toContainText('Pris en compte');
  expect((await ticket(page)).replies).toHaveLength(0);
});

test('3. Rouvrir : texte obligatoire, puis le ticket résolu repasse « pris en compte »', async ({ page }) => {
  await ticketEnvoye(page, { statut: 'resolu', messages: [EQUIPE] });
  await expect(page.locator('.cm-status-chip')).toContainText('Résolu');
  await expect(page.locator('.cm-reply-btn')).toBeVisible();
  await page.locator('.cm-reopen-btn').click();
  const ta = page.locator('.cm-inline-reply');
  await ta.press('Enter');                                   // vide : refusé, le champ reste
  await expect(page.locator('#cmStatus')).toContainText('Dis ce qui ne va pas');
  await expect(ta).toBeVisible();
  expect(state.replies).toHaveLength(0);
  await ta.fill('Le bouton est toujours décalé');
  await ta.press('Enter');
  await expect.poll(() => state.replies.length, { timeout: 15000 }).toBe(1);
  expect(state.replies[0].body).toMatchObject({ texte: 'Le bouton est toujours décalé', rouvrir: true });
  await expect(page.locator('.cm-status-chip')).toContainText('Pris en compte');
  await expect(page.locator('.cm-msg').nth(1)).toContainText('↩ Tu as rouvert le ticket');
  await expect(page.locator('.cm-reopen-btn')).toHaveCount(0);
  expect((await ticket(page)).status).toBe('pris_en_compte');
  // la relecture suivante (serveur : en_cours) garde « pris en compte »
  state.rows[0].statut = 'en_cours';
  await rouvrirTiroir(page);
  await expect(page.locator('.cm-status-chip')).toContainText('Pris en compte');
});

test('4. une issue rouverte sur GitHub : le ticket résolu redevient « pris en compte »', async ({ page }) => {
  await ticketEnvoye(page, { statut: 'resolu' });
  await expect(page.locator('.cm-status-chip')).toContainText('Résolu');
  state.rows[0].statut = 'en_cours';
  await rouvrirTiroir(page);
  await expect(page.locator('.cm-status-chip')).toContainText('Pris en compte');
  expect((await ticket(page)).status).toBe('pris_en_compte');
});

test('5. refus du guichet : le message est gardé ⚠️, renvoyé au clic ; abandon possible', async ({ page }) => {
  await ticketEnvoye(page, { statut: 'en_cours', messages: [EQUIPE] });
  state.failReply = { status: 403, erreur: 'ce ticket n’est pas le tien' };
  await page.locator('.cm-reply-btn').click();
  await page.locator('.cm-inline-reply').fill('Premier essai');
  await page.locator('.cm-inline-reply').press('Enter');
  await expect.poll(async () => ((await ticket(page)).replies[0].sync || {}).state, { timeout: 15000 }).toBe('error');
  expect((await ticket(page)).replies[0].text).toBe('Premier essai');
  await expect(page.locator('#cmStatus')).toContainText('ton message est gardé');
  const attente = page.locator('.cm-msg-pending');
  await expect(attente).toContainText('Premier essai');
  await expect(attente.locator('.cm-sync-error')).toHaveAttribute('title', /ce ticket n’est pas le tien/);
  await attente.locator('.cm-sync-error').click();           // nouvel essai : cette fois accepté
  await expect(attente).toHaveCount(0);
  await expect(page.locator('.cm-msg').nth(1)).toContainText('Premier essai');
  expect(state.replies).toHaveLength(2);
  // un second message refusé, abandonné
  state.failReply = { status: 429, erreur: 'réessaie demain' };
  await page.locator('.cm-reply-btn').click();
  await page.locator('.cm-inline-reply').fill('À abandonner');
  await page.locator('.cm-inline-reply').press('Enter');
  await expect(attente.locator('.cm-sync-error')).toBeVisible({ timeout: 15000 });
  page.once('dialog', (d) => d.accept());
  await attente.locator('.cm-msg-drop').click();
  await expect(attente).toHaveCount(0);
  expect((await ticket(page)).replies).toHaveLength(0);
});

test('6. boutons absents quand ils ne doivent pas être là', async ({ page }) => {
  await ticketEnvoye(page, { statut: 'nouveau' });                            // pas encore pris en charge
  await page.locator('#cmPanelBtn').click();                                  // tiroir fermé avant le 2e ticket
  await ticketEnvoye(page, { statut: 'en_cours', messages: [] }, 1);          // pris en compte, sans message de l'équipe
  await expect(page.locator('.cm-panel-item')).toHaveCount(2);
  await expect(page.locator('.cm-reply-btn, .cm-reopen-btn')).toHaveCount(0);
  // résolu « par moi » (✓ local) : rien à rouvrir côté équipe
  await page.locator('.cm-panel-item').nth(0).locator('button.st').click();
  await expect(page.locator('.cm-panel-item').nth(0).locator('.cm-status-chip')).toContainText('par moi');
  await expect(page.locator('.cm-reopen-btn')).toHaveCount(0);
  // mode maquette : jamais de fil ni de boutons
  await page.goto(H.fileUrl('generic-dashboard.html'));
  await H.clearStorage(page); await page.reload();
  await H.activate(page);
  await H.addPin(page, 'tbody tr:first-child td:nth-child(2)', 'Local');
  await H.deactivate(page); await page.locator('#cmPanelBtn').click();
  await expect(page.locator('.cm-panel-item')).toHaveCount(1);
  await expect(page.locator('.cm-thread, .cm-thread-actions')).toHaveCount(0);
});
