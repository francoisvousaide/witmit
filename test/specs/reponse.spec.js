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
  await expect(msgs.nth(0)).toContainText('équipe · 28/09/2026');
  await expect(msgs.nth(0)).toContainText('Corrigé, peux-tu vérifier ?');
  await expect(msgs.nth(1)).toContainText('toi');
  await expect(msgs.nth(1)).toHaveClass(/cm-msg-auteur/);
  await expect(msgs.nth(2)).toContainText('tu as rouvert ce retour · 29/09/2026');
  await expect(page.locator('.cm-feedback')).toHaveCount(0);   // le fil remplace l'ancien message unique
  expect((await ticket(page)).thread).toHaveLength(3);
});

test('2. Répondre : le texte part au guichet, rejoint le fil ; le statut ne change pas ; cliquer ailleurs n’envoie rien', async ({ page }) => {
  await ticketEnvoye(page, { statut: 'en_cours', messages: [EQUIPE] });
  await expect(page.locator('.cm-reopen-btn')).toHaveCount(0);
  await page.locator('.cm-reply-btn').click();
  const ta = page.locator('.cm-inline-reply');
  await expect(ta).toHaveAttribute('placeholder', "ta réponse à l'équipe…");
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
  await expect(page.locator('.cm-status-chip')).toContainText('pris en compte');
  expect((await ticket(page)).replies).toHaveLength(0);
});

test('3. Rouvrir : texte obligatoire, puis le ticket résolu repasse « pris en compte »', async ({ page }) => {
  await ticketEnvoye(page, { statut: 'resolu', messages: [EQUIPE] });
  await expect(page.locator('.cm-status-chip')).toContainText('résolu');
  await expect(page.locator('.cm-reply-btn')).toBeVisible();
  await page.locator('.cm-reopen-btn').click();
  const ta = page.locator('.cm-inline-reply');
  await ta.press('Enter');                                   // vide : refusé, le champ reste ; la phrase sous le champ (plus de toast)
  await expect(page.locator('.cm-panel-item .cm-refus')).toBeVisible();
  await expect(page.locator('.cm-panel-item .cm-refus')).toHaveText('dis ce qui ne va pas pour rouvrir ce retour.');
  await expect(ta).toBeVisible();
  expect(state.replies).toHaveLength(0);
  await ta.fill('Le bouton est toujours décalé');
  await ta.press('Enter');
  await expect.poll(() => state.replies.length, { timeout: 15000 }).toBe(1);
  expect(state.replies[0].body).toMatchObject({ texte: 'Le bouton est toujours décalé', rouvrir: true });
  await expect(page.locator('.cm-status-chip')).toContainText('pris en compte');
  await expect(page.locator('.cm-msg').nth(1)).toContainText('tu as rouvert ce retour');
  await expect(page.locator('.cm-reopen-btn')).toHaveCount(0);
  expect((await ticket(page)).status).toBe('pris_en_compte');
  // la relecture suivante (serveur : en_cours) garde « pris en compte »
  state.rows[0].statut = 'en_cours';
  await rouvrirTiroir(page);
  await expect(page.locator('.cm-status-chip')).toContainText('pris en compte');
});

test('4. une issue rouverte sur GitHub : le ticket résolu redevient « pris en compte »', async ({ page }) => {
  await ticketEnvoye(page, { statut: 'resolu' });
  await expect(page.locator('.cm-status-chip')).toContainText('résolu');
  state.rows[0].statut = 'en_cours';
  await rouvrirTiroir(page);
  await expect(page.locator('.cm-status-chip')).toContainText('pris en compte');
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
  await expect(attente.locator('.cm-sync-error')).toHaveAttribute('title', 'le service witmit ne répond pas. clique pour réessayer.');   // la raison en clair (Léa 3.11), plus la raison brute
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

// V2.3 — issue fermée « non prévue » (state_reason not_planned) : statut serveur « repondu »
test('7. Répondu : même ✅, libellé « Répondu », verrouillé ; Rouvrir disponible', async ({ page }) => {
  await ticketEnvoye(page, { statut: 'repondu', messages: [EQUIPE] });
  const chip = page.locator('.cm-status-chip');
  await expect(chip).toHaveText('répondu');
  await expect(chip).toHaveAttribute('title', /^répondu le \d\d\/\d\d\/\d{4}$/);   // la date du statut passe en info-bulle
  await expect(page.locator('.cm-panel-item .cm-st-locked')).toHaveCount(1);   // terminé : ✓ verrouillé
  expect((await ticket(page)).status).toBe('resolu');
  expect((await ticket(page)).repondu).toBe(true);
  await page.locator('.cm-reopen-btn').click();
  await page.locator('.cm-inline-reply').fill('Ma question n’est pas réglée');
  await page.locator('.cm-inline-reply').press('Enter');
  await expect.poll(() => state.replies.length, { timeout: 15000 }).toBe(1);
  expect(state.replies[0].body).toMatchObject({ rouvrir: true });
  await expect(chip).toContainText('pris en compte');
  expect((await ticket(page)).repondu).toBeUndefined();
  // refermée cette fois comme corrigée : « Résolu », plus « Répondu »
  state.rows[0].statut = 'resolu';
  await rouvrirTiroir(page);
  await expect(chip).toHaveText('résolu');
});

test('8. Répondu puis rouvert sur GitHub : « pris en compte » ; fermé corrigé ensuite : « Résolu »', async ({ page }) => {
  await ticketEnvoye(page, { statut: 'repondu' });
  const chip = page.locator('.cm-status-chip');
  await expect(chip).toHaveText('répondu');
  state.rows[0].statut = 'en_cours';
  await rouvrirTiroir(page);
  await expect(chip).toContainText('pris en compte');
  expect((await ticket(page)).repondu).toBeUndefined();
  state.rows[0].statut = 'resolu';
  await rouvrirTiroir(page);
  await expect(chip).toHaveText('résolu');
  expect((await ticket(page)).repondu).toBeUndefined();
});

// Lot 5 — voyant « l'équipe a écrit » (décision B du 25/10, option 1 ; C5).
test('9. voyant : allumé par un message de l’équipe, éteint après lecture ; au premier chargement de la 0.2.0, tout l’existant compte comme vu', async ({ page }) => {
  const voyant = page.locator('#cmPanelBtn #cmCount');
  const witmit = page.locator('#cmPanelBtn');
  await ticketEnvoye(page, { statut: 'nouveau' });
  await page.waitForTimeout(800);                                            // relecture des statuts faite
  await expect(page.locator('.cm-panel-item .cm-nouveau')).toHaveCount(0);   // ton propre retour : rien de nouveau
  await witmit.click();
  await expect(voyant).toBeHidden();
  // L'équipe écrit : la relecture suivante (ouverture de la liste) allume le voyant et le mot « nouveau ».
  state.rows[0].statut = 'en_cours'; state.rows[0].messages = [EQUIPE];
  await witmit.click();
  await expect(page.locator('.cm-panel-item .cm-nouveau')).toHaveText('nouveau', { timeout: 15000 });
  await expect(voyant).toBeVisible();
  await expect(witmit).toHaveAccessibleName('witmit, 1 nouveau retour');
  await witmit.click();                                                      // liste fermée après lecture : éteint
  await expect(voyant).toBeHidden();
  await expect(witmit).toHaveAccessibleName('witmit');
  await page.reload();
  await page.waitForTimeout(2500);                                           // relecture au chargement : rien de neuf
  await expect(voyant).toBeHidden();
  // Un second message de l'équipe : allumé dès le chargement, sans ouvrir la liste.
  state.rows[0].messages = [EQUIPE, { de: 'equipe', texte: 'Et maintenant ?', rouvre: false, cree_le: '2026-09-29T10:00:00Z' }];
  await page.reload();
  await expect(voyant).toBeVisible({ timeout: 15000 });
  // Ta réponse ne rallume rien : lue, puis tu réponds.
  await witmit.click(); await witmit.click();
  await expect(voyant).toBeHidden();
  await witmit.click();
  await page.locator('.cm-reply-btn').click();
  await page.locator('.cm-inline-reply').fill('Je regarde');
  await page.locator('.cm-inline-reply').press('Enter');
  await expect.poll(() => state.replies.length, { timeout: 15000 }).toBe(1);
  state.rows[0].messages = state.rows[0].messages.concat([{ de: 'auteur', texte: 'Je regarde', rouvre: false, cree_le: '2026-09-30T10:00:00Z' }]);
  await witmit.click(); await witmit.click();
  await page.waitForTimeout(800);
  await expect(page.locator('.cm-panel-item .cm-nouveau')).toHaveCount(0);
  // Premier chargement de la 0.2.0 : retour écrit avec la 0.1 (ni vuLe, ni equipeLe), l'équipe a écrit entre-temps.
  await witmit.click();
  await page.evaluate((k) => {
    const l = JSON.parse(localStorage.getItem(k));
    l.forEach((c) => { delete c.vuLe; delete c.equipeLe; c.sync.statut = 'nouveau'; c.thread = []; });
    localStorage.setItem(k, JSON.stringify(l));
    localStorage.removeItem('witmit_kiosque-sync_vu_0_2');
  }, KEY);
  await page.reload();
  await expect.poll(async () => ((await ticket(page)).thread || []).length, { timeout: 15000 }).toBe(3);   // relecture faite
  await expect(voyant).toBeHidden();                                         // pas de vague de points jaunes
  expect((await ticket(page)).vuLe).toBeTruthy();
});

test('10. « masquer les terminés » coché : un retour résolu par l’équipe reste affiché avec « nouveau », puis le voyant s’éteint à la fermeture', async ({ page }) => {
  const voyant = page.locator('#cmPanelBtn #cmCount');
  const witmit = page.locator('#cmPanelBtn');
  await ticketEnvoye(page, { statut: 'nouveau' });
  await page.waitForTimeout(800);
  await page.locator('#cmPanel .cm-hide-done').click();                     // case cochée
  await expect(page.locator('#cmPanel .cm-hide-done')).toHaveAttribute('aria-checked', 'true');
  await witmit.click();
  state.rows[0].statut = 'resolu';
  state.rows[0].messages = [{ de: 'equipe', texte: 'Corrigé', rouvre: false, cree_le: '2026-09-28T10:00:00Z' }];
  await witmit.click();                                                     // relecture : l'équipe a résolu
  await expect(page.locator('.cm-panel-item .cm-nouveau')).toHaveText('nouveau', { timeout: 15000 });
  await expect(page.locator('.cm-panel-item')).toHaveCount(1);              // affiché malgré le filtre
  await expect(page.locator('.cm-panel-item .cm-status-chip')).toHaveText('résolu');
  await expect(voyant).toBeVisible();
  await witmit.click();                                                     // fermée après l'avoir vu : éteint
  await expect(voyant).toBeHidden();
  await expect(witmit).toHaveAccessibleName('witmit');
  await witmit.click();                                                     // à l'ouverture suivante, le filtre le cache
  await page.waitForTimeout(800);
  await expect(page.locator('.cm-panel-item')).toHaveCount(0);
  await expect(page.locator('.cm-panel-empty')).toHaveText('tous les retours de cette page sont terminés.');
  await expect(voyant).toBeHidden();
});

test('11. les touches sous le fil tiennent dans leur face à 380 px (« ça ne convient pas ? rouvrir »)', async ({ page }) => {
  await ticketEnvoye(page, { statut: 'resolu', messages: [EQUIPE] });
  await expect(page.locator('.cm-reopen-btn')).toBeVisible({ timeout: 15000 });
  for (const sel of ['.cm-reopen-btn', '.cm-reply-btn']) {
    const r = await page.locator(sel).evaluate((b) => {
      const face = b.getBoundingClientRect();
      const kids = Array.from(b.querySelectorAll('svg, *')).concat([b]).map((k) => k.getBoundingClientRect());
      const range = document.createRange(); range.selectNodeContents(b);
      const txt = range.getBoundingClientRect();
      return { taille: getComputedStyle(b).fontSize, gauche: Math.min(txt.left, ...kids.map((k) => k.left)) >= face.left - 0.5, droite: txt.right <= face.right + 0.5, deborde: b.scrollWidth > b.clientWidth };
    });
    expect(r, sel).toEqual({ taille: '12px', gauche: true, droite: true, deborde: false });
  }
});

// Décision E1 de Tom : une réponse ou une réouverture en 500 n'est jamais renvoyée (elle a pu être publiée sur
// GitHub : un renvoi ferait un doublon) ; seul « × abandonner » reste. 409 et 413 ne repartent pas non plus.
async function repondre(page, texte, rouvrir = false) {
  await page.locator(rouvrir ? '.cm-reopen-btn' : '.cm-reply-btn').click();
  await page.locator('.cm-inline-reply').fill(texte);
  await page.locator('.cm-inline-reply').press('Enter');
}
const etatReponse = async (page, i = 0) => (((await ticket(page)).replies[i] || {}).sync || {}).state;

test('12. réponse en 500 « publiée mais non enregistrée », puis réouverture en 500 : jamais renvoyées, seul × abandonner reste', async ({ page }) => {
  test.setTimeout(40000);
  await ticketEnvoye(page, { statut: 'resolu', messages: [EQUIPE] });
  state.failReply = { status: 500, erreur: 'message publié sur GitHub mais non enregistré dans witmit' };
  await repondre(page, 'Arrivé, mais pas gardé');
  await expect.poll(() => etatReponse(page), { timeout: 15000 }).toBe('error');
  await expect(page.locator('#cmStatus')).toHaveText("ton message est bien arrivé à l'équipe, mais witmit n'a pas pu le garder dans ce fil. il ne sera pas renvoyé : × le retire d'ici.");
  const attente = page.locator('.cm-msg-pending');
  const marque = attente.locator('.cm-sync-error');
  expect(await marque.evaluate((el) => el.tagName)).toBe('SPAN');   // plus un bouton de renvoi
  await expect(marque).toHaveAttribute('title', "ton message est bien arrivé à l'équipe, mais witmit n'a pas pu le garder dans ce fil. il ne sera pas renvoyé : × le retire d'ici.");
  await expect(attente.locator('button')).toHaveCount(1);            // seul « × abandonner »
  await expect(attente.locator('.cm-msg-drop')).toBeVisible();
  await marque.click();                                              // un clic sur la marque ne renvoie rien
  await rouvrirTiroir(page);                                         // ni l'ouverture de la liste
  await page.waitForTimeout(2000);
  expect(state.replies).toHaveLength(1);
  // la réouverture, en 500 d'une autre sorte
  state.failReply = { status: 500, erreur: 'erreur interne' };
  await repondre(page, 'Toujours décalé', true);
  await expect.poll(() => etatReponse(page, 1), { timeout: 15000 }).toBe('error');
  await expect(page.locator('#cmStatus')).toHaveText("envoi impossible : witmit ne sait pas si ton message est parti. il ne sera pas renvoyé, pour éviter un doublon : × le retire d'ici ; réécris-le plus tard si l'équipe ne t'a pas répondu.");
  await rouvrirTiroir(page);
  await page.waitForTimeout(2000);
  expect(state.replies).toHaveLength(2);
  await expect(page.locator('.cm-msg-pending .cm-sync-error').nth(1)).toHaveAttribute('title', 'witmit ne sait pas si ton message est parti.');
  // × : le message part de la liste, sans jamais repartir au guichet. En 500, il a pu arriver à l'équipe : la
  // confirmation dit « retirer d'ici », pas « il n'est pas parti » (Léa 3.9 complétée au lot 8).
  const confirmation = H.accepterConfirmation(page);
  await page.locator('.cm-msg-pending .cm-msg-drop').first().click();
  expect(await confirmation).toBe("retirer ce message d'ici ? il ne sera pas renvoyé.");
  await expect(page.locator('.cm-msg-pending')).toHaveCount(1);
  const confirmation2 = H.accepterConfirmation(page);
  await page.locator('.cm-msg-pending .cm-msg-drop').first().click();
  expect(await confirmation2).toBe("retirer ce message d'ici ? il ne sera pas renvoyé.");
  await expect(page.locator('.cm-msg-pending')).toHaveCount(0);
  expect(state.replies).toHaveLength(2);
});

test('13. réponse en 413 ou réouverture en 409 : la raison en clair, et rien ne repart tout seul', async ({ page }) => {
  test.setTimeout(40000);
  await ticketEnvoye(page, { statut: 'en_cours', messages: [EQUIPE] });
  state.failReply = { status: 413, erreur: 'message trop long (2000 caractères max)' };
  await repondre(page, 'Un message trop long');
  await expect.poll(() => etatReponse(page), { timeout: 15000 }).toBe('error');
  await expect(page.locator('#cmStatus')).toHaveText('envoi impossible : ton message dépasse 2 000 caractères. il ne repartira pas : abandonne-le (×) et écris-en un plus court.');
  await expect(page.locator('.cm-msg-pending .cm-sync-error')).toHaveAttribute('title', 'ton message dépasse 2 000 caractères.');
  await expect(page.locator('.cm-msg-pending .cm-sync-error .wm-lu')).toHaveText(' : ton message dépasse 2 000 caractères.');   // lu par un lecteur d'écran
  await rouvrirTiroir(page);
  await page.waitForTimeout(2000);
  expect(state.replies).toHaveLength(1);
  // le serveur dit résolu ; la réouverture est refusée en 409 (« pas terminé » : le serveur a changé d'avis entre-temps)
  state.rows[0].statut = 'resolu';
  await rouvrirTiroir(page);
  await expect(page.locator('.cm-reopen-btn')).toBeVisible();
  state.failReply = { status: 409, erreur: 'seul un ticket résolu ou répondu peut être rouvert' };
  await repondre(page, 'Rouvre-le', true);
  await expect.poll(() => etatReponse(page, 1), { timeout: 15000 }).toBe('error');
  await expect(page.locator('#cmStatus')).toHaveText("envoi impossible : ce retour n'est pas terminé. ton message ne repartira pas : abandonne-le (×) et écris-le avec « répondre ».");
  await page.reload();                                               // ni au chargement
  await page.waitForTimeout(2500);
  expect(state.replies).toHaveLength(2);
  // un autre 413 (refus que la table ne nomme pas) : « witmit a refusé ce message », rien ne repart
  await page.locator('#cmPanelBtn').click();
  await expect(page.locator('.cm-reply-btn')).toBeVisible();
  state.failReply = { status: 413, erreur: 'corps trop gros' };
  await repondre(page, 'Encore un');
  await expect.poll(() => etatReponse(page, 2), { timeout: 15000 }).toBe('error');
  await expect(page.locator('#cmStatus')).toHaveText('envoi impossible : witmit a refusé ce message. il ne repartira pas : abandonne-le (×).');
  await expect(page.locator('.cm-msg-pending .cm-sync-error').nth(2)).toHaveAttribute('title', 'witmit a refusé ce message.');
  await expect(page.locator('.cm-msg-pending .cm-sync-error').nth(2).locator('.wm-lu')).toHaveText(' : witmit a refusé ce message.');
  await rouvrirTiroir(page);
  await page.waitForTimeout(2000);
  expect(state.replies).toHaveLength(3);
  // × sur un message refusé (413, pas un 500) : la confirmation garde « il n'est pas parti »
  const confirmation = H.accepterConfirmation(page);
  await page.locator('.cm-msg-pending .cm-msg-drop').first().click();
  expect(await confirmation).toBe("abandonner ce message ? il n'est pas parti et sera effacé.");
  await expect(page.locator('.cm-msg-pending')).toHaveCount(2);
});
