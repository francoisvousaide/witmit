/*!
 * witmit 0.2.0 — widget d'annotation visuelle (charte « Objet »)
 * Un seul fichier : injecte son style, son interface et sa logique au chargement.
 * Polices (dossier witmit-polices/ à côté de ce fichier) : Tektur, Martian Mono, Syne et Doto, SIL Open Font License 1.1.
 * Usage : <script src="witmit.js" data-project="monprojet" data-email="moi@exemple.fr"></script>
 * Raccourci : Alt+A (Windows/Linux) · ⌥+A (Mac)
 * Auteur (site où l'on est connecté) : window.witmit.identify({ nom: 'Marine' }) · identify(null) — voir plus bas.
 */
(function () {
  if (window.__witmitLoaded) return; // chargé deux fois par erreur : on ne s'installe qu'une fois
  window.__witmitLoaded = true;

  /* ---------- configuration lue sur la balise <script> ----------
     <script src="witmit.js" data-project="monprojet" data-email="moi@exemple.fr"></script>
     - data-project : nom du projet (clé de stockage + titre du rapport) — obligatoire en pratique
     - data-email   : destinataire du bouton « Envoyer » (facultatif)
    - data-mode    : "mock" (défaut : tout reste dans le navigateur, boutons visibles) ou "live" (site en
                     production : widget invisible par défaut, révélé par Alt+A / ⌥+A ou ?witmit=on) */
  var SCRIPT_EL = document.currentScript || document.querySelector('script[data-project]');
  var CONFIG = {
    project: (SCRIPT_EL && SCRIPT_EL.getAttribute('data-project')) || 'witmit',
    email: (SCRIPT_EL && SCRIPT_EL.getAttribute('data-email')) || '',
    mode: (SCRIPT_EL && SCRIPT_EL.getAttribute('data-mode')) === 'live' ? 'live' : 'mock',
    // Mode live : adresse du projet Supabase de witmit et sa clé PUBLIQUE (sb_publishable_…, sans droit d'écriture)
    supabaseUrl: ((SCRIPT_EL && SCRIPT_EL.getAttribute('data-supabase-url')) || '').replace(/\/+$/, ''),
    supabaseKey: (SCRIPT_EL && SCRIPT_EL.getAttribute('data-supabase-key')) || '',
    // data-capture="false" : pas de capture d'écran des encadrés ; data-html2canvas="…" : autre adresse de la bibliothèque
    capture: !(SCRIPT_EL && /^(false|0|non)$/i.test(SCRIPT_EL.getAttribute('data-capture') || '')),
    html2canvasUrl: (SCRIPT_EL && SCRIPT_EL.getAttribute('data-html2canvas')) || 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    // data-drawer="overlay" : le tiroir recouvre la page au lieu de la pousser (par défaut : "push")
    drawer: (SCRIPT_EL && SCRIPT_EL.getAttribute('data-drawer')) === 'overlay' ? 'overlay' : 'push',
    // data-multi-lines="false" : ne pas relier par des lignes fines les éléments d'une sélection multiple
    multiLines: !(SCRIPT_EL && /^(false|0|non)$/i.test(SCRIPT_EL.getAttribute('data-multi-lines') || '')),
    // data-host-theme="light" | "dark" : le site dit lui-même si son fond est clair ou sombre (défaut "auto" :
    // witmit le lit sur la page). witmit prend toujours l'inverse : site clair → verre graphite.
    hostTheme: (function (v) { return v === 'light' || v === 'dark' ? v : 'auto'; })(SCRIPT_EL && SCRIPT_EL.getAttribute('data-host-theme')),
    // data-fonts="<adresse du dossier>" : autre emplacement des polices ; data-fonts="none" : polices du système
    fonts: (SCRIPT_EL && SCRIPT_EL.getAttribute('data-fonts')) || ''
  };
  var VERSION = '0.2.0';

  /* ---------- polices de la charte, servies à côté du script (jamais par un service tiers) ----------
     Adresse : new URL('witmit-polices/', <adresse de witmit.js>), ou data-fonts. Les @font-face sont écrits
     dans le CSS injecté : une police n'est téléchargée qu'au premier texte de witmit qui l'utilise. */
  var FONTS_BASE = (function () {
    if (/^none$/i.test(CONFIG.fonts)) return null;
    try {
      var href = CONFIG.fonts ? new URL(CONFIG.fonts, location.href).href : new URL('witmit-polices/', SCRIPT_EL && SCRIPT_EL.src).href;
      return /\/$/.test(href) ? href : href + '/';
    } catch (e) { return null; }
  })();
  var UNI_LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  var UNI_LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
  // [famille affichée, fichier, graisses, latin-ext ?]
  var POLICES = [
    ['witmit Tektur', 'tektur', [500, 700], true],
    ['witmit Martian Mono', 'martian-mono', [400, 500, 600], true],
    ['witmit Syne', 'syne', [400, 500], true],
    ['witmit Doto', 'doto', [900], false]
  ];
  function fontFacesCss() {
    if (!FONTS_BASE) return '';
    var base = FONTS_BASE.replace(/["\\\n\r]/g, encodeURIComponent);
    var out = '';
    POLICES.forEach(function (p) {
      p[2].forEach(function (w) {
        var sets = p[3] ? [['latin-ext', UNI_LATIN_EXT], ['latin', UNI_LATIN]] : [['latin', UNI_LATIN]];
        sets.forEach(function (set) {
          out += '@font-face{font-family:"' + p[0] + '";font-style:normal;font-weight:' + w + ';font-display:swap;' +
            'src:url("' + base + p[1] + '-' + set[0] + '-' + w + '-normal.woff2") format("woff2");unicode-range:' + set[1] + ';}\n';
        });
      });
    });
    return out;
  }
  // Demande les polices à l'avance (révélation, premier survol d'un bouton, ouverture de la liste) : elles
  // sont prêtes quand la fenêtre s'ouvre. Un visiteur qui n'ouvre jamais witmit ne télécharge rien.
  var fontsRequested = false;
  function prechargerPolices() {
    if (fontsRequested || !FONTS_BASE || !document.fonts || !document.fonts.load) return;
    fontsRequested = true;
    POLICES.forEach(function (p) {
      p[2].forEach(function (w) { try { document.fonts.load(w + ' 16px "' + p[0] + '"').catch(function () {}); } catch (e) {} });
    });
  }

  /* ---------- l'auteur, déclaré par le site hôte ----------
     Un site où l'on est connecté peut dire à witmit qui écrit : window.witmit.identify({ nom: 'Marine' }),
     identify(null) pour oublier (déconnexion), ou data-user-name="Marine" sur la balise. Si le site parle
     avant que ce script soit chargé, il met l'appel en file :
       (window.witmitQueue = window.witmitQueue || []).push(['identify', { nom: 'Marine' }]);
     Le nom reste en mémoire le temps de la page, jamais dans le navigateur : le site le redonne à chaque
     chargement, et il ne peut pas rester collé après une déconnexion. Il est inscrit sur chaque ticket au
     moment où celui-ci est écrit (un ticket en attente d'envoi garde son auteur), puis envoyé avec lui
     (source « hote ») ; le guichet le nettoie à nouveau. */
  var AUTHOR = null;
  function cleanAuthor(user) {
    var nom = user && typeof user === 'object' ? user.nom : user;
    if (typeof nom !== 'string') return null;
    nom = nom.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim().slice(0, 60).trim();
    return nom || null;
  }
  function renderAuthor() {
    var el = document.getElementById('cmAuthor');
    if (!el) return;
    el.textContent = AUTHOR ? 'Tes retours sont signés : ' + AUTHOR : '';
    el.hidden = !AUTHOR;
  }
  function runCommand(cmd) {
    if (Array.isArray(cmd) && cmd[0] === 'identify') window.witmit.identify(cmd[1]);
  }
  window.witmit = {
    version: VERSION,
    identify: function (user) { AUTHOR = cleanAuthor(user); renderAuthor(); }
  };
  window.witmit.identify(SCRIPT_EL && SCRIPT_EL.getAttribute('data-user-name'));
  var queuedCommands = Array.isArray(window.witmitQueue) ? window.witmitQueue : [];
  window.witmitQueue = { push: runCommand };   // un push arrivé après le chargement s'exécute aussitôt
  queuedCommands.forEach(runCommand);

  var CSS = `
  /* ---------- jetons de la charte « Objet » (design system witmit, tokens.css) ----------
     Valeurs recopiées telles quelles, préfixées --wm-. Elles ne sont JAMAIS posées sur :root, html ni
     body : rien ne fuit dans la page hôte, et aucune variable de l'hôte n'entre dans witmit.
     Thème : data-wm-theme sur <body>, toujours l'inverse du fond de la page (site clair → verre
     graphite « client-sombre » ; site sombre → verre champagne « client-clair »). */
  .cm-ui, mark.cm-highlight {
    --wm-ground: rgba(236,232,224,0.60);
    --wm-surface: rgba(236,232,224,0.60);
    --wm-surface-raised: rgba(255,255,255,0.45);
    --wm-face-touche: rgba(255,255,255,0.45);
    --wm-ink: #141412;
    --wm-ink-soft: #2e2b27;
    --wm-ink-faint: #45423d;
    --wm-line: rgba(0,0,0,0.16);
    --wm-contour-fenetre: #6f685d;
    --wm-line-strong: rgba(20,20,18,0.55);
    --wm-accent: #fff200;
    --wm-accent-ring: #0a0a0a;
    --wm-signal: #b8291d;
    --wm-metal-dark-hi: #5e584f;
    --wm-metal-dark-lo: #191816;
    --wm-metal-light-hi: #faf8f4;
    --wm-metal-light-lo: #c3bbad;
    --wm-ombre-fenetre: 0 16px 26px rgba(0,0,0,0.55);
    --wm-ombre-epingle: inset 0 1.5px 0 rgba(255,255,255,0.75), inset 0 -3px 5px rgba(0,0,0,0.26), 0 3px 10px rgba(0,0,0,0.28);
    --wm-ombre-bouton: inset 0 1px 1px rgba(255,240,220,0.45), 0 8px 18px rgba(0,0,0,0.30);
    --wm-ombre-bouton-enfonce: inset 0 3px 6px rgba(90,70,50,0.45), inset 0 -1px 0 #ffffff, 0 1px 2px rgba(0,0,0,0.40);
    --wm-ombre-bouton-enfonce-sombre: inset 0 3px 6px rgba(0,0,0,0.6),inset 0 -1px 0 rgba(255,240,220,0.2),0 1px 2px rgba(0,0,0,0.4);
    --wm-space-1: 4px;
    --wm-space-2: 8px;
    --wm-space-3: 12px;
    --wm-space-4: 16px;
    --wm-space-5: 20px;
    --wm-radius-repere: 4px;
    --wm-radius-numero: 5px;
    --wm-radius-rond: 999px;
    --wm-coupe-fenetre: 11px;
    --wm-coupe-touche: 6px;
    --wm-verre-flou: 10px;
    --wm-verre-opacite-clair: 0.60;
    --wm-verre-opacite-sombre: 0.66;
    --wm-cible-min: 44px;
    --wm-texte-min: 12px;
    --wm-font-titre: "witmit Tektur", system-ui, sans-serif;
    --wm-font-outil: "witmit Martian Mono", ui-monospace, Menlo, Consolas, monospace;
    --wm-font-voix: "witmit Syne", system-ui, sans-serif;
    --wm-font-compteur: "witmit Doto", ui-monospace, Menlo, Consolas, monospace;
    /* Encre des repères posés sur le site (épingles, cadres, liens) : fixe, elle ne suit pas le verre
       mais le fond derrière chaque repère (fiche Reperes) — valeurs de --wm-ink clair et sombre. */
    --wm-encre-repere: #141412;
    --wm-encre-repere-claire: #f6f3ee;
    /* Halo du mode annotation (fiche Bandeau) : mêmes valeurs sur tous les sites, sans variante de thème. */
    --wm-halo-filet: rgba(10,10,10,.9);
    --wm-halo-lueur-courte: rgba(255,242,0,.42);
    --wm-halo-lueur: rgba(255,242,0,.40);
    /* Mise en page seulement (pas d'identité) : la barre de navigation de l'hôte, si elle est déclarée. */
    --wm-nav-h: var(--nav-h, 0px);
  }
  body[data-wm-theme="client-sombre"] .cm-ui, body[data-wm-theme="client-sombre"] mark.cm-highlight {
    --wm-ground: rgba(20,19,17,0.66);
    --wm-surface: rgba(20,19,17,0.66);
    --wm-surface-raised: rgba(0,0,0,0.30);
    --wm-face-touche: rgba(255,255,255,0.07);
    --wm-ink: #f6f3ee;
    --wm-ink-soft: #e6e2d9;
    --wm-ink-faint: #bdb9b0;
    --wm-line: rgba(255,255,255,0.14);
    --wm-contour-fenetre: #0a0a0a;
    --wm-line-strong: rgba(246,243,238,0.55);
    --wm-signal: #ff6b5b;
    --wm-ombre-fenetre: 0 16px 24px rgba(0,0,0,0.32);
  }
  /* Sans flou d'arrière-plan, ou si la personne réduit la transparence : verre presque opaque (0,94). */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .cm-ui { --wm-ground: rgba(236,232,224,0.94); --wm-surface: rgba(236,232,224,0.94); }
    body[data-wm-theme="client-sombre"] .cm-ui { --wm-ground: rgba(20,19,17,0.94); --wm-surface: rgba(20,19,17,0.94); }
  }
  @media (prefers-reduced-transparency: reduce) {
    .cm-ui { --wm-ground: rgba(236,232,224,0.94); --wm-surface: rgba(236,232,224,0.94); }
    body[data-wm-theme="client-sombre"] .cm-ui { --wm-ground: rgba(20,19,17,0.94); --wm-surface: rgba(20,19,17,0.94); }
  }

  /* Réinitialisation limitée à nos couches : les règles de l'hôte (preflight de Tailwind, styles posés sur
     button, mark, svg ou *) ne doivent pas déteindre sur witmit. Tout est écrit en toutes lettres. */
  .cm-ui, .cm-ui *, .cm-ui::before, .cm-ui::after, .cm-ui *::before, .cm-ui *::after { box-sizing:border-box; }
  .cm-ui { font-family:var(--wm-font-outil); font-size:13px; line-height:1.5; font-weight:400; letter-spacing:normal; text-transform:none; color:var(--wm-ink); }
  mark.cm-highlight { background:none; color:inherit; }

  /* Boutons flottants, créés seulement si la page n'a pas déjà ses propres boutons #cmToggleBtn/#cmPanelBtn */
  .cm-fab { position:fixed; right:18px; bottom:18px; z-index:845; display:flex; gap:8px; } /* sous le panneau (850) : ne masque jamais ses boutons */

  /* Boutons compacts, ronds, icône seule — aspect intermédiaire aux jetons (habillés aux lots 2 et 3) */
  .cm-toggle-btn { width:38px; height:38px; padding:0; display:flex; align-items:center; justify-content:center; background:var(--wm-face-touche); backdrop-filter:blur(var(--wm-verre-flou)) saturate(1.7); -webkit-backdrop-filter:blur(var(--wm-verre-flou)) saturate(1.7); border:1px solid var(--wm-line-strong); border-radius:50%; font-size:16px; color:var(--wm-ink); cursor:pointer; box-shadow:var(--wm-ombre-bouton); transition:transform 170ms ease, box-shadow 170ms ease; position:relative; }
  .cm-toggle-btn:hover { transform:scale(1.06); }
  .cm-toggle-btn.cm-on { background:linear-gradient(180deg, var(--wm-metal-light-hi), var(--wm-metal-light-lo)); border-color:var(--wm-encre-repere); box-shadow:var(--wm-ombre-bouton-enfonce); }
  .cm-toggle-btn .cm-count-badge { position:absolute; top:-4px; right:-4px; min-width:16px; height:16px; padding:0 3px; border-radius:var(--wm-radius-rond); background:var(--wm-accent); color:var(--wm-accent-ring); border:1px solid var(--wm-accent-ring); font-family:var(--wm-font-outil); font-size:9.5px; font-weight:600; line-height:1; display:flex; align-items:center; justify-content:center; }
  .cm-toggle-btn .cm-count-badge:empty, .cm-toggle-btn .cm-count-badge[data-zero="1"] { display:none; }

  /* Mode live, widget caché : aucune couche visible (toutes portent cm-ui) tant qu'il n'est pas révélé */
  body.cm-concealed .cm-ui { display:none !important; }

  body.cm-active { cursor: crosshair; }
  body.cm-active .cm-ui, body.cm-active .cm-ui * { cursor: default; }
  /* Curseurs de notre interface (la règle générique ci-dessus les neutraliserait) */
  body.cm-active .cm-ui button, body.cm-active .cm-pin, body.cm-active .cm-panel-item .body, body.cm-active .cm-panel-item .del { cursor:pointer; }
  body.cm-active .cm-popup .cm-zone { cursor:move; }
  body.cm-active .cm-popup textarea { cursor:text; }
  body .cm-pill .cm-drag-handle { cursor:grab; }              /* la poignée ⠿ : main ouverte… */
  body .cm-pill.cm-dragging, body .cm-pill.cm-dragging * { cursor:grabbing; } /* …qui se referme pendant le déplacement */

  /* Halo du mode annotation (fiche Bandeau) : trait jaune de 3 px au bord de l'écran, filet sombre de 1 px
     juste à l'intérieur (il cerne le jaune sur le clair et disparaît de lui-même sur le sombre), lueur
     courte. Une seule règle pour tous les sites. Seule l'opacité de la lueur (::after) est animée : rien
     ne se repeint à chaque image. La couche ne capte aucun clic et n'est l'ancêtre d'aucun verre. Elle est
     posée au-dessus du site mais SOUS toutes les couches witmit (815 : la plus basse, les cadres, est à 820). */
  .cm-frame { position:fixed; inset:0; z-index:815; pointer-events:none; visibility:hidden; opacity:0; border:0 solid transparent; }
  .cm-frame.show { visibility:visible; opacity:1; }
  .cm-frame::before, .cm-frame::after { content:''; position:absolute; inset:0; pointer-events:none; border:0 solid transparent; }
  .cm-frame::before { box-shadow: inset 0 0 0 3px var(--wm-accent), inset 0 0 0 4px var(--wm-halo-filet), inset 0 0 10px 2px var(--wm-halo-lueur-courte); }
  .cm-frame::after { box-shadow: inset 0 0 26px 6px var(--wm-halo-lueur); opacity:0; animation: wmHaloSouffle 4s ease-in-out infinite; }
  @keyframes wmHaloSouffle { 0%, 100% { opacity:0; } 50% { opacity:1; } }
  @media (prefers-reduced-motion:reduce) {
    .cm-frame::after { animation:none; opacity:.5; }
  }
  @media (forced-colors:active) {
    .cm-frame::before { border:3px solid Highlight; }
    .cm-popup, .cm-panel, .cm-pill, .cm-status, .cm-toggle-btn { border-color:CanvasText; }
  }

  /* Pastille d'état — flotte sous la navbar par défaut, ne la recouvre jamais, et peut être
     déplacée n'importe où sur la page (comme les panneaux des maquettes) si elle gêne la lecture.
     Aspect intermédiaire : verre aux jetons, sans aplat (bandeau habillé au lot 7). */
  .cm-pill { position:fixed; top:calc(var(--wm-nav-h) + 12px); left:50%; transform:translateX(-50%); z-index:900; background:var(--wm-surface); backdrop-filter:blur(var(--wm-verre-flou)) saturate(1.7); -webkit-backdrop-filter:blur(var(--wm-verre-flou)) saturate(1.7); border:1px solid var(--wm-contour-fenetre); color:var(--wm-ink); font-family:var(--wm-font-outil); font-weight:500; font-size:12px; text-align:center; padding:8px 10px 8px 12px; border-radius:50px; display:none; align-items:center; gap:12px; box-shadow:var(--wm-ombre-fenetre); white-space:nowrap; cursor:default; touch-action:none; }
  .cm-pill.show { display:flex; }
  .cm-pill.cm-dragging .cm-drag-handle { opacity:1; }
  .cm-pill .cm-drag-handle { font-size:14px; opacity:.65; line-height:1; color:var(--wm-ink-soft); }
  .cm-pill button { font-family:var(--wm-font-outil); font-weight:500; font-size:12px; background:var(--wm-face-touche); border:1px solid var(--wm-line-strong); color:var(--wm-ink); border-radius:50px; padding:5px 12px; cursor:pointer; }
  .cm-pill button:hover { border-color:var(--wm-ink); }

  /* Repères sur le site : encre des repères (aspect intermédiaire ; fiche Reperes au lot 6). */
  .cm-pin { position:absolute; width:24px; height:24px; border-radius:50% 50% 50% 4px; background:var(--wm-encre-repere); color:var(--wm-encre-repere-claire); font-family:var(--wm-font-outil); font-weight:600; font-size:11px; display:flex; align-items:center; justify-content:center; transform:translate(-50%,-100%) rotate(-45deg); box-shadow:0 0 0 1px var(--wm-encre-repere-claire), 0 3px 10px rgba(0,0,0,0.28); z-index:840; cursor:pointer; }
  .cm-pin span { transform:rotate(45deg); }
  .cm-pin:hover { filter:brightness(1.25); }
  /* Pastilles réduites des autres éléments d'une sélection multiple (même numéro) */
  .cm-pin { transition:background-color 600ms ease; }
  .cm-pin.cm-pin-secondary { width:18px; height:18px; font-size:9px; opacity:.85; }
  /* Survol d'une pastille : les cadres du même commentaire s'allument */
  /* Ticket traité : repères en pointillés et discrets */
  .cm-box-saved.cm-done { border-style:dashed; opacity:.6; }
  .cm-pin.cm-done { opacity:.55; }
  #cmLinks line.cm-done { opacity:.35; }
  /* Commentaire actif (bulle ouverte) : métal clair, plus marqué ; encre claire sur fond sombre */
  .cm-box-saved.cm-focus { border-width:2.5px; }
  .cm-pin.cm-focus { background:linear-gradient(180deg, var(--wm-metal-light-hi), var(--wm-metal-light-lo)); color:var(--wm-encre-repere); box-shadow:0 0 0 1px var(--wm-encre-repere), 0 3px 10px rgba(0,0,0,0.28); }
  #cmLinks line.cm-focus { stroke-width:1.5; opacity:.95; }
  .cm-box-saved.cm-focus.cm-focus-light { border-color:var(--wm-encre-repere-claire); }
  #cmLinks line.cm-focus.cm-focus-light { stroke:var(--wm-encre-repere-claire); }
  .cm-box-saved.cm-glow { outline:3px solid var(--wm-encre-repere); outline-offset:1px; }
  .cm-box-saved.cm-glow.cm-glow-light { outline-color:var(--wm-encre-repere-claire); }
  .cm-pin.cm-glow { filter:brightness(1.3); }
  #cmLinks { position:absolute; left:0; top:0; pointer-events:none; z-index:835; overflow:visible; }
  #cmLinks line { stroke:var(--wm-encre-repere); stroke-width:1; stroke-dasharray:3 3; opacity:.55; }
  body:not(.cm-active) #cmLinks { display:none; }

  /* Contour d'un encadré sélectionné par glisser-déposer (pendant le drag, puis conservé comme repère si le commentaire est enregistré) */
  .cm-box { position:absolute; border:2px dashed var(--wm-encre-repere); background:transparent; border-radius:6px; z-index:820; pointer-events:none; box-sizing:border-box; }
  .cm-box.cm-box-saved { border-style:solid; transition:border-color 600ms ease; }
  .cm-box-saved.cm-focus, .cm-pin.cm-focus { transition:none; } /* entrée immédiate, sortie fondue */
  .cm-box.cm-box-outline { border-width:1.5px; background:transparent; border-radius:4px; }
  /* Encadré ajustable tant que sa bulle est ouverte : déplaçable au centre, 8 poignées pour redimensionner */
  .cm-box.cm-box-editable { pointer-events:auto; touch-action:none; z-index:830; }
  body .cm-box.cm-box-editable { cursor:move; }
  .cm-handle { position:absolute; box-sizing:border-box; }
  /* Seul repère visible : le petit grip à deux traits de l'angle bas-droit (comme celui d'une zone de texte) */
  .cm-handle-se { width:14px; height:14px; right:1px; bottom:1px;
    background: linear-gradient(135deg, transparent 0 55%, var(--wm-encre-repere) 55% 62%, transparent 62% 76%, var(--wm-encre-repere) 76% 83%, transparent 83%); opacity:.9; }
  .cm-focus-light .cm-handle-se { background: linear-gradient(135deg, transparent 0 55%, var(--wm-encre-repere-claire) 55% 62%, transparent 62% 76%, var(--wm-encre-repere-claire) 76% 83%, transparent 83%); }
  /* Autres coins : invisibles, saisissables ; de petits points apparaissent au survol de l'encadré */
  .cm-handle-nw, .cm-handle-ne, .cm-handle-sw { width:10px; height:10px; }
  .cm-handle-nw::after, .cm-handle-ne::after, .cm-handle-sw::after { content:''; position:absolute; inset:2px; border-radius:50%; background:var(--wm-encre-repere); opacity:0; transition:opacity 150ms; }
  .cm-focus-light .cm-handle-nw::after, .cm-focus-light .cm-handle-ne::after, .cm-focus-light .cm-handle-sw::after { background:var(--wm-encre-repere-claire); }
  .cm-box-editable:hover .cm-handle-nw::after, .cm-box-editable:hover .cm-handle-ne::after, .cm-box-editable:hover .cm-handle-sw::after { opacity:.7; }
  /* côtés : zones de saisie invisibles (le curseur change) */
  .cm-handle-n, .cm-handle-s { left:8px; right:8px; height:8px; }
  .cm-handle-e, .cm-handle-w { top:8px; bottom:8px; width:8px; }
  body .cm-ui .cm-handle-nw { left:-5px; top:-5px; cursor:nwse-resize; } body .cm-ui .cm-handle-se { cursor:nwse-resize; }
  body .cm-ui .cm-handle-ne { right:-5px; top:-5px; cursor:nesw-resize; } body .cm-ui .cm-handle-sw { left:-5px; bottom:-5px; cursor:nesw-resize; }
  body .cm-ui .cm-handle-n { top:-4px; cursor:ns-resize; } body .cm-ui .cm-handle-s { bottom:-4px; cursor:ns-resize; }
  body .cm-ui .cm-handle-w { left:-4px; cursor:ew-resize; } body .cm-ui .cm-handle-e { right:-4px; cursor:ew-resize; }
  /* Hors mode annotation, la page redevient propre : repères masqués, réaffichés à l'activation. */
  body:not(.cm-active) .cm-pin, body:not(.cm-active) .cm-box.cm-box-saved { display:none; }
  body:not(.cm-active) mark.cm-highlight { text-decoration:none; }
  /* Onde douce autour du cadre quand on cherche un commentaire depuis la liste (encre des repères ;
     claire sur fond sombre) — aspect intermédiaire, l'onde de la fiche Reperes vient au lot 6. */
  .cm-ola { animation: cmOla 1s ease-out 2; }
  @keyframes cmOla { 0% { outline:2px solid var(--wm-encre-repere); outline-offset:0; } 100% { outline:2px solid transparent; outline-offset:16px; } }
  .cm-ola-light { animation: cmOlaLight 1s ease-out 2; }
  @keyframes cmOlaLight { 0% { outline:2px solid var(--wm-encre-repere-claire); outline-offset:0; } 100% { outline:2px solid transparent; outline-offset:16px; } }
  @media (prefers-reduced-motion:reduce) { .cm-ola, .cm-ola-light { animation:none; } }
  /* Contour "en cours d'édition" — reste affiché tant que le popup lié est ouvert (Enregistrer,
     Annuler ou un clic ailleurs le referment), pour qu'on sache toujours à quel objet le commentaire
     en cours de saisie est rattaché. */
  .cm-box.cm-box-editing { border-style:solid; border-width:2.5px; border-color:var(--wm-encre-repere); }
  .cm-box.cm-box-editing.cm-focus-light { border-color:var(--wm-encre-repere-claire); }

  /* Passage de texte : souligné à la couleur du texte lui-même (lisible sur tout fond), sans aplat. */
  mark.cm-highlight { text-decoration:underline 2px currentColor; text-underline-offset:4px; text-decoration-skip-ink:none; border-radius:0; padding:0; box-decoration-break:clone; -webkit-box-decoration-break:clone; }

  /* Fenêtre de saisie : verre aux jetons (aspect intermédiaire ; fiche Fenetre au lot 4). */
  .cm-popup { position:absolute; z-index:950; width:260px; background:var(--wm-surface); backdrop-filter:blur(var(--wm-verre-flou)) saturate(1.7); -webkit-backdrop-filter:blur(var(--wm-verre-flou)) saturate(1.7); border:1px solid var(--wm-contour-fenetre); border-radius:12px; box-shadow:var(--wm-ombre-fenetre); padding:12px; color:var(--wm-ink); }
  .cm-popup .cm-zone { cursor:move; touch-action:none; font-family:var(--wm-font-titre); font-size:12px; font-weight:700; color:var(--wm-ink); margin-bottom:6px; max-height:48px; overflow-y:auto; }
  .cm-popup textarea { width:100%; min-height:70px; resize:vertical; border:1px solid var(--wm-line); border-radius:8px; padding:8px; font-family:var(--wm-font-voix); font-size:14px; font-weight:500; line-height:1.45; color:var(--wm-ink); background:var(--wm-surface-raised); margin-bottom:8px; box-sizing:border-box; }
  .cm-popup .cm-cat-row { display:flex; align-items:center; gap:6px; margin:-2px 0 8px; }
  .cm-popup .cm-cat { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; font-family:var(--wm-font-outil); font-size:12px; color:var(--wm-ink); background:var(--wm-face-touche); border:1px solid var(--wm-line); border-radius:7px; padding:5px 6px; }
  .cm-popup .cm-cat-auto { flex-shrink:0; font-family:var(--wm-font-outil); font-size:12px; font-weight:500; color:var(--wm-ink-soft); border:1px solid var(--wm-line); border-radius:var(--wm-radius-repere); padding:1px 6px; }
  .cm-popup .cm-popup-actions { display:flex; gap:8px; justify-content:flex-end; }
  .cm-popup button { font-family:var(--wm-font-outil); font-size:12px; font-weight:500; border-radius:7px; padding:6px 12px; border:1px solid transparent; cursor:pointer; background:transparent; color:var(--wm-ink); }
  .cm-popup .cm-cancel { background:transparent; color:var(--wm-ink-soft); }
  .cm-popup .cm-cancel:hover { color:var(--wm-ink); }
  .cm-popup .cm-save { background:var(--wm-face-touche); border-color:var(--wm-line-strong); color:var(--wm-ink); font-weight:600; }
  .cm-popup .cm-save:hover { border-color:var(--wm-ink); }
  .cm-popup .cm-delete { background:transparent; color:var(--wm-ink-soft); margin-right:auto; padding:6px 8px; }
  .cm-popup .cm-delete:hover { color:var(--wm-ink); text-decoration:underline 1px var(--wm-signal); text-underline-offset:3px; }

  /* Liste des retours : verre aux jetons (aspect intermédiaire ; fiche Tiroir au lot 5). */
  .cm-panel { position:fixed; top:0; right:0; height:100vh; width:300px; max-width:86vw; z-index:850; background:var(--wm-surface); backdrop-filter:blur(var(--wm-verre-flou)) saturate(1.7); -webkit-backdrop-filter:blur(var(--wm-verre-flou)) saturate(1.7); border-left:1px solid var(--wm-contour-fenetre); box-shadow:var(--wm-ombre-fenetre); color:var(--wm-ink); display:flex; flex-direction:column; transform:translateX(100%); transition:transform 240ms cubic-bezier(0.16, 1, 0.3, 1); }
  .cm-panel.show { transform:translateX(0); }
  .cm-panel-head { padding:16px 16px 12px; border-bottom:1px solid var(--wm-line); }
  .cm-panel-head-row { display:flex; align-items:center; justify-content:space-between; font-family:var(--wm-font-titre); font-weight:700; font-size:15px; color:var(--wm-ink); }
  .cm-panel-head-row #cmPanelCount { font-family:var(--wm-font-compteur); font-weight:900; }
  .cm-panel-head-row button { background:none; border:none; color:var(--wm-ink-soft); cursor:pointer; font-size:16px; line-height:1; }
  .cm-panel-head-row button:hover { color:var(--wm-ink); }
  .cm-panel-head-btns { display:flex; align-items:center; gap:10px; }
  .cm-panel-head-row .cm-hide-widget { font-family:var(--wm-font-outil); font-size:11px; font-weight:500; border:1px solid var(--wm-line); border-radius:10px; padding:3px 9px; color:var(--wm-ink-soft); }
  .cm-panel-head-row .cm-hide-widget:hover { border-color:var(--wm-line-strong); color:var(--wm-ink); }
  .cm-panel-sub { font-size:11px; color:var(--wm-ink-soft); margin-top:3px; }
  .cm-panel-author { font-size:11px; color:var(--wm-ink-soft); margin-top:4px; }
  .cm-panel-list { overflow-y:auto; padding:8px; flex:1; }
  .cm-panel-item { display:flex; gap:8px; padding:9px 8px; border-radius:9px; }
  .cm-panel-item:hover { background:var(--wm-surface-raised); }
  .cm-panel-item.cm-current { background:var(--wm-surface-raised); box-shadow:inset 3px 0 0 var(--wm-ink); }
  .cm-panel-item.cm-current .num { background:var(--wm-ink); color:var(--wm-encre-repere-claire); border-color:var(--wm-ink); }
  body[data-wm-theme="client-sombre"] .cm-panel-item.cm-current .num { color:var(--wm-encre-repere); } /* chiffre dans l'encre de l'autre thème */
  .cm-panel-item .num { flex-shrink:0; width:20px; height:20px; border-radius:var(--wm-radius-numero); background:transparent; border:1px solid var(--wm-line-strong); color:var(--wm-ink); font-size:10.5px; font-weight:600; display:flex; align-items:center; justify-content:center; font-family:var(--wm-font-outil); margin-top:1px; }
  .cm-panel-item .body { flex:1; min-width:0; cursor:pointer; }
  .cm-panel-item .zone { font-size:10.5px; color:var(--wm-ink-soft); font-weight:600; margin-bottom:2px; }
  .cm-panel-item textarea.cm-inline-edit { width:100%; box-sizing:border-box; resize:none; border:1px solid var(--wm-line-strong); border-radius:6px; padding:5px 6px; font-family:var(--wm-font-voix); font-size:13px; font-weight:500; line-height:1.4; color:var(--wm-ink); background:var(--wm-surface-raised); }
  .cm-panel-item .cm-meta { display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px; margin-top:5px; }
  .cm-panel-item .cm-cat-chip { font-size:10.5px; color:var(--wm-ink-soft); background:var(--wm-surface-raised); border:1px solid var(--wm-line); border-radius:10px; padding:1px 7px; white-space:nowrap; }
  .cm-panel-item details.cm-tech { font-size:10.5px; color:var(--wm-ink-soft); }
  .cm-panel-item details.cm-tech summary { cursor:pointer; list-style:none; }
  .cm-panel-item details.cm-tech summary::before { content:'▸ '; }
  .cm-panel-item details.cm-tech[open] summary::before { content:'▾ '; }
  .cm-panel-item details.cm-tech pre { margin:4px 0 0; padding:6px 8px; font-family:var(--wm-font-outil); font-size:10px; line-height:1.45; white-space:pre-wrap; word-break:break-all; background:var(--wm-surface-raised); border-radius:6px; color:var(--wm-ink-soft); max-height:160px; overflow:auto; }
  .cm-panel-item .txt { font-family:var(--wm-font-voix); font-size:13px; font-weight:500; color:var(--wm-ink); line-height:1.4; word-wrap:break-word; }
  .cm-panel-item .cm-sync-chip { font-size:10.5px; border-radius:10px; padding:1px 7px; white-space:nowrap; border:1px solid var(--wm-line); color:var(--wm-ink-soft); background:var(--wm-surface-raised); }
  .cm-panel-item .cm-sync-chip.cm-sync-sent { color:var(--wm-ink); border-color:var(--wm-line-strong); background:transparent; }
  .cm-panel-item .cm-sync-chip.cm-sync-error { color:var(--wm-ink); border-color:var(--wm-signal); background:transparent; cursor:pointer; }
  .cm-panel-item .cm-status-chip { font-size:10.5px; border-radius:10px; padding:1px 7px; white-space:nowrap; border:1px solid transparent; }
  .cm-panel-item .cm-st-signale { color:var(--wm-ink-soft); background:var(--wm-surface-raised); border-color:var(--wm-line); }
  .cm-panel-item .cm-st-pris_en_compte { color:var(--wm-ink); background:transparent; border-color:var(--wm-line-strong); }
  .cm-panel-item .cm-st-complement { color:var(--wm-ink); background:var(--wm-surface-raised); border-color:var(--wm-line-strong); }
  .cm-panel-item .cm-st-resolu { color:var(--wm-ink-soft); background:var(--wm-surface-raised); }
  .cm-panel-item .cm-feedback { margin-top:5px; font-size:11.5px; line-height:1.4; color:var(--wm-ink-soft); background:var(--wm-surface-raised); border-left:2px solid var(--wm-line-strong); padding:4px 8px; border-radius:0 6px 6px 0; }
  .cm-panel-item .cm-feedback-q { border-left-color:var(--wm-ink); }
  .cm-panel-item img.cm-shot { display:block; max-width:100%; max-height:110px; margin-top:6px; border:1px solid var(--wm-line); border-radius:6px; cursor:zoom-in; background:#fff; }
  .cm-lightbox { position:fixed; inset:0; z-index:990; background:rgba(0,0,0,.72); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; cursor:zoom-out; }
  .cm-lightbox img { max-width:92vw; max-height:86vh; border-radius:8px; box-shadow:0 20px 60px rgba(0,0,0,.5); background:#fff; }
  .cm-lightbox .cm-lightbox-hint { color:var(--wm-encre-repere-claire); font-family:var(--wm-font-outil); font-size:12px; opacity:.8; }
  .cm-panel-item .cm-reply { margin-top:4px; font-size:12px; color:var(--wm-ink-soft); padding-left:6px; }
  .cm-panel-item .cm-when { color:var(--wm-ink-soft); font-size:10.5px; }
  .cm-panel-item .cm-thread { margin-top:5px; display:flex; flex-direction:column; gap:4px; }
  .cm-panel-item .cm-msg { font-size:11.5px; line-height:1.4; color:var(--wm-ink-soft); padding:4px 8px; border-radius:0 6px 6px 0; white-space:pre-wrap; word-break:break-word; }
  .cm-panel-item .cm-msg-equipe { background:var(--wm-surface-raised); border-left:2px solid var(--wm-line-strong); }
  .cm-panel-item .cm-msg-auteur { border-left:2px solid var(--wm-line); margin-left:12px; }
  .cm-panel-item .cm-msg-who { display:block; font-size:10.5px; color:var(--wm-ink-soft); white-space:normal; }
  .cm-panel-item .cm-msg-drop { background:none; border:none; padding:0 2px; color:var(--wm-ink-soft); cursor:pointer; font-size:11px; }
  .cm-panel-item .cm-thread-actions { display:flex; flex-wrap:wrap; gap:6px; margin-top:5px; }
  .cm-panel-item .cm-thread-actions button { font-family:var(--wm-font-outil); font-size:11px; border-radius:8px; padding:2px 8px; border:1px solid var(--wm-line); background:transparent; color:var(--wm-ink-soft); cursor:pointer; }
  .cm-panel-item .cm-thread-actions button:hover { color:var(--wm-ink); border-color:var(--wm-line-strong); }
  .cm-panel-item .reopen { background:none; border:none; color:var(--wm-ink-soft); cursor:pointer; font-size:13px; }
  .cm-panel-item .reopen:hover { color:var(--wm-ink); }
  .cm-panel-item .st.cm-st-locked { display:inline-flex; align-items:center; justify-content:center; background:var(--wm-surface-raised); border-color:var(--wm-line-strong); color:var(--wm-ink); cursor:default; }
  .cm-popup .cm-lock-line { font-size:11px; color:var(--wm-ink-soft); margin:-2px 0 6px; }
  .cm-popup.cm-locked textarea { background:transparent; color:var(--wm-ink-soft); }
  .cm-popup .cm-feedback { font-size:11.5px; line-height:1.4; color:var(--wm-ink-soft); background:var(--wm-surface-raised); border-left:2px solid var(--wm-ink); padding:4px 8px; border-radius:0 6px 6px 0; margin-bottom:6px; }
  .cm-popup .cm-reply-ta { min-height:50px; }
  .cm-panel-item .cm-item-actions { flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:6px; }
  .cm-panel-item .st { width:20px; height:20px; border-radius:50%; border:1.5px solid var(--wm-line-strong); background:transparent; color:transparent; cursor:pointer; font-size:11px; line-height:1; padding:0; }
  .cm-panel-item .st:hover { border-color:var(--wm-ink); color:var(--wm-ink); }
  .cm-panel-item.cm-done .num { opacity:.55; }
  .cm-panel-item.cm-done .zone, .cm-panel-item.cm-done .txt, .cm-panel-item.cm-done .cm-meta { opacity:.55; }
  .cm-panel-sub .cm-hide-done { margin-left:6px; font-family:var(--wm-font-outil); font-size:10px; font-weight:500; border:1px solid var(--wm-line); border-radius:10px; background:transparent; color:var(--wm-ink-soft); padding:1px 7px; cursor:pointer; }
  .cm-panel-sub .cm-hide-done.cm-on, .cm-panel-sub .cm-hide-done:hover { border-color:var(--wm-line-strong); color:var(--wm-ink); }
  .cm-panel-item .del { flex-shrink:0; background:none; border:none; color:var(--wm-ink-soft); cursor:pointer; font-size:13px; }
  .cm-panel-item .del:hover { color:var(--wm-ink); }
  .cm-panel-empty { padding:24px 16px; text-align:center; color:var(--wm-ink-soft); font-size:12.5px; line-height:1.5; }
  .cm-panel-foot { padding:8px 10px; border-top:1px solid var(--wm-line); display:flex; gap:6px; flex-wrap:wrap; }
  .cm-panel-report .cm-scope { flex-basis:100%; display:flex; align-items:center; gap:6px; font-size:11px; color:var(--wm-ink-soft); cursor:pointer; }
  .cm-panel-report .cm-scope input { margin:0; }
  .cm-feedback-box { border-top:1px solid var(--wm-line); padding:10px; background:var(--wm-surface-raised); }
  .cm-feedback-box .cm-feedback-title { font-family:var(--wm-font-titre); font-weight:700; font-size:12px; color:var(--wm-ink); margin-bottom:6px; }
  .cm-feedback-box textarea { width:100%; box-sizing:border-box; min-height:84px; resize:vertical; border:1px solid var(--wm-line); border-radius:8px; padding:6px 8px; font-family:var(--wm-font-outil); font-size:11px; line-height:1.4; color:var(--wm-ink); background:var(--wm-surface-raised); }
  .cm-feedback-box .cm-feedback-actions { display:flex; justify-content:flex-end; gap:6px; margin-top:6px; }
  .cm-feedback-box .cm-feedback-actions button { font-family:var(--wm-font-outil); font-size:11px; font-weight:500; border-radius:8px; padding:6px 10px; border:1px solid var(--wm-line); background:transparent; color:var(--wm-ink-soft); cursor:pointer; }
  .cm-feedback-box .cm-feedback-actions button.primary { background:var(--wm-face-touche); color:var(--wm-ink); border-color:var(--wm-line-strong); font-weight:600; }
  .cm-panel-foot + .cm-panel-foot { border-top:none; padding-top:0; }
  .cm-panel-foot[hidden], .cm-panel-foot button[hidden] { display:none; }
  .cm-panel-foot button { flex:1; font-family:var(--wm-font-outil); font-size:11px; font-weight:500; border-radius:8px; padding:8px 4px; border:1px solid var(--wm-line); background:transparent; color:var(--wm-ink-soft); cursor:pointer; }
  .cm-panel-foot button:hover { border-color:var(--wm-line-strong); color:var(--wm-ink); }
  .cm-panel-foot button.primary { background:var(--wm-face-touche); color:var(--wm-ink); border-color:var(--wm-line-strong); font-weight:600; }
  .cm-panel-foot button.primary:hover { border-color:var(--wm-ink); }

  /* Message d'état (toast) : verre aux jetons (aspect intermédiaire ; fiche Etats au lot 7). */
  .cm-status { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:960; background:var(--wm-surface); backdrop-filter:blur(var(--wm-verre-flou)) saturate(1.7); -webkit-backdrop-filter:blur(var(--wm-verre-flou)) saturate(1.7); border:1px solid var(--wm-contour-fenetre); color:var(--wm-ink); font-family:var(--wm-font-outil); font-size:12.5px; padding:8px 16px; border-radius:20px; box-shadow:var(--wm-ombre-fenetre); opacity:0; pointer-events:none; transition:opacity 200ms ease; white-space:nowrap; max-width:90vw; }
  .cm-status.show { opacity:1; }
  @media (max-width:700px) {
    .cm-panel { width:86vw; }
    .cm-popup { width:80vw; max-width:280px; }
    .cm-pill { max-width:92vw; white-space:normal; text-align:left; }
  }
`;
  var HTML = `
<div class="cm-frame cm-ui" id="cmFrame"></div>

<div class="cm-pill cm-ui" id="cmPill" title="Glisse la pastille pour la déplacer">
  <span class="cm-drag-handle" aria-hidden="true">⠿</span>
  🖊️ Clic = élément · ⌘/Ctrl+clic = plusieurs · Glisser = zone · Maj+glisser = texte
  <button onclick="cmToggle(false)">Terminer</button>
</div>

<div class="cm-panel cm-ui" id="cmPanel">
  <div class="cm-panel-head">
    <div class="cm-panel-head-row">
      <span>Commentaires — <span id="cmPanelCount">0</span></span>
      <span class="cm-panel-head-btns">
        <button class="cm-hide-widget" onclick="cmReveal(false)" id="cmHideBtn" title="Cacher witmit sur ce site (Alt+A / ⌥+A ou ?witmit=on pour le retrouver)" hidden>🙈 Masquer witmit</button>
        <button onclick="cmTogglePanel(false)" aria-label="Fermer">✕</button>
      </span>
    </div>
    <div class="cm-panel-sub" id="cmPanelSub"></div>
    <div class="cm-panel-author" id="cmAuthor" hidden></div>
  </div>
  <div class="cm-panel-list" id="cmList"></div>
  <div class="cm-feedback-box" id="cmFeedbackBox" hidden>
    <div class="cm-feedback-title">Coller un retour</div>
    <textarea placeholder="witmit-retour R-…&#10;&lt;id&gt; pris_en_compte&#10;&lt;id&gt; resolu | ce qui a été fait&#10;&lt;id&gt; complement | question"></textarea>
    <div class="cm-feedback-actions"><button onclick="cmPasteFeedback(false)">Annuler</button><button class="primary" onclick="cmApplyFeedback()">Appliquer</button></div>
  </div>
  <div class="cm-panel-foot cm-panel-tools">
    <button onclick="cmClearAll()">🗑️ Effacer (page)</button>
    <button onclick="cmClearSite()">🧹 Vider tout (site)</button>
    <button onclick="cmPasteFeedback()" id="cmPasteBtn">📥 Coller un retour</button>
  </div>
  <div class="cm-panel-foot cm-panel-report" id="cmReportFoot">
    <label class="cm-scope" title="Par défaut : seulement les nouveautés (tickets nouveaux + réponses aux compléments)"><input type="checkbox" id="cmFullReport"> Rapport complet</label>
    <button onclick="cmExport()">📤 Télécharger</button>
    <button onclick="cmCopy()">📋 Copier</button>
    <button class="primary" onclick="cmSendMail()">📧 Envoyer</button>
  </div>
</div>

<div class="cm-status cm-ui" id="cmStatus"></div>
`;
  var BUTTONS_HTML = `
<button class="cm-toggle-btn cm-ui" onclick="cmToggle()" id="cmToggleBtn" title="Mode commentaire"><span class="cm-btn-off">💬</span><span class="cm-btn-on" style="display:none;">✕</span></button>
<button class="cm-toggle-btn cm-ui" onclick="cmTogglePanel()" id="cmPanelBtn" title="Voir les commentaires de cette page">📋<span class="cm-count-badge" id="cmCount" data-zero="1"></span></button>
`;

  /* Le widget injecte lui-même son style et son interface — la page hôte n'a rien à copier. */
  function injectUI() {
    var style = document.createElement('style');
    style.id = 'cmStyles';
    style.textContent = fontFacesCss() + CSS;
    document.head.appendChild(style);
    var wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    if (!document.getElementById('cmToggleBtn')) {
      var fab = document.createElement('div');
      fab.className = 'cm-fab cm-ui';
      fab.innerHTML = BUTTONS_HTML;
      document.body.appendChild(fab);
    }
  }

  /* ---------- catégories : règles par mots-clés, 100 % locales (aucune IA, rien ne sort) ----------
     La catégorie est proposée d'après le texte du commentaire et reste modifiable dans la bulle. */
  var CATEGORIES = [
    { key: 'bug-visuel',      icon: '🐞', label: 'Bug visuel',
      words: ['casse', 'deborde', 'chevauche', 'decale', 'coupe', 'tronque', 'mal aligne', 'superpose', 'disparait', "ne s'affiche pas", 'ne s affiche pas', 'illisible', 'flou', 'pixelise', 'deforme', 'ecrase'] },
    { key: 'bug-fonctionnel', icon: '⚙️', label: 'Bug fonctionnel',
      words: ['ne marche pas', 'ne fonctionne pas', 'marche pas', 'fonctionne pas', 'erreur', 'plante', 'bloque', 'rien ne se passe', 'impossible de', 'ne repond pas', "ne s'enregistre pas", 'ne s enregistre pas', 'crash', 'boucle', 'bug', 'ne se charge pas', 'ne charge pas', 'pas a jour', 'rafraichi', 'actualise', 'perdu', 'vide'] },
    { key: 'ajustement',      icon: '📐', label: 'Ajustement visuel',
      words: ['trop grand', 'trop petit', 'trop large', 'trop etroit', 'trop haut', 'trop bas', 'plus grand', 'plus petit', 'plus large', 'plus etroit', 'agrandir', 'reduire', 'espace', 'marge', 'align', 'centr', 'couleur', 'police', 'gras', 'taille', 'contraste', 'arrondi', 'ombre', 'bordure', 'padding', 'largeur', 'hauteur'] },
    { key: 'texte',           icon: '✏️', label: 'Texte à changer',
      words: ['faute', 'orthographe', 'typo', 'reformuler', 'remplacer par', 'renommer', 'libelle', 'wording', 'majuscule', 'accent', 'traduire', 'traduction', 'ecrire', 'formulation', 'coquille', 'pluriel', 'singulier'] },
    { key: 'comportement',    icon: '🔁', label: 'Changement de comportement',
      words: ['devrait', 'plutot que', 'au lieu de', 'quand on clique', 'quand je clique', 'a la place', 'ordre', 'enchainement', 'rediriger', 'ouvrir', 'fermer', 'par defaut', 'automatiquement', 'desactiver', 'activer', 'trier', 'filtrer'] },
    { key: 'suggestion',      icon: '💡', label: 'Suggestion',
      words: ['il faudrait', 'ce serait bien', 'idee', 'ajouter', 'proposer', 'on pourrait', 'manque', 'et si', 'pourquoi pas', 'serait mieux', 'penser a', 'prevoir'] },
    { key: 'question',        icon: '❓', label: 'Question',
      words: ['pourquoi', 'comment', 'est-ce que', 'est ce que', "c'est quoi", 'c est quoi', 'a quoi sert', 'que se passe', 'quelle est', 'quel est', 'peut-on', 'peut on'] },
    { key: 'a-classer',       icon: '🏷️', label: 'À classer', words: [] }
  ];
  function categoryOf(key) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].key === key) return CATEGORIES[i];
    return CATEGORIES[CATEGORIES.length - 1];
  }
  function normalizeText(t) {
    return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
  }
  function categorize(text) {
    var t = normalizeText(text);
    if (!t) return 'a-classer';
    var scores = {}, best = null, bestScore = 0;
    CATEGORIES.forEach(function (cat) {
      var n = 0;
      cat.words.forEach(function (w) { if (t.indexOf(w) >= 0) n++; });
      scores[cat.key] = n;
      if (n > bestScore) { bestScore = n; best = cat.key; } // à égalité : l'ordre du tableau (premier gagne)
    });
    // Une négation « ne … pas » / « n'… pas » sans autre indice = quelque chose ne fait pas ce qu'il devrait
    if (bestScore === 0 && /\b(?:ne (?:se |s')?\w+ pas|n'\w+ pas)\b/.test(t)) { scores['bug-fonctionnel'] = 1; bestScore = 1; best = 'bug-fonctionnel'; }
    // Le « ? » final ne vaut « question » que si aucun mot de bug / ajustement n'est présent
    if (/\?\s*$/.test(t) && !scores['bug-visuel'] && !scores['bug-fonctionnel'] && !scores['ajustement']) {
      if (!best || best === 'suggestion' || best === 'comportement' || best === 'texte') return 'question';
    }
    return best || 'a-classer';
  }
  window.cmCategorize = categorize; // exposé pour les tests

  /* ---------- erreurs console récentes : mémorisées dès le chargement du script ----------
     (le script est présent dès l'ouverture de la page, donc toutes les erreurs de la visite sont vues,
     mode annotation activé ou non). On garde les 20 dernières, tronquées — jamais envoyées nulle part. */
  var recentErrors = [];
  function noteError(msg) {
    recentErrors.push({ time: new Date().toISOString(), message: String(msg || '').slice(0, 200) });
    if (recentErrors.length > 20) recentErrors.shift();
  }
  window.addEventListener('error', function (e) { noteError(e.message + (e.filename ? ' (' + e.filename.split('/').pop() + ':' + e.lineno + ')' : '')); });
  window.addEventListener('unhandledrejection', function (e) { noteError('Promesse rejetée : ' + (e.reason && (e.reason.message || e.reason))); });
  (function () {
    var orig = console.error;
    console.error = function () {
      try { noteError(Array.prototype.map.call(arguments, function (a) { return (a && a.message) || (typeof a === 'object' ? JSON.stringify(a) : String(a)); }).join(' ')); } catch (err) {}
      return orig.apply(console, arguments);
    };
  })();

  function boot() {
  // Live : caché d'office pendant l'installation (le vrai état est posé à la fin de boot) — aucune couche
  // ne s'affiche un instant, et aucune police n'est téléchargée avant la révélation.
  if (CONFIG.mode === 'live') document.body.classList.add('cm-concealed');
  injectUI();
  renderAuthor();
  initTheme();

  /* ---------- thème : le verre prend l'inverse du fond de la page ----------
     On lit le premier fond opaque de <body>, puis de <html> ; luminance sous 128 = site sombre → verre
     champagne (« client-clair ») ; sinon verre graphite (« client-sombre »). Sans fond opaque, on suit
     prefers-color-scheme. data-host-theme sur la balise <script> impose la réponse. Le résultat est posé
     en data-wm-theme sur <body> (jamais de variable sur :root) : toutes nos couches suivent d'un coup. */
  function hostIsDark() {
    if (CONFIG.hostTheme !== 'auto') return CONFIG.hostTheme === 'dark';
    var cands = [document.body, document.documentElement];
    for (var i = 0; i < cands.length; i++) {
      var m = (getComputedStyle(cands[i]).backgroundColor || '').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?/);
      if (!m) continue;
      var a = m[4] === undefined ? 1 : (/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
      if (a > 0.5) return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) < 128;
    }
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function applyTheme() {
    var t = hostIsDark() ? 'client-clair' : 'client-sombre';
    if (document.body.getAttribute('data-wm-theme') !== t) document.body.setAttribute('data-wm-theme', t);
  }
  // Recalcul : au chargement ; quand le site change son thème (class, style ou data-theme de <html> ou de
  // <body>, puis une seconde fois 300 ms plus tard, le temps d'une transition de fond) ; au changement de
  // prefers-color-scheme ; à chaque ouverture d'une fenêtre. Notre propre attribut n'est pas observé.
  function initTheme() {
    applyTheme();
    var later = null;
    var onChange = function () { applyTheme(); clearTimeout(later); later = setTimeout(applyTheme, 300); };
    if (window.MutationObserver) {
      var mo = new MutationObserver(onChange);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
      mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    }
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    }
  }

  /* ---------- bloc technique d'un ticket : tout est calculé localement, rien de personnel ---------- */
  function browserInfo() {
    var ua = navigator.userAgent || '';
    var name = 'Navigateur';
    if (navigator.brave) name = 'Brave';
    else if (navigator.userAgentData && navigator.userAgentData.brands) {
      var brands = navigator.userAgentData.brands.map(function (b) { return b.brand; }).filter(function (b) { return !/Not.?A.?Brand/i.test(b); });
      name = brands.filter(function (b) { return b !== 'Chromium'; })[0] || brands[0] || name;
    } else if (/Firefox\//.test(ua)) name = 'Firefox';
    else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) name = 'Safari';
    else if (/Edg\//.test(ua)) name = 'Edge';
    else if (/Chrome\//.test(ua)) name = 'Chrome';
    var engine = (ua.match(/(Chrome|Firefox|Version)\/(\d+)/) || [])[0] || '';
    var os = /Mac/i.test(navigator.platform) ? 'macOS' : /Win/i.test(navigator.platform) ? 'Windows' : /Linux/i.test(navigator.platform) ? 'Linux' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : '';
    return { name: name, engine: engine, os: os };
  }
  function themeInfo() {
    var explicit = document.documentElement.getAttribute('data-theme') || document.body.getAttribute('data-theme');
    if (explicit) return explicit;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre (système)' : 'clair (système)';
  }
  function captureTech(c) {
    var selectors = c.targets ? c.targets.map(function (t) { return t.path; }) : (c.anchor && c.anchor.path ? [c.anchor.path] : []);
    var labels = c.targets ? c.targets.map(function (t) { return t.label; }) : [c.zone];
    var b = browserInfo();
    return {
      selectors: selectors,
      labels: labels,
      type: c.type === 'box' ? 'encadré' : c.type === 'text' ? 'texte' : (c.targets ? 'groupe' : 'clic'),
      quote: c.quote || undefined,
      position: c.anchor ? { relX: +(c.anchor.relX || 0).toFixed(3), relY: +(c.anchor.relY || 0).toFixed(3), relW: c.anchor.relW !== undefined ? +c.anchor.relW.toFixed(3) : undefined, relH: c.anchor.relH !== undefined ? +c.anchor.relH.toFixed(3) : undefined } : undefined,
      page: { file: PAGE_FILE, title: document.title || PAGE_TITLE, path: location.pathname }, // pas de paramètres d'URL (peuvent contenir des données)
      viewport: { width: window.innerWidth, height: window.innerHeight, scrollX: Math.round(window.scrollX), scrollY: Math.round(window.scrollY), pixelRatio: window.devicePixelRatio || 1 },
      browser: b.name + (b.engine ? ' (' + b.engine + ')' : ''), os: b.os,
      theme: themeInfo(),
      consoleErrors: recentErrors.slice(-5),
      date: new Date().toISOString()
    };
  }
  function techSummary(tech) {
    if (!tech) return '';
    var lines = [];
    (tech.selectors || []).forEach(function (sel, i) { lines.push((tech.selectors.length > 1 ? 'cible ' + (i + 1) + ' : ' : 'cible : ') + sel); });
    if (tech.quote) lines.push('citation : « ' + tech.quote + ' »');
    lines.push('page : ' + tech.page.file + (tech.page.title ? ' — ' + tech.page.title : ''));
    lines.push('fenêtre : ' + tech.viewport.width + '×' + tech.viewport.height + (tech.viewport.pixelRatio !== 1 ? ' @' + tech.viewport.pixelRatio + 'x' : '') + ' · ' + tech.browser + (tech.os ? ' · ' + tech.os : '') + ' · thème ' + tech.theme);
    if (tech.consoleErrors && tech.consoleErrors.length) {
      lines.push('erreurs console (' + tech.consoleErrors.length + ') :');
      tech.consoleErrors.forEach(function (e) { lines.push('  ' + e.time.slice(11, 19) + ' ' + e.message); });
    }
    return lines.join('\n');
  }

  /* Clé de page des tickets. Maquette (file://) : le nom du fichier, comme avant. Site (http/https) : le
     chemin complet (/adhesion/dons, pas seulement « dons »). La clé est RECALCULÉE à chaque changement
     d'URL (voir « navigation sans rechargement ») : sur une application Next.js/React, cliquer un onglet
     change l'URL sans recharger la page, donc sans relancer ce script. */
  var IS_FILE = location.protocol === 'file:';
  function pageKeyFor(pathname) {
    if (IS_FILE) return ((pathname || '').split('/').pop() || document.title || 'page').toLowerCase();
    var p = (pathname || '/').replace(/\/+$/, '');
    return p || '/';
  }
  var PAGE_FILE = pageKeyFor(location.pathname);
  var PAGE_TITLE = document.title || PAGE_FILE;
  var STORAGE_KEY = 'witmit_' + CONFIG.project + '_v1'; // PARTAGÉ entre toutes les pages du projet ouvertes dans le même navigateur
  var EMAIL_TO = CONFIG.email;

  /* ---------- mode live : widget invisible par défaut sur un site en production ----------
     Révélé par le raccourci (Alt+A / ⌥+A) ou par ?witmit=on dans l'URL, mémorisé dans le navigateur
     (clé REVEAL_KEY) ; ?witmit=off ou le bouton « Masquer witmit » du tiroir le cache et oublie.
     Le paramètre d'URL est retiré aussitôt pour ne pas traîner dans les liens copiés. */
  var REVEAL_KEY = 'witmit_' + CONFIG.project + '_reveal';
  var LIVE = CONFIG.mode === 'live';
  function isRevealed() {
    if (!LIVE) return true;
    try { return localStorage.getItem(REVEAL_KEY) === '1'; } catch (e) { return false; }
  }
  function applyReveal(on) {
    document.body.classList.toggle('cm-concealed', !on);
    if (on && LIVE) prechargerPolices();
    var hideBtn = document.getElementById('cmHideBtn');
    if (hideBtn) hideBtn.hidden = !LIVE;
  }
  window.cmReveal = function (on) {
    if (!LIVE) return;
    on = on !== false;
    try { if (on) localStorage.setItem(REVEAL_KEY, '1'); else localStorage.removeItem(REVEAL_KEY); } catch (e) {}
    if (!on) { cmToggle(false); cmTogglePanel(false); }
    applyReveal(on);
  };
  function readUrlSwitch() {
    if (!LIVE || !location.search) return;
    var params = new URLSearchParams(location.search);
    var v = params.get('witmit');
    if (v === null) return;
    var on = /^(on|1|oui|true)$/i.test(v);
    try { if (on) localStorage.setItem(REVEAL_KEY, '1'); else localStorage.removeItem(REVEAL_KEY); } catch (e) {}
    params.delete('witmit');
    var qs = params.toString();
    try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch (e) {}
  }
  /* ---------- mode live : envoi au guichet (Edge Function submit-annotation) ----------
     Le carnet local (localStorage) reste la copie de secours ; en plus, chaque ticket est envoyé
     au guichet, qui vérifie (identité anonyme, preuve de calcul Altcha, quotas) puis range le ticket
     dans la base witmit. Rien n'est écrit directement dans la base depuis la page.
     Sur chaque ticket : c.sync = { state: 'pending' | 'sent' | 'error', id?, statut?, error?, at } */
  var SYNC = LIVE && !!(CONFIG.supabaseUrl && CONFIG.supabaseKey);
  if (LIVE && !SYNC) console.warn('[witmit] data-mode="live" sans data-supabase-url / data-supabase-key : les tickets restent locaux');
  var SESSION_KEY = 'witmit_identite';      // une identité anonyme par navigateur (partagée par les projets du même site)
  var FN_URL = CONFIG.supabaseUrl + '/functions/v1/submit-annotation';
  var syncQueue = Promise.resolve();          // les envois se suivent (jamais en parallèle : quotas, ordre)

  function sbHeaders(token) {
    var h = { 'apikey': CONFIG.supabaseKey, 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }
  function readSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; } }
  function storeSession(data) {
    var sess = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600), user_id: data.user && data.user.id };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(sess)); } catch (e) {}
    return sess;
  }
  // L'identité anonyme : créée au premier envoi seulement (jamais pour un simple visiteur), renouvelée quand elle expire.
  function getSession() {
    var sess = readSession();
    if (sess && sess.expires_at - 60 > Date.now() / 1000) return Promise.resolve(sess);
    var renew = sess && sess.refresh_token
      ? fetch(CONFIG.supabaseUrl + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: sbHeaders(), body: JSON.stringify({ refresh_token: sess.refresh_token }) })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('refresh ' + r.status)); })
      : Promise.reject(new Error('pas de session'));
    return renew.catch(function () {
      return fetch(CONFIG.supabaseUrl + '/auth/v1/signup', { method: 'POST', headers: sbHeaders(), body: '{}' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('identité refusée (' + r.status + ')')); });
    }).then(storeSession);
  }
  // Le défi Altcha : trouver n tel que sha256(salt + n) = challenge. Calcul dans un ouvrier (Worker) pour ne pas
  // geler la page ; repli sur le fil principal si la page interdit les ouvriers.
  var SOLVER_SRC = "onmessage=async function(e){var c=e.data,enc=new TextEncoder();for(var n=0;n<=c.maxnumber;n++){var h=await crypto.subtle.digest('SHA-256',enc.encode(c.salt+n));var hex=Array.prototype.map.call(new Uint8Array(h),function(b){return('0'+b.toString(16)).slice(-2)}).join('');if(hex===c.challenge){postMessage(n);return}}postMessage(-1)}";
  function solveChallenge(c) {
    return new Promise(function (resolve, reject) {
      var url;
      try {
        url = URL.createObjectURL(new Blob([SOLVER_SRC], { type: 'text/javascript' }));
        var w = new Worker(url);
        w.onmessage = function (e) { w.terminate(); URL.revokeObjectURL(url); e.data >= 0 ? resolve(e.data) : reject(new Error('défi insoluble')); };
        w.onerror = function () { w.terminate(); URL.revokeObjectURL(url); solveInline(c).then(resolve, reject); };
        w.postMessage(c);
      } catch (e) { solveInline(c).then(resolve, reject); }
    }).then(function (n) {
      return btoa(JSON.stringify({ algorithm: c.algorithm, challenge: c.challenge, number: n, salt: c.salt, signature: c.signature }));
    });
  }
  function solveInline(c) {
    var enc = new TextEncoder(), n = 0;
    function step() {
      if (n > c.maxnumber) return Promise.reject(new Error('défi insoluble'));
      return crypto.subtle.digest('SHA-256', enc.encode(c.salt + n)).then(function (h) {
        var hex = Array.prototype.map.call(new Uint8Array(h), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
        if (hex === c.challenge) return n;
        n++; return step();
      });
    }
    return step();
  }
  // Ce qui part au guichet : le texte, la catégorie, la page, et le bloc technique (ancre, cibles, navigateur…).
  // Jamais d'email, jamais de paramètres d'URL. L'auteur seulement si le site hôte l'a déclaré.
  function payloadFor(c) {
    return {
      auteur_nom: c.author || undefined,
      auteur_source: c.author ? 'hote' : undefined,
      projet: CONFIG.project,
      page: c.path || location.pathname || c.page, // la page où le ticket a été créé, pas celle où il est renvoyé
      texte: c.text,
      categorie: c.category,
      id_local: c.id,
      donnees_techniques: { type: c.type, zone: c.zone, pageTitle: c.pageTitle, anchor: c.anchor, fallback: c.fallback, targets: c.targets, quote: c.quote, categoryManual: !!c.categoryManual, tech: c.tech },
      capture: c.shot && c.shot.dataUrl ? c.shot.dataUrl : undefined
    };
  }
  // Un envoi au guichet : identité, défi Altcha résolu, puis le POST (route '' = ticket, '/reponse' = réponse).
  function postGuichet(route, body) {
    var sess;
    return getSession().then(function (s) {
      sess = s;
      return fetch(FN_URL + '/challenge', { headers: sbHeaders(sess.access_token) });
    }).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('défi refusé (' + r.status + ')')); })
      .then(solveChallenge)
      .then(function (preuve) {
        body.altcha = preuve;
        return fetch(FN_URL + route, { method: 'POST', headers: sbHeaders(sess.access_token), body: JSON.stringify(body) });
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) throw new Error(data.erreur || ('erreur ' + r.status));
          return data;
        });
      });
  }
  function sendComment(c) { return postGuichet('', payloadFor(c)); }
  // Point d'entrée : file d'attente, un ticket à la fois ; résultat noté sur le ticket et dans la liste.
  function scheduleSync(c) {
    if (!SYNC || !c || !isEditable(c)) return;
    if (c.sync && c.sync.state === 'pending') return;
    c.sync = { state: 'pending', at: new Date().toISOString() };
    persist(); renderList();
    syncQueue = syncQueue.then(function () {
      var live = findComment(c.id);
      if (!live) return;
      return sendComment(live).then(function (data) {
        live.sync = { state: 'sent', id: data.id, statut: data.statut, at: new Date().toISOString() };
        cmStatus('Ticket envoyé ☁️');
      }).catch(function (err) {
        live.sync = { state: 'error', error: (err && err.message) || 'erreur', at: new Date().toISOString() };
        cmStatus('Envoi impossible (' + live.sync.error + ') — le ticket est gardé en local, nouvel essai plus tard');
      }).then(function () { persist(); renderList(); });
    });
  }
  /* Répondre / rouvrir (mode live) : la réponse attend dans c.replies (comme en mode maquette) jusqu'à ce que
     le guichet l'ait publiée sur l'issue ; elle rejoint alors le fil c.thread. En cas d'échec elle reste là (⚠️),
     renvoyée à l'ouverture du tiroir ou au clic : le texte n'est jamais perdu.
     Sur chaque réponse : r = { id, date, text, rouvrir, sync: null | { state: 'pending' | 'error', error?, at } } */
  function findReply(c, rid) { return (c.replies || []).filter(function (r) { return r.id === rid; })[0]; }
  function scheduleReply(c, r) {
    if (!SYNC || !c.sync || !c.sync.id || (r.sync && r.sync.state === 'pending')) return;
    r.sync = { state: 'pending', at: new Date().toISOString() };
    persist(); renderList();
    syncQueue = syncQueue.then(function () {
      var live = findComment(c.id), lr = live && findReply(live, r.id);
      if (!lr) return;
      return postGuichet('/reponse', { ticket_id: live.sync.id, texte: lr.text, rouvrir: !!lr.rouvrir }).then(function (data) {
        live.replies = live.replies.filter(function (x) { return x !== lr; });
        if (data.message) (live.thread = live.thread || []).push(data.message);
        if (data.rouvert) {
          live.status = 'pris_en_compte'; live.sync.statut = 'en_cours'; delete live.resolvedAt; delete live.resolvedBy; delete live.repondu;
          pushHistory(live, { date: new Date().toISOString(), status: 'pris_en_compte', source: 'moi', message: 'rouvert' });
        }
        cmStatus(data.avertissement ? 'Message envoyé ☁️ — mais ' + data.avertissement.replace(/^message envoyé à l'équipe, mais /, '') : (data.rouvert ? 'Ticket rouvert, l’équipe est prévenue ☁️' : 'Réponse envoyée ☁️'));
      }).catch(function (err) {
        lr.sync = { state: 'error', error: (err && err.message) || 'erreur', at: new Date().toISOString() };
        cmStatus('Envoi impossible (' + lr.sync.error + ') — ton message est gardé, nouvel essai plus tard');
      }).then(function () { persist(); renderList(); renderMarkers(); });
    });
  }
  window.cmRetryReply = function (id, rid) { var c = findComment(id), r = c && findReply(c, rid); if (r) { r.sync = null; scheduleReply(c, r); } };
  window.cmDropReply = function (id, rid) {
    var c = findComment(id), r = c && findReply(c, rid);
    if (!r || (r.sync && r.sync.state === 'pending') || !confirm('Abandonner ce message non envoyé ?')) return;
    c.replies = c.replies.filter(function (x) { return x !== r; });
    persist(); renderList();
    cmStatus('Message abandonné');
  };
  // Renvoie tout ce qui n'est pas parti (hors ligne, quota, erreur) — à l'ouverture du tiroir et au chargement.
  function flushPending() {
    if (!SYNC) return;
    allComments.forEach(function (c) {
      (c.replies || []).forEach(function (r) {
        if (!r.sync || r.sync.state === 'error') scheduleReply(c, r);
        else if (r.sync.state === 'pending' && Date.now() - Date.parse(r.sync.at) > 120000) { r.sync = null; scheduleReply(c, r); }
      });
      if (!isEditable(c)) return;
      if (!c.sync || c.sync.state === 'error') scheduleSync(c);
      else if (c.sync.state === 'pending' && Date.now() - Date.parse(c.sync.at) > 120000) { c.sync = null; scheduleSync(c); } // envoi interrompu (page fermée)
    });
  }
  // Le statut vu du serveur : nouveau → (rien) ; en_cours → « pris en compte » ; resolu → « résolu » ; repondu (issue
  // fermée « non prévue ») → terminé aussi, affiché « répondu » (c.repondu) ; avec le fil des messages (équipe / toi).
  // Un ticket terminé par le serveur puis rouvert (depuis witmit ou GitHub) redevient « pris en compte ».
  function refreshStatuses() {
    if (!SYNC || !readSession()) return Promise.resolve();
    var ids = allComments.filter(function (c) { return c.sync && c.sync.state === 'sent'; }).map(function (c) { return c.id; });
    if (!ids.length) return Promise.resolve();
    return getSession().then(function (sess) {
      var q = '?select=id_local,page,statut,message_retour,mis_a_jour_le,messages(de,texte,rouvre,cree_le)&messages.order=cree_le.asc&projet=eq.' + encodeURIComponent(CONFIG.project) + '&id_local=in.(' + ids.map(encodeURIComponent).join(',') + ')';
      return fetch(CONFIG.supabaseUrl + '/rest/v1/annotations' + q, { headers: sbHeaders(sess.access_token) });
    }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
      var changed = false;
      rows.forEach(function (row) {
        var c = findComment(row.id_local); if (!c || !c.sync) return;
        var thread = Array.isArray(row.messages) ? row.messages : null;
        if (c.sync.statut !== row.statut || (row.message_retour || '') !== (c.feedbackMessage || '')) changed = true;
        // La page enregistrée au serveur fait foi (elle vient de l'URL réelle au moment de l'envoi) :
        // corrige les tickets rangés sous une mauvaise page par les versions précédentes du widget.
        if (!IS_FILE && row.page && c.page !== pageKeyFor(row.page)) { c.page = pageKeyFor(row.page); c.path = row.page; changed = true; }
        if (thread && JSON.stringify(thread) !== JSON.stringify(c.thread || [])) changed = true;
        c.sync.statut = row.statut;
        if (row.message_retour) c.feedbackMessage = row.message_retour;
        if (thread) c.thread = thread;
        var fini = row.statut === 'resolu' || row.statut === 'repondu';
        if (row.statut === 'en_cours' && c.status === 'resolu' && c.resolvedBy === 'serveur') { c.status = 'pris_en_compte'; delete c.resolvedAt; delete c.resolvedBy; delete c.repondu; }
        if (row.statut === 'en_cours' && c.status !== 'resolu') { c.status = 'pris_en_compte'; c.ackAt = c.ackAt || row.mis_a_jour_le; }
        if (fini && c.status !== 'resolu') { c.status = 'resolu'; c.resolvedAt = row.mis_a_jour_le; c.resolvedBy = 'serveur'; }
        if (fini && c.resolvedBy === 'serveur') { if (row.statut === 'repondu') c.repondu = true; else delete c.repondu; }
      });
      if (changed) { persist(); renderList(); renderMarkers(); }
    }).catch(function () {});
  }
  /* Le rapport (Télécharger/Copier/Envoyer) et le retour collé sont le circuit du mode maquette.
     En mode live, tout part au guichet et les statuts reviennent tout seuls : on les cache — sauf s'il
     reste un ticket non envoyé, pour pouvoir quand même le sortir si le serveur est injoignable. */
  function aDuNonEnvoye() {
    return allComments.some(function (c) { return isEditable(c) && (!c.sync || c.sync.state !== 'sent'); });
  }
  function majPiedsTiroir() {
    var cacher = LIVE && !aDuNonEnvoye();
    var foot = document.getElementById('cmReportFoot');
    var paste = document.getElementById('cmPasteBtn');
    if (foot) foot.hidden = cacher;
    if (paste) paste.hidden = cacher;
    if (cacher) { var box = document.getElementById('cmFeedbackBox'); if (box) box.hidden = true; }
  }

  function syncChip(c) {
    if (!SYNC || !c.sync) return SYNC && isEditable(c) ? '<span class="cm-sync-chip" title="Pas encore envoyé">⏳ à envoyer</span>' : '';
    if (c.sync.state === 'sent') return '<span class="cm-sync-chip cm-sync-sent" title="Reçu par witmit le ' + cmEsc(frDate(c.sync.at)) + '">☁️ envoyé</span>';
    if (c.sync.state === 'pending') return '<span class="cm-sync-chip" title="Envoi en cours">⏳ envoi…</span>';
    return '<span class="cm-sync-chip cm-sync-error" onmousedown="event.stopPropagation()" onclick="cmRetrySync(\'' + c.id + '\')" title="' + cmEsc(c.sync.error || 'erreur') + ' — cliquer pour réessayer">⚠️ à renvoyer</span>';
  }
  window.cmRetrySync = function (id) { var c = findComment(id); if (c) { c.sync = null; scheduleSync(c); } };

  var DRAG_THRESHOLD = 10; // px avant de considérer que c'est un glisser plutôt qu'un clic
  var CLICK_DELAY = 250;   // ms d'attente d'un éventuel double-clic avant d'ouvrir la bulle du clic simple

  var allComments = [];    // TOUTES les pages
  var active = false;
  var pendingPopup = null;
  var sessionMarks = {};   // id -> [<mark>] surlignages de texte (vivent seulement le temps de la session)

  var dragging = false;
  var dragStart = null;
  var dragBoxEl = null;

  function uid() {
    return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }
  function cmEsc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }
  function pageComments() {
    // Anciens tickets d'un site (avant la V2.4) : rangés sous le dernier segment de l'URL (« dons »).
    // La relecture des statuts les recale sur le chemin enregistré au serveur.
    var legacy = IS_FILE ? null : PAGE_FILE.split('/').pop();
    return allComments.filter(function (c) { return c.page === PAGE_FILE || (legacy && c.page === legacy); });
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      allComments = raw ? JSON.parse(raw) : [];
      allComments.forEach(function (c) {
        if (!c.id) c.id = uid();
        if (!c.status || c.status === 'traite') { // anciens tickets : « traité » devient « résolu par moi »
          if (c.status === 'traite') { c.status = 'resolu'; c.resolvedAt = c.doneAt || c.date; c.resolvedBy = 'moi'; delete c.doneAt; }
          else c.status = 'nouveau';
        }
      });
    } catch (e) { allComments = []; }
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(allComments)); } catch (e) {}
  }

  /* ---------- ancrage résistant au redimensionnement ----------
     On n'enregistre jamais une position en pixels bruts : on retrouve l'élément conteneur via un
     chemin stable (chaîne de nth-of-type) et on enregistre la position en fraction (0..1) de sa
     boîte. Au chargement et à chaque redimensionnement, on recalcule les pixels à partir de la
     géométrie ACTUELLE du conteneur — la pastille/l'encadré reste donc attaché à l'élément visé. */

  function getStablePath(el) {
    while (el && el.nodeType === 1 && el.classList.contains('cm-highlight')) el = el.parentElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    var path = [];
    var node = el;
    var guard = 0;
    while (node && node !== document.body && node.parentElement && guard < 40) {
      guard++;
      var tag = node.tagName.toLowerCase();
      var parent = node.parentElement;
      var siblings = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === node.tagName; });
      var idx = siblings.indexOf(node) + 1;
      path.unshift(tag + ':nth-of-type(' + idx + ')');
      node = parent;
    }
    return path.length ? path.join(' > ') : null;
  }
  function resolveStablePath(path) {
    if (!path) return null;
    try { return document.querySelector(path); } catch (e) { return null; }
  }

  function anchorForPoint(pageX, pageY, containerEl) {
    var rect = containerEl ? containerEl.getBoundingClientRect() : null;
    if (containerEl && rect && rect.width > 2 && rect.height > 2) {
      return {
        path: getStablePath(containerEl),
        relX: (pageX - (rect.left + window.scrollX)) / rect.width,
        relY: (pageY - (rect.top + window.scrollY)) / rect.height
      };
    }
    var docW = Math.max(document.documentElement.scrollWidth, 1);
    var docH = Math.max(document.documentElement.scrollHeight, 1);
    return { path: null, relX: pageX / docW, relY: pageY / docH };
  }
  function anchorForBox(bx, by, bw, bh, containerEl) {
    var rect = containerEl ? containerEl.getBoundingClientRect() : null;
    if (containerEl && rect && rect.width > 2 && rect.height > 2) {
      var cLeft = rect.left + window.scrollX, cTop = rect.top + window.scrollY;
      return {
        path: getStablePath(containerEl),
        relX: (bx - cLeft) / rect.width, relY: (by - cTop) / rect.height,
        relW: bw / rect.width, relH: bh / rect.height
      };
    }
    var docW = Math.max(document.documentElement.scrollWidth, 1);
    var docH = Math.max(document.documentElement.scrollHeight, 1);
    return { path: null, relX: bx / docW, relY: by / docH, relW: bw / docW, relH: bh / docH };
  }
  function computeAbsolutePoint(anchor, fallback) {
    if (!anchor) return fallback || { x: 20, y: 20 };
    if (anchor.path) {
      var el = resolveStablePath(anchor.path);
      if (el) {
        var r = el.getBoundingClientRect();
        return { x: r.left + window.scrollX + anchor.relX * r.width, y: r.top + window.scrollY + anchor.relY * r.height };
      }
      return fallback || { x: 20, y: 20 };
    }
    var docW = Math.max(document.documentElement.scrollWidth, 1);
    var docH = Math.max(document.documentElement.scrollHeight, 1);
    return { x: anchor.relX * docW, y: anchor.relY * docH };
  }
  function computeAbsoluteBox(anchor, fallback) {
    if (!anchor) return fallback || { x: 20, y: 20, w: 40, h: 40 };
    if (anchor.path) {
      var el = resolveStablePath(anchor.path);
      if (el) {
        var r = el.getBoundingClientRect();
        return {
          x: r.left + window.scrollX + anchor.relX * r.width,
          y: r.top + window.scrollY + anchor.relY * r.height,
          w: anchor.relW * r.width, h: anchor.relH * r.height
        };
      }
      return fallback || { x: 20, y: 20, w: 40, h: 40 };
    }
    var docW = Math.max(document.documentElement.scrollWidth, 1);
    var docH = Math.max(document.documentElement.scrollHeight, 1);
    return { x: anchor.relX * docW, y: anchor.relY * docH, w: anchor.relW * docW, h: anchor.relH * docH };
  }

  /* ---------- rendu des repères (pastilles + encadrés) de la page courante uniquement ----------
     Certaines maquettes sont des formulaires à étapes : plusieurs "étapes" vivent dans le MÊME
     fichier HTML, et une seule est visible à la fois (les autres sont masquées en display:none /
     une classe "active" etc.). Un commentaire reste bien enregistré pour tout le fichier, mais son
     repère ne doit s'afficher que si l'objet visé est actuellement visible à l'écran — sinon les
     pastilles d'une étape précédente restent affichées, mal placées, par-dessus l'étape courante. */

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.offsetParent === null) {
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed') return false;
    }
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /* Dessine un cadre (encadré enregistré, ou contour fin de l'élément visé par une pastille) */
  function drawSavedBox(x, y, w, h, extraClass, id) {
    var box = document.createElement('div');
    box.className = 'cm-box cm-box-saved cm-ui ' + (extraClass || '');
    box.dataset.id = id;
    box.style.left = x + 'px'; box.style.top = y + 'px';
    box.style.width = Math.max(w, 4) + 'px'; box.style.height = Math.max(h, 4) + 'px';
    document.body.appendChild(box);
  }

  function renderMarkers() {
    // Un encadré en cours d'ajustement (poignées visibles) est conservé tel quel : le redessiner ferait
    // "lâcher" la souris en plein glisser.
    var old = document.querySelectorAll('.cm-pin, .cm-box.cm-box-saved:not(.cm-box-editable), #cmLinks');
    for (var i = 0; i < old.length; i++) old[i].remove();
    pageComments().forEach(function (c, i) {
      if (hideDone() && isDone(c)) return;
      var anchorEl = null;
      // Sélection multiple : on ne garde que les cibles actuellement visibles ; la pastille principale va sur la première.
      var multi = null;
      if (c.type === 'pin' && c.targets && c.targets.length > 1) {
        multi = [];
        c.targets.forEach(function (t) { var el = resolveStablePath(t.path); if (isVisible(el)) multi.push(el); });
        multi = multi.filter(function (el) { return !clippedOut(el); });
        if (!multi.length) return;
        anchorEl = multi[0];
      } else if (c.anchor && c.anchor.path) {
        anchorEl = resolveStablePath(c.anchor.path);
        if (!isVisible(anchorEl)) return; // étape/onglet masqué pour l'instant : on n'affiche pas ce repère
        if (c.type !== 'box' && clippedOut(anchorEl)) return; // défilé hors de sa zone visible
      }
      var boxGeom = null;
      if (c.type === 'box') {
        boxGeom = computeAbsoluteBox(c.anchor, c.fallback);
        if (!document.querySelector('.cm-box-editable[data-id="' + c.id + '"]')) drawSavedBox(boxGeom.x, boxGeom.y, boxGeom.w, boxGeom.h, '', c.id);
      }
      if (c.type === 'pin' && anchorEl) {
        // Contour fin persistant autour de chaque objet visé : la pastille seule "flotte" visuellement.
        (multi || [anchorEl]).forEach(function (el) {
          var ar = el.getBoundingClientRect();
          drawSavedBox(ar.left + window.scrollX, ar.top + window.scrollY, ar.width, ar.height, 'cm-box-outline', c.id);
        });
      }
      if (c.type === 'text' && !(sessionMarks[c.id] && sessionMarks[c.id].length)) {
        // Après un rechargement, le surlignage n'existe plus : on retrouve le passage cité et on le re-surligne.
        var quote = c.quote || ((c.zone || '').indexOf('…') < 0 ? (c.zone || '').replace(/^«\s*|\s*»$/g, '') : '');
        var range = quote ? findTextRange(anchorEl || document.body, quote) : null;
        if (range) sessionMarks[c.id] = highlightRange(range);
      }
      /* Ouvre la bulle d'édition de ce commentaire (toutes les pastilles du groupe y mènent) */
      function openEditor(e) {
        e.stopPropagation();
        var outlineTarget = (c.type !== 'box' && c.anchor && c.anchor.path) ? resolveStablePath(c.anchor.path) : null;
        var editPt = computeAbsolutePoint(c.anchor, c.fallback);
        var editMeta = { type: c.type, existing: c, outlineEl: outlineTarget };
        if (multi) {
          editMeta.targets = [];
          c.targets.forEach(function (t) { var el = resolveStablePath(t.path); if (el) editMeta.targets.push({ el: el, label: t.label }); });
          editMeta.outlineEl = editMeta.targets.map(function (t) { return t.el; });
          editPt = pt;
        }
        if (c.type === 'text' && sessionMarks[c.id]) { editMeta.marks = sessionMarks[c.id]; editMeta.outlineEl = null; }
        if (c.type === 'box') {
          editMeta.boxEl = document.querySelector('.cm-box-saved[data-id="' + c.id + '"]');
          editMeta.box = computeAbsoluteBox(c.anchor, c.fallback);
          editPt = { x: editMeta.box.x, y: editMeta.box.y + editMeta.box.h }; // sous l'encadré, pour laisser ses poignées accessibles
        }
        openPopup(editPt.x, editPt.y, c.zone, editMeta);
      }

      var pt;
      if (multi) {
        pt = cornerAnchorPoint(multi[0], 0, 0);
        // Pastilles réduites, même numéro, sur les autres éléments du groupe (+ lignes fines si demandé)
        multi.slice(1).forEach(function (el) {
          var p2 = cornerAnchorPoint(el, 0, 0);
          var sp = document.createElement('div');
          sp.className = 'cm-pin cm-pin-secondary cm-ui';
          sp.dataset.id = c.id;
          sp.style.left = p2.x + 'px'; sp.style.top = p2.y + 'px';
          sp.innerHTML = '<span>' + (i + 1) + '</span>';
          sp.title = c.text;
          sp.onclick = openEditor;
          document.body.appendChild(sp);
          if (CONFIG.multiLines) drawLink(pt, p2, c.id);
        });
      } else if (boxGeom) {
        pt = { x: boxGeom.x + boxGeom.w - 3, y: boxGeom.y + 3 }; // coin haut-droit de l'encadré
      } else if (c.type === 'text' && sessionMarks[c.id] && sessionMarks[c.id].length) {
        var mr = sessionMarks[c.id][0].getBoundingClientRect();
        pt = { x: mr.left + window.scrollX, y: mr.top + window.scrollY }; // début du passage, en haut à gauche : stable même sur plusieurs lignes
      } else {
        pt = computeAbsolutePoint(c.anchor, c.fallback);
      }
      var pin = document.createElement('div');
      pin.className = 'cm-pin cm-ui';
      pin.dataset.id = c.id;
      pin.style.left = pt.x + 'px';
      pin.style.top = pt.y + 'px';
      pin.innerHTML = '<span>' + (i + 1) + '</span>';
      pin.title = c.text;
      pin.onclick = openEditor;
      document.body.appendChild(pin);
    });
    pageComments().forEach(function (c) {
      if (!isDone(c)) return;
      var els = document.querySelectorAll('.cm-box-saved[data-id="' + c.id + '"], .cm-pin[data-id="' + c.id + '"], #cmLinks line[data-id="' + c.id + '"]');
      for (var d = 0; d < els.length; d++) els[d].classList.add('cm-done');
    });
    if (focusedId) applyFocus(focusedId, true);
    if (flashId) applyFocus(flashId, true);
    // Survol d'une pastille : les cadres de son commentaire s'allument (utile pour un groupe d'éléments)
    var pins = document.querySelectorAll('.cm-pin');
    for (var k = 0; k < pins.length; k++) {
      pins[k].onmouseenter = function () { glow(this.dataset.id, true); };
      pins[k].onmouseleave = function () { glow(this.dataset.id, false); };
    }
  }
  function glow(id, on) {
    var frames = document.querySelectorAll('.cm-box-saved[data-id="' + id + '"], .cm-pin[data-id="' + id + '"]');
    for (var i = 0; i < frames.length; i++) {
      frames[i].classList.toggle('cm-glow', on);
      frames[i].classList.toggle('cm-glow-light', on && isDarkBehind(frames[i]));
    }
  }
  /* Ligne fine pointillée entre la pastille principale et une pastille secondaire (option data-multi-lines) */
  function drawLink(a, b, id) {
    var svg = document.getElementById('cmLinks');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'cmLinks'; svg.setAttribute('class', 'cm-ui');
      document.body.appendChild(svg);
    }
    svg.style.width = document.documentElement.scrollWidth + 'px';
    svg.style.height = document.documentElement.scrollHeight + 'px';
    var l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', a.x); l.setAttribute('y1', a.y); l.setAttribute('x2', b.x); l.setAttribute('y2', b.y);
    l.setAttribute('data-id', id);
    svg.appendChild(l);
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { renderMarkers(); positionEditOutline(); }, 150);
  });

  /* ---------- défilement : les repères suivent le contenu ----------
     Les repères sont placés en coordonnées du document. Quand c'est la fenêtre qui défile, ils suivent
     tout seuls ; mais beaucoup d'applications font défiler une ZONE intérieure (liste, panneau, <main>
     en overflow:auto) : la fenêtre ne bouge pas, le contenu si. On écoute donc tous les défilements
     (phase de capture : l'événement scroll ne remonte pas) et on replace les repères, une fois par image. */
  var scrollRaf = null;
  function onAnyScroll(e) {
    var t = e.target;
    if (t && t.nodeType === 1 && inUi(t)) return; // défilement de la liste du tiroir : rien à replacer
    if (t === document || t === document.documentElement || t === document.body || t === window) return; // la fenêtre : déjà suivi
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(function () {
      scrollRaf = null;
      renderMarkers(); positionEditOutline();
    });
  }
  document.addEventListener('scroll', onAnyScroll, true);
  /* Pendant qu'on dessine un encadré ou qu'on sélectionne du texte, un coup de molette déformerait la
     sélection : on bloque le défilement le temps du geste seulement. */
  window.addEventListener('wheel', function (e) { if (active && dragging) e.preventDefault(); }, { passive: false, capture: true });

  /* Un élément sorti de la partie visible de sa zone de défilement : son repère ne doit pas flotter
     par-dessus le reste de la page (en-tête, panneau voisin). */
  function clippedOut(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    var node = el.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      var cs = getComputedStyle(node);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX + cs.overflowY)) {
        var pr = node.getBoundingClientRect();
        if (r.bottom <= pr.top || r.top >= pr.bottom || r.right <= pr.left || r.left >= pr.right) return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  /* ---------- navigation sans rechargement (Next.js, React Router…) ----------
     L'application change l'URL par history.pushState / replaceState / retour arrière, sans recharger la
     page : on recalcule la page courante et on redessine tiroir et repères. Sans ça, les tickets créés
     après un clic d'onglet restaient rangés sous la page de départ (bug du 30/09/2026). */
  function onRouteMaybeChanged() {
    var k = pageKeyFor(location.pathname);
    if (k === PAGE_FILE) return;
    PAGE_FILE = k;
    PAGE_TITLE = document.title || k;
    if (pendingPopup) closePopup(true);
    hideEditOutline();
    Object.keys(sessionMarks).forEach(function (id) { try { unwrapMarks(sessionMarks[id]); } catch (e) {} delete sessionMarks[id]; });
    renderList(); renderMarkers();
  }
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = history[m];
    if (typeof orig !== 'function') return;
    history[m] = function () { var r = orig.apply(this, arguments); setTimeout(onRouteMaybeChanged, 0); return r; };
  });
  window.addEventListener('popstate', function () { setTimeout(onRouteMaybeChanged, 0); });

  /* Recalcule aussi quand LA PAGE ELLE-MÊME change de vue (étape suivante d'un formulaire, onglet,
     accordéon…) — générique, sans dépendre du mécanisme propre à chaque maquette : on observe le
     DOM et on ignore nos propres mutations (pastilles/encadrés/contour, tous marqués "cm-ui") pour
     ne jamais se redéclencher soi-même. */
  function isOwnNode(node) {
    if (!node) return false;
    var el = node.nodeType === 1 ? node : node.parentElement; // un nœud texte (ex. message de statut) compte pour son parent
    return !!(el && (el.classList.contains('cm-ui') || el.classList.contains('cm-highlight') || (el.closest && el.closest('.cm-ui'))));
  }
  var moTimer = null;
  var domObserver = new MutationObserver(function (mutations) {
    var relevant = mutations.some(function (m) {
      if (m.type === 'attributes') {
        if (m.attributeName === 'style' && (m.target === document.documentElement || pushedEls.some(function (r) { return r.el === m.target; }))) return false; // nos propres décalages
        return !isOwnNode(m.target);
      }
      for (var i = 0; i < m.addedNodes.length; i++) if (!isOwnNode(m.addedNodes[i])) return true;
      for (var j = 0; j < m.removedNodes.length; j++) if (!isOwnNode(m.removedNodes[j])) return true;
      return false;
    });
    if (!relevant) return;
    clearTimeout(moTimer);
    moTimer = setTimeout(function () {
      onRouteMaybeChanged();
      // Un tiroir / une barre fixée ouverte par le site APRÈS la liste witmit doit aussi lui faire de la place.
      if (pushWidth) pushPage(pushWidth);
      renderMarkers(); positionEditOutline();
    }, 120);
  });
  domObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'hidden'], childList: true, subtree: true });

  /* ---------- cycle de vie d'un ticket ----------
       nouveau ──(rapport)──▶ signalé ──(retour)──▶ pris en compte ──▶ résolu
                                 │                        │
                                 └──(retour)──▶ complément demandé ──(réponse + rapport)──▶ signalé
       Un ticket qui a quitté « nouveau » n'est plus modifiable (texte, cibles, catégorie) ; seul un
       « complément demandé » accepte une réponse, ajoutée au texte d'origine. Un « signalé » pas encore
       pris en compte peut être rouvert (il redevient nouveau et remplacera l'ancien au prochain rapport).
       Le ✓ manuel = « résolu par moi ». */
  var STATUS = {
    nouveau:        { icon: '',    label: 'Nouveau' },
    signale:        { icon: '🔒', label: 'Signalé' },
    pris_en_compte: { icon: '👁', label: 'Pris en compte' },
    complement:     { icon: '❔', label: 'Complément demandé' },
    resolu:         { icon: '✅', label: 'Résolu' }
  };
  function isDone(c) { return c.status === 'resolu'; }
  function isEditable(c) { return !c.status || c.status === 'nouveau'; }
  function frDate(iso) { try { return new Date(iso).toLocaleDateString('fr-FR'); } catch (e) { return ''; } }
  function statusLabel(c) {
    var st = STATUS[c.status] || STATUS.nouveau;
    if (c.status === 'signale') return st.icon + ' Signalé le ' + frDate(c.signaledAt);
    if (c.status === 'resolu') return st.icon + (c.repondu ? ' Répondu le ' : ' Résolu le ') + frDate(c.resolvedAt) + (c.resolvedBy === 'moi' ? ' (par moi)' : '');
    if (c.status === 'pris_en_compte') return st.icon + ' Pris en compte' + (c.ackAt ? ' le ' + frDate(c.ackAt) : '');
    if (c.status === 'complement') return st.icon + ' Complément demandé' + (c.complementAt ? ' le ' + frDate(c.complementAt) : '');
    return '';
  }
  function pushHistory(c, entry) { (c.history = c.history || []).push(entry); }
  var HIDE_DONE_KEY = 'witmit_hide_done';
  function hideDone() { try { return localStorage.getItem(HIDE_DONE_KEY) === '1'; } catch (e) { return false; } }
  function findComment(id) { return allComments.filter(function (x) { return x.id === id; })[0]; }

  /* ✓ manuel : résolu par moi (depuis n'importe quel statut sauf résolu) */
  window.cmResolve = function (id) {
    var c = findComment(id);
    if (!c || isDone(c)) return;
    if (pendingPopup && pendingPopup._meta && pendingPopup._meta.existing === c) closePopup(true);
    c.status = 'resolu'; c.resolvedAt = new Date().toISOString(); c.resolvedBy = 'moi';
    pushHistory(c, { date: c.resolvedAt, status: 'resolu', source: 'moi' });
    persist(); renderList(); renderMarkers();
    cmStatus('Marqué résolu (par toi) — verrouillé');
  };
  /* Rouvrir un ticket signalé pas encore pris en compte : redevient nouveau, modifiable ; le prochain
     rapport le renverra avec la mention « remplace la version du … » */
  window.cmReopen = function (id) {
    var c = findComment(id);
    if (!c || c.status !== 'signale') return;
    c.supersedes = c.signaledAt;
    c.status = 'nouveau'; delete c.signaledAt;
    pushHistory(c, { date: new Date().toISOString(), status: 'nouveau', source: 'moi', message: 'rouvert' });
    persist(); renderList(); renderMarkers();
    cmStatus('Rouvert — modifiable, sera renvoyé au prochain rapport');
  };
  window.cmToggleHideDone = function () {
    try { localStorage.setItem(HIDE_DONE_KEY, hideDone() ? '0' : '1'); } catch (e) {}
    renderList(); renderMarkers();
  };

  /* Le fil d'un ticket (mode live) : messages de l'équipe et les tiens, puis ceux pas encore partis ;
     sous le fil, « Répondre » (s'il y a au moins un message de l'équipe) et « Ça ne convient pas ? Rouvrir »
     (ticket résolu ou répondu par l'équipe). */
  function canReply(c) { return !!(SYNC && c.sync && c.sync.id && (c.thread || []).some(function (m) { return m.de === 'equipe'; })); }
  function canReopen(c) {
    return !!(SYNC && c.sync && c.sync.id && (c.sync.statut === 'resolu' || c.sync.statut === 'repondu') && c.status === 'resolu' && c.resolvedBy === 'serveur' &&
      !(c.replies || []).some(function (r) { return r.rouvrir; }));
  }
  function threadHtml(c) {
    var msgs = (c.thread || []).map(function (m) {
      var equipe = m.de === 'equipe';
      var who = equipe ? '💬 Équipe' : (m.rouvre ? '↩ Tu as rouvert le ticket' : '↳ Toi');
      return '<div class="cm-msg cm-msg-' + (equipe ? 'equipe' : 'auteur') + '"><span class="cm-msg-who">' + who + ' · ' + cmEsc(frDate(m.cree_le)) + '</span>' + cmEsc(m.texte) + '</div>';
    });
    (c.replies || []).forEach(function (r) {
      var err = r.sync && r.sync.state === 'error';
      var chip = err
        ? '<span class="cm-sync-chip cm-sync-error" onclick="cmRetryReply(\'' + c.id + '\', \'' + r.id + '\')" title="' + cmEsc(r.sync.error) + ' — cliquer pour réessayer">⚠️ à renvoyer</span>' +
          '<button class="cm-msg-drop" onclick="cmDropReply(\'' + c.id + '\', \'' + r.id + '\')" title="Abandonner ce message" aria-label="Abandonner ce message">✕</button>'
        : '<span class="cm-sync-chip" title="Envoi en cours">⏳ envoi…</span>';
      msgs.push('<div class="cm-msg cm-msg-auteur cm-msg-pending"><span class="cm-msg-who">' + (r.rouvrir ? '↩ Tu rouvres le ticket' : '↳ Toi') + ' · ' + cmEsc(frDate(r.date)) + ' ' + chip + '</span>' + cmEsc(r.text) + '</div>');
    });
    var acts = [];
    if (canReply(c)) acts.push('<button class="cm-reply-btn" onclick="cmReplyLive(\'' + c.id + '\', false)">↳ Répondre</button>');
    if (canReopen(c)) acts.push('<button class="cm-reopen-btn" onclick="cmReplyLive(\'' + c.id + '\', true)">Ça ne convient pas ? Rouvrir</button>');
    return (msgs.length ? '<div class="cm-thread" onmousedown="event.stopPropagation()">' + msgs.join('') + '</div>' : '') +
      (acts.length ? '<div class="cm-thread-actions" onmousedown="event.stopPropagation()">' + acts.join('') + '</div>' : '');
  }
  // Ouvre le champ de réponse sous le fil (même champ que la réponse à un complément en mode maquette).
  window.cmReplyLive = function (id, rouvrir) {
    var c = findComment(id);
    var item = document.querySelector('.cm-panel-item[data-id="' + id + '"]');
    if (!c || !item || item.querySelector('textarea') || (rouvrir ? !canReopen(c) : !canReply(c))) return;
    replyInList(item, c, {
      placeholder: rouvrir ? 'Qu’est-ce qui ne va pas ? (obligatoire — Entrée = rouvrir, Échap = annuler)' : 'Ta réponse à l’équipe… (Entrée = envoyer, Échap = annuler)',
      required: rouvrir ? 'Dis ce qui ne va pas pour rouvrir le ticket' : '',
      keepOnBlur: true,
      onSave: function (text) {
        var r = { id: uid(), date: new Date().toISOString(), text: text, rouvrir: !!rouvrir, sync: null };
        (c.replies = c.replies || []).push(r);
        pushHistory(c, { date: r.date, status: c.status, source: 'moi', message: (rouvrir ? 'rouvrir : ' : 'réponse : ') + text });
        persist();
        scheduleReply(c, r);
      }
    });
  };

  function renderList() {
    var pc = pageComments();
    var remaining = pc.filter(function (c) { return !isDone(c); });
    var done = pc.length - remaining.length;
    var list = document.getElementById('cmList');
    var cmCountEl = document.getElementById('cmCount');
    // Le badge du bouton 📋 compte ce qu'il RESTE à traiter sur cette page
    if (cmCountEl) { cmCountEl.textContent = remaining.length || ''; cmCountEl.dataset.zero = remaining.length ? '0' : '1'; }
    var panelBtnEl = document.getElementById('cmPanelBtn');
    if (panelBtnEl) panelBtnEl.classList.toggle('cm-on', remaining.length > 0);
    var panelCountEl = document.getElementById('cmPanelCount');
    if (panelCountEl) panelCountEl.textContent = pc.length;
    var subEl = document.getElementById('cmPanelSub');
    if (subEl) {
      var nPages = {};
      allComments.forEach(function (c) { nPages[c.page] = true; });
      var nPagesCount = Object.keys(nPages).length;
      var siteRemaining = allComments.filter(function (c) { return !isDone(c); }).length;
      subEl.innerHTML = cmEsc(remaining.length + ' restant(s)' + (done ? ' · ' + done + ' résolu(s)' : '') + ' — ' + allComments.length + ' au total sur ' + nPagesCount + ' page(s) du site' + (siteRemaining !== allComments.length ? ' (' + siteRemaining + ' restants)' : '')) +
        (done ? ' <button class="cm-hide-done' + (hideDone() ? ' cm-on' : '') + '" onclick="cmToggleHideDone()">' + (hideDone() ? 'Afficher les résolus' : 'Masquer les résolus') + '</button>' : '');
    }
    if (!pc.length) {
      list.innerHTML = '<div class="cm-panel-empty">Aucun commentaire sur cette page pour l’instant.<br>Active le mode commentaire (bouton 💬 ou ' + SHORTCUT_LABEL + ') puis clique, encadre une zone ou Maj+glisse sur du texte.</div>';
      majPiedsTiroir();
      return;
    }
    var html = '';
    pc.forEach(function (c, i) {
      if (hideDone() && isDone(c)) return;
      html += '<div class="cm-panel-item' + (c.id === focusedId ? ' cm-current' : '') + (isDone(c) ? ' cm-done' : '') + '" data-id="' + c.id + '">' +
        '<div class="num">' + (i + 1) + '</div>' +
        '<div class="body" onmousedown="cmFocusDown(event, \'' + c.id + '\')" title="Voir sur la page et modifier ici">' +
          '<div class="zone">' + typeIcon(c.type) + ' ' + cmEsc(c.zone) + '</div>' +
          '<div class="txt">' + cmEsc(c.text) + '</div>' +
          (c.shot && c.shot.dataUrl ? '<img class="cm-shot" src="' + c.shot.dataUrl + '" alt="Capture" title="Voir la capture" onmousedown="event.stopPropagation()" onclick="cmShowShot(\'' + c.id + '\')">' : '') +
          (SYNC ? '' : c.replies && c.replies.length ? c.replies.map(function (r) { return '<div class="cm-reply">↳ ' + cmEsc(r.text) + ' <span class="cm-when">(' + frDate(r.date) + (r.sentIn ? '' : ', à envoyer') + ')</span></div>'; }).join('') : '') +
          (c.status === 'complement' && c.complementMessage ? '<div class="cm-feedback cm-feedback-q">❔ ' + cmEsc(c.complementMessage) + '</div>' : '') +
          (c.feedbackMessage && c.status !== 'complement' && !(SYNC && c.thread && c.thread.length) ? '<div class="cm-feedback">💬 ' + cmEsc(c.feedbackMessage) + '</div>' : '') +
          (SYNC ? threadHtml(c) : '') +
          '<div class="cm-meta"><span class="cm-cat-chip" title="Catégorie">' + categoryOf(c.category).icon + ' ' + categoryOf(c.category).label + '</span>' +
          syncChip(c) +
          (c.status !== 'nouveau' ? '<span class="cm-status-chip cm-st-' + c.status + '">' + cmEsc(statusLabel(c)) + '</span>' : '') +
          (c.tech ? '<details class="cm-tech" onmousedown="event.stopPropagation()"><summary>détails techniques</summary><pre>' + cmEsc(techSummary(c.tech)) + '</pre></details>' : '') +
          '</div></div>' +
        '<div class="cm-item-actions">' +
          (!isDone(c) ? '<button class="st" onclick="cmResolve(\'' + c.id + '\')" title="Marquer résolu (par moi) — verrouille le ticket" aria-label="Résoudre">✓</button>' : '<span class="st cm-st-locked" title="Résolu — verrouillé">✓</span>') +
          (c.status === 'signale' ? '<button class="reopen" onclick="cmReopen(\'' + c.id + '\')" title="Rouvrir pour corriger (sera renvoyé au prochain rapport)" aria-label="Rouvrir">↩</button>' : '') +
          '<button class="del" onclick="cmDeleteById(\'' + c.id + '\')" aria-label="Supprimer">✕</button>' +
        '</div></div>';
    });
    if (!html) html = '<div class="cm-panel-empty">Tout est résolu sur cette page 🎉</div>';
    list.innerHTML = html;
    majPiedsTiroir();
  }

  /* Clic sur un commentaire de la liste : on active le mode (les repères ne sont visibles qu'en mode
     annotation), on fait défiler jusqu'au repère et on le fait clignoter pour le retrouver d'un coup d'œil. */
  /* Sélection d'un item à l'APPUI de la souris (pas au relâchement) : si un autre item était en cours
     d'édition, sa fermeture décale la liste et le relâchement tomberait ailleurs. */
  window.cmFocusDown = function (e, id) {
    if (e.target && e.target.tagName === 'TEXTAREA') return; // clic dans le champ déjà ouvert : placement du curseur normal
    if (e.button !== 0) return;
    e.preventDefault(); // garde le focus dans le champ d'édition qu'on va ouvrir
    cmFocus(id);
  };

  window.cmFocus = function (id) {
    if (!active) cmToggle(true);
    closePopup(true);
    renderMarkers();
    setFocused(id);
    var frame = document.querySelector('.cm-box-saved[data-id="' + id + '"]');
    var targets = frame ? [frame] : (sessionMarks[id] || []);
    var pin = document.querySelector('.cm-pin[data-id="' + id + '"]');
    var scrollEl = targets[0] || pin;
    if (scrollEl) {
      scrollEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      var olaClass = isDarkBehind(scrollEl) ? 'cm-ola-light' : 'cm-ola';
      targets.forEach(function (el) {
        el.classList.remove('cm-ola', 'cm-ola-light');
        void el.offsetWidth;
        el.classList.add(olaClass);
        setTimeout(function () { el.classList.remove(olaClass); }, 2100);
      });
    } else {
      cmStatus('Repère non visible sur cette vue (étape ou onglet masqué ?)');
    }
    editInList(id);
  };

  /* Complément demandé : on répond dans la liste (le texte d'origine n'est pas modifié). La réponse
     partira dans le prochain rapport. */
  function addReply(c, text) {
    if (!text) return false;
    (c.replies = c.replies || []).push({ date: new Date().toISOString(), text: text });
    pushHistory(c, { date: new Date().toISOString(), status: 'complement', source: 'moi', message: 'réponse : ' + text });
    persist(); renderList(); renderMarkers();
    cmStatus('Réponse enregistrée — elle partira dans le prochain rapport');
    return true;
  }
  /* opts (mode live, répondre / rouvrir) : placeholder, required (message si vide : le champ reste ouvert),
     keepOnBlur (cliquer ailleurs n'envoie rien : un message publié ne doit pas partir par mégarde), onSave(texte). */
  function replyInList(item, c, opts) {
    opts = opts || {};
    var meta = item.querySelector('.cm-meta');
    var ta = document.createElement('textarea');
    ta.className = 'cm-inline-edit cm-inline-reply';
    ta.placeholder = opts.placeholder || 'Ta réponse au complément demandé… (Entrée = enregistrer, Échap = annuler)';
    meta.parentNode.insertBefore(ta, meta);
    ta.focus();
    var finished = false;
    function finish(save) {
      if (finished) return;
      var v = ta.value.trim();
      if (save && !v && opts.required) { cmStatus(opts.required); return; }
      finished = true;
      if (save && v) { if (opts.onSave) { ta.remove(); opts.onSave(v); } else addReply(c, v); }
      else ta.remove();
    }
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    ta.addEventListener('blur', function () { if (!opts.keepOnBlur) finish(true); });
  }

  /* Modification du texte directement dans la liste : Entrée = enregistrer, Maj+Entrée = nouvelle
     ligne, Échap = annuler, clic ailleurs = enregistrer. */
  function editInList(id) {
    var item = document.querySelector('.cm-panel-item[data-id="' + id + '"]');
    if (!item || item.querySelector('textarea')) return;
    var c = findComment(id);
    if (!c) return;
    if (c.status === 'complement') { replyInList(item, c); return; }
    if (!isEditable(c)) { cmStatus(statusLabel(c) + ' — non modifiable'); return; }
    var txt = item.querySelector('.txt');
    var ta = document.createElement('textarea');
    ta.className = 'cm-inline-edit';
    ta.value = c.text;
    txt.replaceWith(ta);
    ta.style.height = Math.max(ta.scrollHeight, 40) + 'px';
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    var finished = false;
    function finish(save) {
      if (finished) return;
      finished = true;
      var v = ta.value.trim();
      if (save && v && v !== c.text) { c.text = v; persist(); cmStatus('Commentaire modifié'); c.sync = null; scheduleSync(c); }
      // On remet le texte en place SANS redessiner la liste : un clic en cours sur un autre item
      // (qui a provoqué ce blur) doit atteindre sa cible.
      var div = document.createElement('div');
      div.className = 'txt';
      div.textContent = c.text;
      ta.replaceWith(div);
      if (save && v && v === c.text) renderMarkers(); // met à jour l'info-bulle des pastilles
    }
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight, 40) + 'px'; });
    ta.addEventListener('blur', function () { finish(true); });
  }

  /* Après un ENREGISTREMENT : le repère du commentaire reste à l'état « actif » ~1 s, puis revient au repos
     en fondu avec une onde — on voit ce qu'on vient de commenter (rien de tel pour Annuler/Échap). Les éléments sont créés
     directement à l'état actif (flashId) pour que l'effet soit net même si les repères sont redessinés. */
  var flashId = null, flashTimer = null;
  function flashSaved(id) {
    clearTimeout(flashTimer);
    flashId = id;
    applyFocus(id, true);
    flashTimer = setTimeout(function () {
      flashId = null;
      if (focusedId === id) return; // rouvert entre-temps : reste en couleur "actif"
      var els = document.querySelectorAll('.cm-box-saved[data-id="' + id + '"], .cm-pin[data-id="' + id + '"], #cmLinks line[data-id="' + id + '"]');
      for (var i = 0; i < els.length; i++) {
        var el = els[i], light = el.classList.contains('cm-focus-light');
        el.classList.remove('cm-focus', 'cm-focus-light');
        if (el.classList.contains('cm-box-saved')) el.classList.add(light ? 'cm-ola-light' : 'cm-ola');
      }
      setTimeout(function () {
        var done = document.querySelectorAll('.cm-box-saved[data-id="' + id + '"]');
        for (var j = 0; j < done.length; j++) done[j].classList.remove('cm-ola', 'cm-ola-light');
      }, 2100);
    }, 1000);
  }

  /* Commentaire "actif" (bulle ouverte ou sélectionné dans la liste) : ses cadres, pastilles et lignes changent de couleur */
  var focusedId = null;
  function applyFocus(id, on) {
    var els = document.querySelectorAll('.cm-box-saved[data-id="' + id + '"], .cm-pin[data-id="' + id + '"], #cmLinks line[data-id="' + id + '"]');
    for (var i = 0; i < els.length; i++) {
      els[i].classList.toggle('cm-focus', on);
      els[i].classList.toggle('cm-focus-light', on && isDarkBehind(els[i]));
    }
  }
  function setFocused(id) {
    if (focusedId && focusedId !== id) applyFocus(focusedId, false);
    focusedId = id || null;
    if (focusedId) applyFocus(focusedId, true);
    // et dans la liste : l'item correspondant est mis en évidence
    var items = document.querySelectorAll('.cm-panel-item');
    for (var i = 0; i < items.length; i++) items[i].classList.toggle('cm-current', items[i].dataset.id === focusedId);
  }

  /* Le fond derrière un repère est-il sombre ? (premier ancêtre avec une couleur de fond opaque) */
  function isDarkBehind(el) {
    var node = el;
    while (node && node !== document.documentElement) {
      var bg = getComputedStyle(node).backgroundColor;
      var m = bg && bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (m && (m[4] === undefined || parseFloat(m[4]) > 0.5) && !(node.classList && node.classList.contains('cm-ui'))) {
        return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) < 128;
      }
      node = node.parentElement;
    }
    var hb = getComputedStyle(document.documentElement).backgroundColor.match(/\d+/g);
    return !!(hb && hb.length >= 3 && (0.2126 * hb[0] + 0.7152 * hb[1] + 0.0722 * hb[2]) < 128 && (hb.length < 4 || parseFloat(hb[3]) > 0.5));
  }

  window.cmDeleteById = function (id) {
    if (sessionMarks[id]) { unwrapMarks(sessionMarks[id]); delete sessionMarks[id]; }
    allComments = allComments.filter(function (c) { return c.id !== id; });
    persist(); renderMarkers(); renderList();
  };
  window.cmClearAll = function () {
    var pc = pageComments();
    if (!pc.length) return;
    pc.forEach(function (c) { if (sessionMarks[c.id]) { unwrapMarks(sessionMarks[c.id]); delete sessionMarks[c.id]; } });
    var ids = {}; pc.forEach(function (c) { ids[c.id] = true; });
    allComments = allComments.filter(function (c) { return !ids[c.id]; });
    persist(); renderMarkers(); renderList();
    cmStatus('Commentaires de cette page effacés');
  };
  /* Vide le stockage PARTAGÉ (toutes les pages/fichiers du site, pas seulement celle-ci) —
     utile pour repartir propre quand d'anciens fichiers de test (noms différents) ont laissé
     des commentaires orphelins dans le rapport site-wide. */
  window.cmClearSite = function () {
    if (!allComments.length) { cmStatus('Rien à vider — le site est déjà vide'); return; }
    var nPages = {};
    allComments.forEach(function (c) { nPages[c.page] = true; });
    var nPagesCount = Object.keys(nPages).length;
    var ok = window.confirm(
      'Supprimer les ' + allComments.length + ' commentaire(s) sur les ' + nPagesCount +
      ' page(s) du site (pas seulement cette page) ?\nAction irréversible.'
    );
    if (!ok) return;
    Object.keys(sessionMarks).forEach(function (id) { unwrapMarks(sessionMarks[id]); });
    sessionMarks = {};
    allComments = [];
    persist(); renderMarkers(); renderList();
    cmStatus('Tous les commentaires du site ont été supprimés');
  };

  /* ---------- détection de zone : générique, valable sur n'importe quelle page ----------
     Deux idées, dans cet ordre, pour viser ce qu'un humain "voit" :
       - du TEXTE : tout élément qui contient directement du texte est ciblable tel quel, quelle que
         soit sa balise ou sa classe (pas seulement <p>, <h1>… ni une liste de classes connues) ;
       - une BOÎTE : quand on clique dans le vide d'un bloc, on remonte à la boîte visuelle la plus
         proche — celle qui a un fond, une bordure ou une ombre (ce que l'œil appelle une "carte").
     La liste de motifs de classe (card, panel, section…) reste en secours pour les blocs sans style
     propre. Le dernier recours n'est JAMAIS le nom de balise ("div") — c'est un extrait du texte réel. */

  var CARD_SELECTOR =
    '.fcard, .field, .recap-block, .navbar, .sticky-actions, .step, section, header, .mock-controls, ' +
    '[class*="card"], [class*="-panel"], [class*="section"], [class*="-item"], [class*="block"], [class*="drawer"], [class*="hero"]';
  var ATOMIC_SELECTOR =
    'button, a, input, select, textarea, label, summary, ' +
    '[class*="icon"], [class*="badge"], [class*="chip"], [class*="tag"], [class*="pill"], svg';
  var TITLE_SELECTOR =
    '.fcard-title, .field-label, .recap-block-title, [class*="title"], [class*="-lbl"], [class*="label"], [class*="name"], h1, h2, h3, h4, legend, caption';

  function isTextLeaf(el) {
    if (!el || el.nodeType !== 1 || !el.textContent || !el.textContent.trim()) return false;
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.textContent.trim()) return true;
    }
    return false;
  }

  /* Une "boîte visuelle" : fond coloré, image de fond, ombre ou bordure visible. */
  function isVisualBox(el) {
    var cs = getComputedStyle(el);
    if (cs.backgroundImage !== 'none' || cs.boxShadow !== 'none') return true;
    var bg = cs.backgroundColor;
    if (bg && bg !== 'transparent' && !/^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)$/.test(bg)) return true;
    var sides = ['Top', 'Right', 'Bottom', 'Left'];
    for (var i = 0; i < sides.length; i++) {
      if (parseFloat(cs['border' + sides[i] + 'Width']) > 0 && cs['border' + sides[i] + 'Style'] !== 'none') return true;
    }
    return false;
  }
  function isContainer(el) {
    return !!(el && el.nodeType === 1 && ((el.matches && el.matches(CARD_SELECTOR)) || isVisualBox(el)));
  }

  /* Extrait de texte lisible : les morceaux issus de blocs/liens/cellules différents sont séparés
     par " · " (textContent brut les colle : "KIOSQUEVentesStocks"). */
  function textExcerpt(el, max) {
    if (!el) return '';
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return (n.parentElement && n.parentElement.closest('.cm-ui')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var out = '', lastSeg = null, n;
    while ((n = walker.nextNode())) {
      var t = n.textContent.replace(/\s+/g, ' ').trim();
      if (!t) continue;
      var seg = n.parentElement;
      while (seg && seg !== el && !(seg.matches('a, button, li, td, th, label, dt, dd') || !/^inline/.test(getComputedStyle(seg).display))) seg = seg.parentElement;
      if (out) out += (lastSeg && seg !== lastSeg) ? ' · ' : ' ';
      out += t;
      lastSeg = seg;
    }
    out = out.replace(/\s+/g, ' ').trim();
    return out.length > max ? out.slice(0, max) + '…' : out;
  }

  function containerLabel(container) {
    var titleEl = container.querySelector && container.querySelector(TITLE_SELECTOR);
    var label = '';
    if (titleEl && titleEl !== container && !titleEl.closest('.cm-ui')) label = textExcerpt(titleEl, 60);
    if (!label) label = textExcerpt(container, 50);
    if (!label && container.className && typeof container.className === 'string') label = container.className.split(' ')[0];
    return label || 'Élément de la page';
  }

  /* Détection à granularité fine : selon l'endroit précis où l'on clique, on cible l'élément le plus
     pertinent — pas toujours le plus gros conteneur qui l'entoure.
       1) sur un bouton, lien, champ, icône, pilule, badge… → cet élément précis
       2) sur du texte (quel que soit son balisage)          → ce texte précis
       3) dans le vide (marge d'une carte, fond)             → la boîte visuelle la plus proche */
  function detectZone(el) {
    // Nos propres surlignages (<mark>) ne sont jamais un repère : ils disparaissent au rechargement.
    while (el && el.nodeType === 1 && el.classList.contains('cm-highlight')) el = el.parentElement;
    if (!el || el === document.body || el === document.documentElement) {
      return { label: 'Zone générale de la page', el: null };
    }

    var atomic = el.closest && el.closest(ATOMIC_SELECTOR);
    if (atomic && !atomic.classList.contains('cm-ui') && !(atomic.matches && atomic.matches(CARD_SELECTOR))) {
      var atomicLabel =
        (atomic.getAttribute && (atomic.getAttribute('aria-label') || atomic.getAttribute('title'))) ||
        textExcerpt(atomic, 60);
      if (!atomicLabel && atomic.tagName) {
        var tag = atomic.tagName.toLowerCase();
        atomicLabel = tag === 'input' ? ('Champ ' + (atomic.getAttribute('placeholder') || atomic.type || '')).trim() : 'Élément (' + tag + ')';
      }
      return { label: atomicLabel || 'Élément de la page', el: atomic };
    }

    // On remonte depuis le point cliqué : premier texte direct rencontré → c'est lui ;
    // première boîte rencontrée avant ça → on s'arrête, c'est une boîte.
    var node = el;
    while (node && node !== document.body) {
      if (isTextLeaf(node)) return { label: textExcerpt(node, 55), el: node };
      if (isContainer(node)) break;
      node = node.parentElement;
    }
    var container = (node && node !== document.body) ? node : el;
    return { label: containerLabel(container), el: container };
  }

  /* Encadré dessiné à la main : on nomme la zone par les textes qu'elle contient ENTIÈREMENT
     (jusqu'à 3), et on l'ancre au plus petit élément qui englobe tout le rectangle — pas à ce qui se
     trouve par hasard au centre. */
  function boxZone(bx, by, bw, bh, centerEl) {
    var node = (centerEl && !inUi(centerEl)) ? centerEl : null;
    var container = null;
    while (node && node !== document.body && node !== document.documentElement) {
      var r = node.getBoundingClientRect();
      var L = r.left + window.scrollX, T = r.top + window.scrollY;
      if (L <= bx + 1 && T <= by + 1 && L + r.width >= bx + bw - 1 && T + r.height >= by + bh - 1) { container = node; break; }
      node = node.parentElement;
    }
    var names = [], listed = [], extra = 0;
    var candidates = (container || document.body).querySelectorAll('*');
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (!isTextLeaf(c) || inUi(c) || !isVisible(c)) continue;
      var cr = c.getBoundingClientRect();
      var cl = cr.left + window.scrollX, ct = cr.top + window.scrollY;
      if (cl < bx - 1 || ct < by - 1 || cl + cr.width > bx + bw + 1 || ct + cr.height > by + bh + 1) continue;
      var nested = listed.some(function (p) { return p.contains(c); });
      if (nested) continue;
      listed.push(c);
      if (names.length < 3) names.push(textExcerpt(c, 30)); else extra++;
    }
    var label = names.length
      ? 'Zone encadrée — ' + names.join(', ') + (extra ? ' (+' + extra + ')' : '')
      : 'Zone encadrée — dans : ' + (container ? detectZone(container).label : 'la page');
    return { label: label, el: container };
  }

  /* Libellé d'une sélection de plusieurs éléments : « 3 éléments — A, B, C (+n) » */
  function multiLabel(targets) {
    if (targets.length === 1) return targets[0].label;
    var names = targets.slice(0, 3).map(function (t) { return t.label; });
    return targets.length + ' éléments — ' + names.join(', ') + (targets.length > 3 ? ' (+' + (targets.length - 3) + ')' : '');
  }

  /* Icône par type d'annotation — visible dans la bulle, la liste et le rapport. */
  function typeIcon(type) {
    return type === 'box' ? '🔲' : type === 'text' ? '✏️' : '📍';
  }

  /* Contour PERSISTANT qui confirme visuellement l'objet visé par le commentaire en cours de saisie —
     reste affiché tant que le popup est ouvert (jusqu'à Enregistrer, Annuler ou un clic ailleurs), et
     se recale si la page est redimensionnée pendant ce temps. */
  var editOutlines = []; // [{ el, box }] — un contour par élément visé (plusieurs en sélection multiple)

  function positionEditOutline() {
    editOutlines.forEach(function (o) {
      var r = o.el.getBoundingClientRect();
      o.box.style.left = (r.left + window.scrollX) + 'px';
      o.box.style.top = (r.top + window.scrollY) + 'px';
      o.box.style.width = Math.max(r.width, 4) + 'px';
      o.box.style.height = Math.max(r.height, 4) + 'px';
    });
  }
  function showEditOutline(els) {
    hideEditOutline();
    (Array.isArray(els) ? els : [els]).forEach(function (el) {
      if (!el) return;
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      var box = document.createElement('div');
      box.className = 'cm-box cm-ui cm-box-editing' + (isDarkBehind(el) ? ' cm-focus-light' : '');
      document.body.appendChild(box);
      editOutlines.push({ el: el, box: box });
    });
    positionEditOutline();
  }
  function hideEditOutline() {
    editOutlines.forEach(function (o) { o.box.remove(); });
    editOutlines = [];
  }

  /* Point d'ancrage "coin" de l'élément visé plutôt que le pixel brut du clic — la pastille reste
     ainsi visuellement rattachée à un repère fixe et prévisible : le coin haut-droit (idem pour les
     encadrés ; les surlignages de texte, eux, portent leur pastille au début du passage). */
  function cornerAnchorPoint(el, fallbackX, fallbackY) {
    if (!el) return { x: fallbackX, y: fallbackY };
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return { x: fallbackX, y: fallbackY };
    return { x: r.right + window.scrollX - 3, y: r.top + window.scrollY + 3 };
  }

  /* ---------- surlignage de texte (sélection robuste multi-nœuds) ---------- */

  /* Retrouve un passage de texte (cité mot pour mot) dans un élément, même s'il est réparti sur
     plusieurs nœuds de texte — sert à re-surligner après un rechargement de page. */
  function findTextRange(root, quote) {
    if (!root || !quote) return null;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return (n.parentElement && n.parentElement.closest('.cm-ui')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    var nodes = [], full = '', n;
    while ((n = walker.nextNode())) { nodes.push({ node: n, start: full.length }); full += n.textContent; }
    var idx = full.indexOf(quote);
    if (idx < 0) return null;
    var end = idx + quote.length;
    var range = document.createRange(), started = false;
    for (var i = 0; i < nodes.length; i++) {
      var s0 = nodes[i].start, len = nodes[i].node.textContent.length;
      if (!started && idx < s0 + len) { range.setStart(nodes[i].node, idx - s0); started = true; }
      if (started && end <= s0 + len) { range.setEnd(nodes[i].node, end - s0); return range; }
    }
    return null;
  }

  function highlightRange(range) {
    var marks = [];
    var mark = document.createElement('mark');
    mark.className = 'cm-highlight';
    try {
      range.surroundContents(mark);
      marks.push(mark);
      return marks;
    } catch (e) {
      var root = range.commonAncestorContainer;
      if (root.nodeType === 3) root = root.parentNode;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          return (range.intersectsNode ? range.intersectsNode(node) : true) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      var nodes = [];
      var n;
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(function (node) {
        var nodeRange = document.createRange();
        nodeRange.selectNodeContents(node);
        if (node === range.startContainer) nodeRange.setStart(node, range.startOffset);
        if (node === range.endContainer) nodeRange.setEnd(node, range.endOffset);
        if (nodeRange.collapsed) return;
        var m = document.createElement('mark');
        m.className = 'cm-highlight';
        try { nodeRange.surroundContents(m); marks.push(m); } catch (e2) { /* on saute ce fragment */ }
      });
      return marks;
    }
  }

  function unwrapMarks(marks) {
    (marks || []).forEach(function (m) {
      if (!m.parentNode) return;
      var parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });
  }

  /* ---------- popup de saisie ---------- */

  /* ---------- encadré ajustable (tant que sa bulle est ouverte) ----------
     8 poignées pour redimensionner, le centre pour déplacer. À l'enregistrement, le libellé et
     l'ancrage sont recalculés d'après la géométrie finale. */
  function applyBoxStyle(el, b) {
    el.style.left = b.x + 'px'; el.style.top = b.y + 'px';
    el.style.width = Math.max(b.w, 4) + 'px'; el.style.height = Math.max(b.h, 4) + 'px';
  }
  function makeBoxEditable(boxEl, meta) {
    if (!boxEl || boxEl.classList.contains('cm-box-editable')) return;
    boxEl.classList.add('cm-box-editable');
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(function (d) {
      var h = document.createElement('div');
      h.className = 'cm-handle cm-handle-' + d;
      h.dataset.dir = d;
      boxEl.appendChild(h);
    });
    boxEl.addEventListener('pointerdown', function (e) {
      e.stopPropagation(); e.preventDefault();
      var dir = e.target.dataset.dir || 'move';
      var start = { x: e.pageX, y: e.pageY, box: { x: meta.box.x, y: meta.box.y, w: meta.box.w, h: meta.box.h } };
      try { boxEl.setPointerCapture(e.pointerId); } catch (err) {}
      function onMove(ev) {
        var dx = ev.pageX - start.x, dy = ev.pageY - start.y;
        var b = { x: start.box.x, y: start.box.y, w: start.box.w, h: start.box.h };
        if (dir === 'move') { b.x += dx; b.y += dy; }
        else {
          if (dir.indexOf('e') >= 0) b.w += dx;
          if (dir.indexOf('s') >= 0) b.h += dy;
          if (dir.indexOf('w') >= 0) { b.x += dx; b.w -= dx; }
          if (dir.indexOf('n') >= 0) { b.y += dy; b.h -= dy; }
          if (b.w < 12) { if (dir.indexOf('w') >= 0) b.x = start.box.x + start.box.w - 12; b.w = 12; }
          if (b.h < 12) { if (dir.indexOf('n') >= 0) b.y = start.box.y + start.box.h - 12; b.h = 12; }
        }
        meta.box = b; meta.boxChanged = true;
        applyBoxStyle(boxEl, b);
      }
      function onUp() {
        boxEl.removeEventListener('pointermove', onMove);
        boxEl.removeEventListener('pointerup', onUp);
        boxEl.removeEventListener('pointercancel', onUp);
      }
      boxEl.addEventListener('pointermove', onMove);
      boxEl.addEventListener('pointerup', onUp);
      boxEl.addEventListener('pointercancel', onUp);
    });
  }
  function endBoxEdit(meta) {
    if (!meta || !meta.boxEl) return;
    meta.boxEl.classList.remove('cm-box-editable');
    var hs = meta.boxEl.querySelectorAll('.cm-handle');
    for (var i = 0; i < hs.length; i++) hs[i].remove();
  }
  /* Élément de la page sous un point, en ignorant nos propres calques (encadrés, pastilles…) */
  function pageElementAt(clientX, clientY) {
    var list = document.elementsFromPoint ? document.elementsFromPoint(clientX, clientY) : [document.elementFromPoint(clientX, clientY)];
    for (var i = 0; i < list.length; i++) if (list[i] && !inUi(list[i])) return list[i];
    return null;
  }
  /* Libellé + ancrage d'un encadré d'après sa géométrie (à la création, ou après ajustement) */
  function describeBox(b) {
    var centerEl = pageElementAt(b.x + b.w / 2 - window.scrollX, b.y + b.h / 2 - window.scrollY);
    var z = boxZone(b.x, b.y, b.w, b.h, centerEl);
    return { label: z.label, anchor: anchorForBox(b.x, b.y, b.w, b.h, z.el) };
  }

  /* ---------- bulle de saisie ---------- */

  function closePopup(discard) {
    if (!pendingPopup) return;
    var meta = pendingPopup._meta;
    endBoxEdit(meta);
    if (discard && meta && !meta.existing) {
      if (meta.type === 'text' && meta.marks) unwrapMarks(meta.marks);
      if (meta.type === 'box' && meta.boxEl) meta.boxEl.remove();
    } else if (discard && meta && meta.existing && meta.boxChanged) {
      renderMarkers(); // encadré existant déplacé puis annulé : on le remet à sa place enregistrée
    }
    hideEditOutline();
    pendingPopup.remove();
    pendingPopup = null;
    setFocused(null); // Annuler / Échap : retour au repos immédiat (l'effet « actif » puis repos est réservé à l'enregistrement)
  }

  /* ---------- placement de la bulle : jamais par-dessus ce qu'elle commente ----------
     On essaie dans l'ordre : sous la cible, au-dessus (en laissant la place à la pastille), à droite,
     à gauche — première position qui tient dans l'écran sans chevaucher la cible. */
  function rectOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
  }
  function unionRect(els) {
    var R = null;
    for (var i = 0; i < els.length; i++) {
      var r = rectOf(els[i]);
      if (r.w === 0 && r.h === 0) continue;
      if (!R) { R = r; continue; }
      var x2 = Math.max(R.x + R.w, r.x + r.w), y2 = Math.max(R.y + R.h, r.y + r.h);
      R.x = Math.min(R.x, r.x); R.y = Math.min(R.y, r.y); R.w = x2 - R.x; R.h = y2 - R.y;
    }
    return R;
  }
  function targetRectOf(meta) {
    if (!meta) return null;
    if (meta.type === 'box' && meta.box) return meta.box;
    if (meta.marks && meta.marks.length) return unionRect(meta.marks);
    if (meta.targets && meta.targets.length > 1) return unionRect(meta.targets.map(function (t) { return t.el; }));
    if (meta.outlineEl) return unionRect(Array.isArray(meta.outlineEl) ? meta.outlineEl : [meta.outlineEl]);
    return null;
  }
  function placePopup(pop, R, fallbackX, fallbackY) {
    var W = pop.offsetWidth, Hh = pop.offsetHeight, gap = 10, pinRoom = 28;
    var vx = window.scrollX, vy = window.scrollY;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    function clampX(x) { return Math.max(vx + 8, Math.min(x, vx + vw - W - 8)); }
    function apply(x, y) { pop.style.left = x + 'px'; pop.style.top = y + 'px'; }
    if (!R) { apply(clampX(fallbackX), fallbackY + 10); return; }
    var cands = [
      { x: R.x, y: R.y + R.h + gap },
      { x: R.x, y: R.y - Hh - gap - pinRoom },
      { x: R.x + R.w + gap, y: R.y },
      { x: R.x - W - gap, y: R.y }
    ];
    for (var i = 0; i < cands.length; i++) {
      var x = clampX(cands[i].x), y = cands[i].y;
      if (y < vy + 8 || y + Hh > vy + vh - 8) continue;
      var overlaps = !(x + W <= R.x || x >= R.x + R.w || y + Hh <= R.y || y >= R.y + R.h);
      if (!overlaps) { apply(x, y); return; }
    }
    apply(clampX(R.x), R.y + R.h + gap); // cible trop grande pour l'écran : dessous, et on fait défiler
    pop.scrollIntoView({ block: 'nearest' });
  }

  /* La bulle se déplace en la prenant par son bandeau (le libellé de zone). */
  function makePopupDraggable(pop, handle) {
    handle.title = 'Glisser pour déplacer la bulle';
    handle.addEventListener('pointerdown', function (e) {
      e.stopPropagation(); e.preventDefault();
      var offX = e.pageX - pop.offsetLeft, offY = e.pageY - pop.offsetTop;
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      function onMove(ev) { pop.style.left = (ev.pageX - offX) + 'px'; pop.style.top = (ev.pageY - offY) + 'px'; }
      function onUp() { handle.removeEventListener('pointermove', onMove); handle.removeEventListener('pointerup', onUp); }
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  }

  function openPopup(x, y, zone, meta) {
    closePopup(true); // (efface aussi la couleur "actif" de la bulle précédente)
    applyTheme();     // le fond du site a pu changer sans que rien ne le signale
    var isEdit = !!(meta && meta.existing);
    var locked = isEdit && !isEditable(meta.existing);           // signalé / pris en compte / complément / résolu : lecture seule
    var askReply = isEdit && meta.existing.status === 'complement'; // … sauf qu'on peut répondre à un complément
    setFocused(isEdit ? meta.existing.id : null);
    if (meta && meta.outlineEl) showEditOutline(meta.outlineEl);
    if (isEdit && meta.type === 'box') meta.boxEl = document.querySelector('.cm-box-saved[data-id="' + meta.existing.id + '"]'); // (re)trouvé après un éventuel re-rendu
    if (!locked && meta && meta.type === 'box' && meta.boxEl && meta.box) makeBoxEditable(meta.boxEl, meta);
    var pop = document.createElement('div');
    pop.className = 'cm-popup cm-ui' + (locked ? ' cm-locked' : '');
    pop.innerHTML =
      '<div class="cm-zone">' + typeIcon(meta && meta.type) + ' ' + cmEsc(zone) + '</div>' +
      (locked ? '<div class="cm-lock-line">' + cmEsc(statusLabel(meta.existing)) + ' — non modifiable</div>' : '') +
      '<textarea' + (locked ? ' readonly' : '') + ' placeholder="Ton commentaire, ta question ou ta critique… (Entrée = enregistrer, Maj+Entrée = nouvelle ligne, Échap = annuler)">' +
      (isEdit ? cmEsc(meta.existing.text) : '') + '</textarea>' +
      (askReply ? '<div class="cm-feedback cm-feedback-q">❔ ' + cmEsc(meta.existing.complementMessage || 'Complément demandé') + '</div>' +
                  '<textarea class="cm-reply-ta" placeholder="Ta réponse… (Entrée = enregistrer)"></textarea>' : '') +
      '<div class="cm-cat-row"><select class="cm-cat"' + (locked ? ' disabled' : '') + ' title="Catégorie (proposée d’après le texte, modifiable)">' +
      CATEGORIES.map(function (cat) { return '<option value="' + cat.key + '">' + cat.icon + ' ' + cat.label + '</option>'; }).join('') +
      '</select><span class="cm-cat-auto">auto</span></div>' +
      '<div class="cm-popup-actions">' +
      (isEdit ? '<button class="cm-delete" title="Supprimer ce commentaire">🗑</button>' : '') +
      '<button class="cm-cancel">' + (locked && !askReply ? 'Fermer' : 'Annuler') + '</button>' +
      (locked && !askReply ? '' : '<button class="cm-save">' + (askReply ? 'Enregistrer la réponse' : 'Enregistrer') + '</button>') + '</div>';
    document.body.appendChild(pop);
    placePopup(pop, targetRectOf(meta), x, y);
    pop._meta = meta;
    makePopupDraggable(pop, pop.querySelector('.cm-zone'));
    var ta = pop.querySelector('textarea');
    if (askReply) {
      var rta = pop.querySelector('.cm-reply-ta');
      rta.focus();
      rta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (addReply(meta.existing, rta.value.trim())) closePopup(true); }
      });
      pop.querySelector('.cm-save').onclick = function (e) { e.stopPropagation(); if (addReply(meta.existing, rta.value.trim())) closePopup(true); };
    } else if (!locked) {
      ta.focus();
    }
    if (isEdit && !locked) { var vlen = ta.value.length; ta.setSelectionRange(vlen, vlen); }

    // Catégorie : proposée automatiquement pendant la frappe, tant que l'utilisateur ne l'a pas choisie lui-même
    var catSel = pop.querySelector('.cm-cat'), catAuto = pop.querySelector('.cm-cat-auto');
    var catTouched = !!(isEdit && meta.existing.categoryManual);
    catSel.value = isEdit && meta.existing.category ? meta.existing.category : categorize(ta.value);
    catAuto.style.display = catTouched ? 'none' : '';
    ta.addEventListener('input', function () { if (!catTouched) catSel.value = categorize(ta.value); });
    catSel.addEventListener('change', function () { catTouched = true; catAuto.style.display = 'none'; });
    catSel.addEventListener('mousedown', function (e) { e.stopPropagation(); });

    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        var sb = pop.querySelector('.cm-save');
        if (sb && !locked) sb.click();
      }
    });

    pop.querySelector('.cm-cancel').onclick = function (e) { e.stopPropagation(); closePopup(true); };
    if (isEdit) {
      pop.querySelector('.cm-delete').onclick = function (e) {
        e.stopPropagation();
        endBoxEdit(meta);
        setFocused(null);
        window.cmDeleteById(meta.existing.id);
        hideEditOutline();
        pop.remove();
        pendingPopup = null;
      };
    }
    if (locked) { pendingPopup = pop; return; }
    pop.querySelector('.cm-save').onclick = function (e) {
      e.stopPropagation();
      var text = ta.value.trim();
      endBoxEdit(meta);
      var savedId = null;
      if (text) {
        var desc = (meta.type === 'box' && meta.boxChanged) ? describeBox(meta.box) : null;
        // Sélection multiple (ou modifiée) : libellé, ancrage de la pastille et liste des cibles recalculés
        var multi = null;
        if (meta.type === 'pin' && meta.targets && meta.targets.length && (meta.targets.length > 1 || meta.targetsChanged)) {
          var first = meta.targets[0].el, cptM = cornerAnchorPoint(first, meta.pinX, meta.pinY);
          multi = {
            zone: multiLabel(meta.targets),
            anchor: anchorForPoint(cptM.x, cptM.y, first), fallback: { x: cptM.x, y: cptM.y },
            targets: meta.targets.length > 1 ? meta.targets.map(function (t) { return { path: getStablePath(t.el), label: t.label }; }) : undefined
          };
        }
        if (isEdit) {
          savedId = meta.existing.id;
          meta.existing.text = text;
          meta.existing.category = catSel.value;
          meta.existing.categoryManual = catTouched;
          if (desc) { meta.existing.zone = desc.label; meta.existing.anchor = desc.anchor; meta.existing.fallback = meta.box; (function (ex, bx) { setTimeout(function () { captureFor(ex, bx, function () { ex.sync = null; scheduleSync(ex); }); }, 60); })(meta.existing, meta.box); }
          if (multi) { meta.existing.zone = multi.zone; meta.existing.anchor = multi.anchor; meta.existing.fallback = multi.fallback; meta.existing.targets = multi.targets; }
          if (desc || multi) { var prev = meta.existing.tech || {}; meta.existing.tech = captureTech(meta.existing); meta.existing.tech.date = prev.date || meta.existing.tech.date; meta.existing.tech.consoleErrors = prev.consoleErrors || []; }
          cmStatus('Commentaire modifié');
          if (!desc) { meta.existing.sync = null; scheduleSync(meta.existing); } // encadré ajusté : renvoyé après la nouvelle capture
        } else {
          var id = uid();
          savedId = id;
          var c = { id: id, type: meta.type, status: 'nouveau', page: PAGE_FILE, path: location.pathname, pageTitle: document.title || PAGE_TITLE, zone: desc ? desc.label : zone, text: text, date: new Date().toISOString() };
          if (meta.type === 'box') {
            c.anchor = desc ? desc.anchor : meta.boxAnchor;
            c.fallback = meta.box;
            if (meta.boxEl) meta.boxEl.classList.add('cm-box-saved');
          } else {
            c.anchor = meta.pointAnchor;
            c.fallback = { x: meta.pinX, y: meta.pinY };
            if (multi) { c.zone = multi.zone; c.anchor = multi.anchor; c.fallback = multi.fallback; if (multi.targets) c.targets = multi.targets; }
            if (meta.type === 'text' && meta.marks) { sessionMarks[id] = meta.marks; c.quote = meta.quote || ''; }
          }
          c.category = catSel.value;
          c.categoryManual = catTouched;
          c.tech = captureTech(c);
          if (AUTHOR) c.author = AUTHOR;   // l'auteur du moment, gravé sur le ticket
          allComments.push(c);
          cmStatus('Commentaire enregistré');
          if (meta.type === 'box') { if (meta.boxEl) meta.boxEl.classList.remove('cm-box-editable'); setTimeout(function () { captureFor(c, c.fallback, function () { scheduleSync(c); }); }, 60); }
          else scheduleSync(c);
        }
        persist(); renderMarkers(); renderList();
      } else if (!isEdit && meta.type === 'text' && meta.marks) {
        unwrapMarks(meta.marks);
      } else if (!isEdit && meta.type === 'box' && meta.boxEl) {
        meta.boxEl.remove();
      } else if (isEdit && meta.boxChanged) {
        renderMarkers();
      }
      hideEditOutline();
      pop.remove();
      pendingPopup = null;
      setFocused(null);
      if (savedId) flashSaved(savedId);
    };
    pendingPopup = pop;
  }

  /* ---------- interactions souris : clic simple / glisser un encadré / Maj+glisser pour du texte ---------- */

  function inUi(el) {
    return !!(el && el.closest && el.closest('.cm-ui'));
  }

  var dragTextMode = false;
  var multiMode = false;
  var MULTI_KEY = /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent || '') ? '⌘' : 'Ctrl';
  var dragStartCaret = null;
  var liveTextRange = null;

  function caretRangeAt(clientX, clientY) {
    try {
      if (document.caretRangeFromPoint) return document.caretRangeFromPoint(clientX, clientY);
      if (document.caretPositionFromPoint) {
        var pos = document.caretPositionFromPoint(clientX, clientY);
        if (!pos || !pos.offsetNode) return null;
        var r = document.createRange();
        r.setStart(pos.offsetNode, pos.offset);
        r.collapse(true);
        return r;
      }
    } catch (e) { /* point hors document */ }
    return null;
  }

  function onMouseDown(e) {
    if (!active || inUi(e.target)) return;
    if (swallowClick) { e.preventDefault(); dragging = false; return; } // ce clic a servi à fermer le tiroir
    e.preventDefault(); // on gère nous-mêmes le glisser — aucune sélection/drag natif ne doit démarrer
    var s = window.getSelection();
    if (s) s.removeAllRanges();
    dragging = true;
    dragTextMode = e.shiftKey;
    multiMode = e.metaKey || e.ctrlKey; // ⌘+clic (Mac) / Ctrl+clic : sélection multiple
    dragStart = { x: e.pageX, y: e.pageY };
    dragStartCaret = dragTextMode ? caretRangeAt(e.clientX, e.clientY) : null;
    liveTextRange = null;
  }

  function onMouseMove(e) {
    if (!active || !dragging) return;
    var dx = e.pageX - dragStart.x, dy = e.pageY - dragStart.y;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;

    if (dragTextMode) {
      if (!dragStartCaret) return;
      var endCaret = caretRangeAt(e.clientX, e.clientY);
      if (!endCaret) return;
      try {
        var r = document.createRange();
        if (dragStartCaret.compareBoundaryPoints(Range.START_TO_START, endCaret) <= 0) {
          r.setStart(dragStartCaret.startContainer, dragStartCaret.startOffset);
          r.setEnd(endCaret.startContainer, endCaret.startOffset);
        } else {
          r.setStart(endCaret.startContainer, endCaret.startOffset);
          r.setEnd(dragStartCaret.startContainer, dragStartCaret.startOffset);
        }
        liveTextRange = r;
        var s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r.cloneRange());
      } catch (e2) { /* points incompatibles à cet instant, on ignore ce tick */ }
      return;
    }

    if (!dragBoxEl) {
      dragBoxEl = document.createElement('div');
      dragBoxEl.className = 'cm-box cm-ui';
      document.body.appendChild(dragBoxEl);
    }
    dragBoxEl.style.left = Math.min(dragStart.x, e.pageX) + 'px';
    dragBoxEl.style.top = Math.min(dragStart.y, e.pageY) + 'px';
    dragBoxEl.style.width = Math.abs(dx) + 'px';
    dragBoxEl.style.height = Math.abs(dy) + 'px';
  }

  function onMouseUp(e) {
    if (swallowClick) { swallowClick = false; dragging = false; return; }
    if (!active || !dragging) { dragging = false; return; }
    dragging = false;
    var s = window.getSelection();
    if (s) s.removeAllRanges();

    if (inUi(e.target)) { if (dragBoxEl) { dragBoxEl.remove(); dragBoxEl = null; } liveTextRange = null; dragStartCaret = null; return; }

    if (dragTextMode) {
      var quoted = liveTextRange ? liveTextRange.toString().trim() : '';
      if (liveTextRange && quoted) openTextPopup(liveTextRange, e);
      else openPinPopup(e.target, e.pageX, e.pageY);
      liveTextRange = null; dragStartCaret = null;
      return;
    }

    // ⌘/Ctrl+clic : ajoute (ou retire) l'élément visé au commentaire "élément" en cours
    if (multiMode) {
      multiMode = false;
      if (dragBoxEl) { dragBoxEl.remove(); dragBoxEl = null; }
      flushPendingClick();
      if (pendingPopup && pendingPopup._meta && pendingPopup._meta.type === 'pin') toggleMultiTarget(e.target);
      else openPinPopup(e.target, e.pageX, e.pageY);
      return;
    }

    // Double-clic = le mot, triple-clic = le paragraphe (la sélection native étant coupée en mode
    // annotation, on calcule nous-mêmes les limites).
    if (e.detail === 2 || e.detail === 3) {
      clearTimeout(clickTimer);
      if (dragBoxEl) { dragBoxEl.remove(); dragBoxEl = null; }
      var r = e.detail === 2 ? wordRangeAt(e.clientX, e.clientY) : blockRangeAt(e.target);
      if (r && r.toString().trim()) { openTextPopup(r, e); return; }
    }

    var dx = e.pageX - dragStart.x, dy = e.pageY - dragStart.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > DRAG_THRESHOLD && dragBoxEl) {
      var bx = Math.min(dragStart.x, e.pageX), by = Math.min(dragStart.y, e.pageY);
      var bw = Math.abs(dx), bh = Math.abs(dy);
      var centerEl = pageElementAt(bx + bw / 2 - window.scrollX, by + bh / 2 - window.scrollY);
      var zoneB = boxZone(bx, by, bw, bh, centerEl);
      openPopup(bx, by + bh, zoneB.label, {
        type: 'box', box: { x: bx, y: by, w: bw, h: bh }, boxEl: dragBoxEl,
        boxAnchor: anchorForBox(bx, by, bw, bh, zoneB.el)
      });
      dragBoxEl = null;
      return;
    }

    if (dragBoxEl) { dragBoxEl.remove(); dragBoxEl = null; }
    if (e.detail > 3) return;
    // On attend un court instant : si un double-clic suit, c'est lui qui gagne (pas de bulle intermédiaire).
    var target = e.target, pX = e.pageX, pY = e.pageY;
    clearTimeout(clickTimer);
    pendingClick = { target: target, x: pX, y: pY };
    clickTimer = setTimeout(function () { clickTimer = null; if (active) openPinPopup(target, pX, pY); }, CLICK_DELAY);
  }
  var clickTimer = null, pendingClick = null;
  /* Un clic simple encore en attente (délai double-clic) est ouvert tout de suite — utile quand on
     enchaîne clic puis Maj+clic très vite pour une sélection multiple. */
  function flushPendingClick() {
    if (!clickTimer) return;
    clearTimeout(clickTimer); clickTimer = null;
    if (pendingClick) openPinPopup(pendingClick.target, pendingClick.x, pendingClick.y);
  }

  function openPinPopup(target, pageX, pageY) {
    var zone = detectZone(target);
    var cpt = cornerAnchorPoint(zone.el, pageX, pageY);
    openPopup(cpt.x, cpt.y, zone.label, {
      type: 'pin', pinX: cpt.x, pinY: cpt.y,
      pointAnchor: anchorForPoint(cpt.x, cpt.y, zone.el), outlineEl: zone.el,
      targets: zone.el ? [{ el: zone.el, label: zone.label }] : []
    });
  }

  /* Sélection multiple : ⌘+clic (Mac) / Ctrl+clic pendant qu'une bulle "élément" est ouverte ajoute
     l'élément visé au groupe (ou le retire s'il y est déjà). Un seul commentaire, un cadre par élément. */
  function toggleMultiTarget(target) {
    var meta = pendingPopup._meta;
    if (meta.existing && !isEditable(meta.existing)) { cmStatus(statusLabel(meta.existing) + ' — non modifiable'); return; }
    var zone = detectZone(target);
    if (!zone.el) return;
    meta.targets = meta.targets || [];
    var idx = -1;
    meta.targets.forEach(function (t, i) { if (t.el === zone.el) idx = i; });
    if (idx >= 0) { if (meta.targets.length === 1) return; meta.targets.splice(idx, 1); }
    else meta.targets.push({ el: zone.el, label: zone.label });
    meta.targetsChanged = true;
    showEditOutline(meta.targets.map(function (t) { return t.el; }));
    var zoneEl = pendingPopup.querySelector('.cm-zone');
    if (zoneEl) zoneEl.textContent = typeIcon('pin') + ' ' + multiLabel(meta.targets);
    cmStatus(meta.targets.length > 1 ? meta.targets.length + ' éléments sélectionnés — ' + MULTI_KEY + '+clic pour en ajouter ou retirer' : '1 élément sélectionné');
  }

  function openTextPopup(range, e) {
    var quoted = range.toString().trim();
    var marks = highlightRange(range.cloneRange());
    var anchorRect = marks.length ? marks[0].getBoundingClientRect() : { left: e.clientX, top: e.clientY };
    var px = anchorRect.left + window.scrollX, py = anchorRect.top + window.scrollY;
    var containerForText = marks.length ? detectZone(marks[0]).el : detectZone(e.target).el;
    openPopup(px, py, '« ' + quoted.slice(0, 90) + (quoted.length > 90 ? '…' : '') + ' »',
      { type: 'text', marks: marks, quote: quoted, pinX: px, pinY: py, pointAnchor: anchorForPoint(px, py, containerForText) });
  }

  /* Le mot sous le pointeur : lettres (accents compris), chiffres, apostrophes et traits d'union. */
  function wordRangeAt(clientX, clientY) {
    var caret = caretRangeAt(clientX, clientY);
    if (!caret || caret.startContainer.nodeType !== 3) return null;
    var node = caret.startContainer, text = node.textContent, i = caret.startOffset;
    var isWordChar = function (ch) { return /[\p{L}\p{N}'’\-]/u.test(ch); };
    var a = i, b = i;
    if (!(isWordChar(text[i] || '') || isWordChar(text[i - 1] || ''))) return null; // clic sur un espace
    while (a > 0 && isWordChar(text[a - 1])) a--;
    while (b < text.length && isWordChar(text[b])) b++;
    if (a === b) return null;
    var r = document.createRange();
    r.setStart(node, a); r.setEnd(node, b);
    return r;
  }
  /* Le paragraphe : l'élément de texte visé (ou le premier bloc qui l'entoure). */
  function blockRangeAt(target) {
    var el = detectZone(target).el || target;
    while (el && el !== document.body && !isTextLeaf(el) && /^inline/.test(getComputedStyle(el).display)) el = el.parentElement;
    if (!el || el === document.body || inUi(el)) return null;
    var r = document.createRange();
    r.selectNodeContents(el);
    return r;
  }

  function onClickCapture(e) {
    if (!active) return;
    if (inUi(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  /* ---------- API publique ---------- */

  window.cmToggle = function (force) {
    active = (typeof force === 'boolean') ? force : !active;
    document.body.classList.toggle('cm-active', active);
    document.getElementById('cmFrame').classList.toggle('show', active);
    document.getElementById('cmPill').classList.toggle('show', active);
    var btn = document.getElementById('cmToggleBtn');
    btn.classList.toggle('cm-on', active);
    btn.querySelector('.cm-btn-off').style.display = active ? 'none' : 'inline';
    btn.querySelector('.cm-btn-on').style.display = active ? 'inline' : 'none';
    if (!active) {
      clearTimeout(clickTimer);
      closePopup(true);
      if (dragBoxEl) { dragBoxEl.remove(); dragBoxEl = null; }
      dragging = false;
      var s = window.getSelection(); if (s) s.removeAllRanges();
    }
  };

  window.cmTogglePanel = function (force) {
    var panel = document.getElementById('cmPanel');
    var show = (typeof force === 'boolean') ? force : !panel.classList.contains('show');
    if (show) {
      applyTheme(); prechargerPolices();
      // Ouvrir le tiroir abandonne une bulle non enregistrée (et un clic simple encore en attente)
      clearTimeout(clickTimer); clickTimer = null;
      closePopup(true);
      flushPending(); refreshStatuses();
    }
    panel.classList.toggle('show', show);
    if (!show && !pendingPopup) setFocused(null);
    if (CONFIG.drawer === 'push') pushPage(show ? panel.offsetWidth : 0);
  };

  /* ---------- le tiroir POUSSE la page au lieu de la recouvrir ----------
     Une page ne peut pas rétrécir sa propre fenêtre (seule une extension de navigateur le peut) :
     on donne à la page une marge droite de la largeur du tiroir, et on ajuste "au mieux" les
     éléments que la page a fixés à l'écran (barre de navigation, boutons flottants), qui ignorent
     les marges : les larges sont rétrécis, les petits ancrés à droite sont décalés. Tout est rétabli
     à la fermeture. */
  var pushedEls = []; // [{ el, cssText }] pour restaurer
  var pushWidth = 0;
  function pushPage(width) {
    // 1) restaurer l'état précédent
    pushedEls.forEach(function (r) { r.el.style.cssText = r.cssText; });
    pushedEls = [];
    pushWidth = width;
    var root = document.documentElement;
    var vw = root.clientWidth; // largeur de la fenêtre (la marge de <html> ne la change pas)
    if (!root.style.transition) {
      root.style.transition = 'margin-right 240ms ease';
      root.addEventListener('transitionend', function (e) { if (e.propertyName === 'margin-right') renderMarkers(); });
    }
    root.style.marginRight = width ? width + 'px' : '';
    if (!width) { setTimeout(renderMarkers, 260); return; }
    // 2) éléments fixés à l'écran qui passeraient sous le tiroir
    var all = document.body.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest('#cmPanel, #cmFrame, #cmPill, #cmStatus, #cmLinks, .cm-popup, .cm-pin, .cm-box')) continue;
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none') continue;
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw - width) continue; // ne déborde pas sous le tiroir
      pushedEls.push({ el: el, cssText: el.style.cssText });
      if (r.width >= vw * 0.9) {
        // élément pleine largeur (barre de navigation) : on le rétrécit
        el.style.maxWidth = 'calc(100% - ' + width + 'px)';
        if (cs.left === 'auto' && cs.right !== 'auto') el.style.right = (parseFloat(cs.right) + width) + 'px';
      } else if (cs.right !== 'auto') {
        // élément ancré à droite (tiroir du site, boutons flottants) : on l'éloigne du bord par `right`.
        // Pas par `transform` : un tiroir animé (animation CSS « both ») écrase le transform en ligne,
        // et passait alors sous la liste witmit (tiroir membres de TellUs-app, 30/09/2026).
        el.style.right = (parseFloat(cs.right) + width) + 'px';
      } else {
        var t = cs.transform && cs.transform !== 'none' ? cs.transform + ' ' : '';
        el.style.transform = t + 'translateX(-' + width + 'px)';
      }
    }
    setTimeout(renderMarkers, 260);
  }
  window.addEventListener('resize', function () { if (pushWidth) pushPage(pushWidth); });

  // Un clic en dehors du tiroir "Commentaires" le referme — et ne fait QUE ça : il ne crée pas
  // d'annotation (ce listener est enregistré avant onMouseDown, il passe donc en premier).
  var swallowClick = false;
  document.addEventListener('mousedown', function (e) {
    var panel = document.getElementById('cmPanel');
    if (!panel || !panel.classList.contains('show')) return;
    if (panel.contains(e.target)) return;
    if (e.target.closest && e.target.closest('#cmPanelBtn')) return;
    cmTogglePanel(false);
    swallowClick = active && !inUi(e.target);
  }, true);

  /* ---------- pastille d'état déplaçable (comme les panneaux des maquettes) ---------- */
  (function initPillDrag() {
    var pill = document.getElementById('cmPill');
    if (!pill) return;
    var PILL_POS_KEY = 'witmit_pill_pos';
    var dragOffset = null;

    function applyPos(left, top) {
      left = Math.max(4, Math.min(left, window.innerWidth - pill.offsetWidth - 4));
      top = Math.max(4, Math.min(top, window.innerHeight - pill.offsetHeight - 4));
      pill.style.left = left + 'px';
      pill.style.top = top + 'px';
      pill.style.transform = 'none';
    }
    try {
      var saved = JSON.parse(localStorage.getItem(PILL_POS_KEY) || 'null');
      if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
        pill.classList.add('show');
        applyPos(saved.left, saved.top);
        pill.classList.remove('show');
      }
    } catch (e) {}

    pill.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('button')) return;
      var rect = pill.getBoundingClientRect();
      dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      pill.classList.add('cm-dragging');
      try { pill.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    pill.addEventListener('pointermove', function (e) {
      if (!dragOffset) return;
      applyPos(e.clientX - dragOffset.x, e.clientY - dragOffset.y);
    });
    function endDrag(e) {
      if (!dragOffset) return;
      dragOffset = null;
      pill.classList.remove('cm-dragging');
      try {
        var r = pill.getBoundingClientRect();
        localStorage.setItem(PILL_POS_KEY, JSON.stringify({ left: r.left, top: r.top }));
      } catch (err) {}
    }
    pill.addEventListener('pointerup', endDrag);
    pill.addEventListener('pointercancel', endDrag);
  })();

  // Raccourci clavier : Alt+A (Windows/Linux) / ⌥+A (Mac) pour afficher/masquer le widget, le même partout.
  // Sur Mac, ⌥+A tape normalement "å" : on reconnaît la touche physique (e.code) et on ignore le
  // raccourci quand on est en train d'écrire dans un champ, pour ne jamais gêner la saisie.
  var IS_MAC = /Mac|iPhone|iPod|iPad/i.test(
    (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || ''
  );
  var SHORTCUT_LABEL = IS_MAC ? '⌥+A' : 'Alt+A';
  function isTypingIn(el) {
    return !!(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
  }
  document.addEventListener('keydown', function (e) {
    // Échap, de la couche la plus proche à la plus lointaine : la bulle, puis le tiroir, puis le mode annotation.
    // (Dans un champ du tiroir — réponse, modification — Échap annule d'abord ce champ, sans aller plus loin.)
    if (e.key === 'Escape') {
      var panel = document.getElementById('cmPanel');
      if (pendingPopup) { e.preventDefault(); closePopup(true); }
      else if (panel && panel.classList.contains('show')) { e.preventDefault(); cmTogglePanel(false); }
      else if (active) { e.preventDefault(); cmToggle(false); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.shiftKey || !e.altKey) return;
    // La lettre tapée (a ; « å » sur Mac QWERTY, « æ » sur Mac AZERTY avec ⌥), jamais la position de la
    // touche : sur un clavier AZERTY, la position « KeyA » est celle du Q.
    if (!/^[aåæ]$/i.test(e.key || '')) return;
    if (isTypingIn(e.target)) return;
    e.preventDefault();
    if (LIVE && document.body.classList.contains('cm-concealed')) cmReveal(true);
    cmToggle();
  });
  var cmToggleBtnEl = document.getElementById('cmToggleBtn');
  if (cmToggleBtnEl) cmToggleBtnEl.title = 'Mode commentaire (' + SHORTCUT_LABEL + ')';
  // Premier survol (ou focus clavier) d'un des deux boutons : les polices partent, prêtes pour la fenêtre.
  ['cmToggleBtn', 'cmPanelBtn'].forEach(function (id) {
    var b = document.getElementById(id);
    if (!b) return;
    b.addEventListener('pointerenter', prechargerPolices, { once: true });
    b.addEventListener('focus', prechargerPolices, { once: true });
  });

  var statusTimer = null;
  function cmStatus(msg) {
    var el = document.getElementById('cmStatus');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  /* ---------- capture d'écran d'un encadré ----------
     html2canvas (bibliothèque libre, MIT) est chargée UNIQUEMENT au premier encadré enregistré, jamais
     avant. L'image est réduite (800 px max) et compressée en JPEG pour tenir dans le stockage local
     (~5 Mo au total) ; au-delà d'un budget de 3 Mo d'images, les plus anciennes sont retirées (le ticket
     reste, seule l'image part). Nos propres calques (cadres, pastilles…) sont exclus du rendu. */
  var IMAGE_BUDGET = 3 * 1024 * 1024, IMAGE_MAX_W = 800;
  var h2cPromise = null;
  function loadHtml2canvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    if (h2cPromise) return h2cPromise;
    h2cPromise = new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = CONFIG.html2canvasUrl;
      sc.onload = function () { window.html2canvas ? resolve(window.html2canvas) : reject(new Error('html2canvas absent')); };
      sc.onerror = function () { h2cPromise = null; reject(new Error('chargement impossible')); };
      document.head.appendChild(sc);
    });
    return h2cPromise;
  }
  function pageBackground() {
    var cands = [document.body, document.documentElement];
    for (var i = 0; i < cands.length; i++) {
      var bg = getComputedStyle(cands[i]).backgroundColor;
      if (bg && bg !== 'transparent' && !/^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)$/.test(bg)) return bg;
    }
    return '#ffffff';
  }
  function captureBox(box) {
    return loadHtml2canvas().then(function (h2c) {
      return h2c(document.body, {
        x: box.x, y: box.y, width: Math.max(1, Math.round(box.w)), height: Math.max(1, Math.round(box.h)),
        scale: Math.min(window.devicePixelRatio || 1, 2), useCORS: true, logging: false,
        backgroundColor: pageBackground(), // le JPEG n'a pas de transparence : on prend le fond réel de la page
        ignoreElements: function (el) { return !!(el.closest && el.closest('.cm-ui, mark.cm-highlight')); }
      });
    }).then(function (canvas) {
      var ratio = Math.min(1, IMAGE_MAX_W / canvas.width);
      var out = canvas;
      if (ratio < 1) {
        out = document.createElement('canvas');
        out.width = Math.round(canvas.width * ratio); out.height = Math.round(canvas.height * ratio);
        out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
      }
      return { dataUrl: out.toDataURL('image/jpeg', 0.72), width: out.width, height: out.height };
    });
  }
  function enforceImageBudget() {
    var withShot = allComments.filter(function (c) { return c.shot && c.shot.dataUrl; })
      .sort(function (a, b) { return (a.shot.at || a.date) < (b.shot.at || b.date) ? -1 : 1; });
    var total = withShot.reduce(function (n, c) { return n + c.shot.dataUrl.length; }, 0);
    while (total > IMAGE_BUDGET && withShot.length) {
      var oldest = withShot.shift();
      total -= oldest.shot.dataUrl.length;
      oldest.shot = { dropped: true, at: oldest.shot.at };
    }
  }
  function captureFor(c, box, done) {
    if (!CONFIG.capture || !box) { if (done) done(); return; }
    cmStatus('Capture de la zone…');
    captureBox(box).then(function (img) {
      var live = findComment(c.id);
      if (!live) return;
      live.shot = { dataUrl: img.dataUrl, width: img.width, height: img.height, at: new Date().toISOString() };
      enforceImageBudget();
      persist(); renderList();
      cmStatus('Capture enregistrée (' + Math.round(img.dataUrl.length / 1024) + ' Ko)');
    }).catch(function (err) {
      cmStatus('Capture impossible (' + (err && err.message || 'erreur') + ') — le commentaire est bien enregistré');
    }).then(function () { if (done) done(); });
  }
  window.cmShowShot = function (id) {
    var c = findComment(id);
    if (!c || !c.shot || !c.shot.dataUrl) return;
    var ov = document.createElement('div');
    ov.className = 'cm-lightbox cm-ui';
    ov.innerHTML = '<img alt="Capture de la zone commentée"><div class="cm-lightbox-hint">Cliquer pour fermer</div>';
    ov.querySelector('img').src = c.shot.dataUrl;
    ov.onclick = function () { ov.remove(); };
    document.body.appendChild(ov);
  };

  /* ---------- rapport : un fichier Markdown = texte lisible + bloc JSON par ticket ----------
     Périmètre par défaut « nouveautés » : tickets nouveaux + réponses aux compléments, toutes les
     pages du projet ouvertes dans ce navigateur. « Complet » : tout, tous statuts.
     Chaque rapport reçoit un identifiant (R-AAAA-MM-JJ-n) que les tickets mémorisent ; générer un
     rapport marque ses tickets « signalés » (verrouillés) après confirmation. */
  var REPORTS_KEY = 'witmit_' + CONFIG.project + '_reports';
  function pastReports() { try { return JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]'); } catch (e) { return []; } }
  function nextReportId() {
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); // date locale, pas UTC
    var n = pastReports().filter(function (r) { return r.id.indexOf('R-' + day) === 0; }).length + 1;
    return 'R-' + day + '-' + n;
  }
  function hasPendingReply(c) { return c.status === 'complement' && (c.replies || []).some(function (r) { return !r.sentIn; }); }
  function reportItems(full) {
    return allComments.filter(function (c) { return full || c.status === 'nouveau' || hasPendingReply(c); });
  }
  function ticketJson(c, reportId) {
    var t = c.tech || {};
    return {
      id: c.id, page: c.page, page_titre: c.pageTitle || '', type: t.type || c.type,
      categorie: categoryOf(c.category).label, statut: c.status,
      texte: c.text,
      auteur: c.author || undefined,
      cibles: (t.selectors || []).map(function (sel, i) { return { selecteur: sel, libelle: (t.labels || [])[i] || c.zone }; }),
      citation: c.quote || undefined,
      position: t.position, fenetre: t.viewport, navigateur: t.browser, os: t.os, theme: t.theme,
      erreurs_console: t.consoleErrors && t.consoleErrors.length ? t.consoleErrors : undefined,
      cree_le: c.date, rapport: reportId,
      remplace_version_du: c.supersedes || undefined,
      reponses: c.replies && c.replies.length ? c.replies.map(function (r) { return { date: r.date, texte: r.text }; }) : undefined,
      complement_demande: c.complementMessage || undefined,
      capture: c.shot && c.shot.dataUrl ? 'image ci-dessus (' + c.shot.width + '×' + c.shot.height + ')' : undefined
    };
  }
  function buildReportMd(items, reportId, full) {
    var byPage = {}, order = [];
    items.forEach(function (c) {
      if (!byPage[c.page]) { byPage[c.page] = { title: c.pageTitle || c.page, items: [] }; order.push(c.page); }
      byPage[c.page].items.push(c);
    });
    var L = [];
    L.push('# ' + CONFIG.project + ' — Rapport de retours ' + reportId);
    L.push('');
    L.push('Généré le ' + new Date().toLocaleString('fr-FR') + ' · ' + items.length + ' ticket(s) sur ' + order.length + ' page(s) · périmètre : ' + (full ? 'complet (tous statuts)' : 'nouveautés'));
    L.push('');
    var n = 0;
    order.forEach(function (page) {
      var grp = byPage[page];
      L.push('## Page : ' + grp.title + ' (`' + page + '`)');
      L.push('');
      grp.items.forEach(function (c) {
        n++;
        var st = c.status === 'nouveau' ? 'nouveau' : statusLabel(c).replace(/^\S+\s/, '');
        L.push('### #' + n + ' · ' + typeIcon(c.type) + ' ' + c.zone + ' — ' + categoryOf(c.category).label + ' · ' + st + (c.supersedes ? ' · remplace la version du ' + frDate(c.supersedes) : ''));
        L.push('');
        if (c.author) { L.push('_Signalé par ' + c.author + '_'); L.push(''); }
        L.push(c.text);
        L.push('');
        if (c.complementMessage) { L.push('> ❔ Complément demandé' + (c.complementAt ? ' le ' + frDate(c.complementAt) : '') + ' : ' + c.complementMessage); }
        (c.replies || []).forEach(function (r) { L.push('> ↳ Réponse du ' + frDate(r.date) + ' : ' + r.text); });
        if (c.complementMessage || (c.replies && c.replies.length)) L.push('');
        if (c.shot && c.shot.dataUrl) { L.push('![Capture de la zone](' + c.shot.dataUrl + ')'); L.push(''); }
        L.push('```json');
        L.push(JSON.stringify(ticketJson(c, reportId), null, 2));
        L.push('```');
        L.push('');
      });
    });
    L.push('---');
    L.push('');
    L.push('## Pour répondre à ce rapport');
    L.push('');
    L.push('Termine ton traitement par un bloc de ce format (une ligne par ticket, séparateur `|` avant un message facultatif). Il se colle dans witmit : tiroir 📋 → « Coller un retour ».');
    L.push('');
    L.push('```');
    L.push('witmit-retour ' + reportId);
    L.push('<id du ticket> pris_en_compte');
    L.push('<id du ticket> resolu | ce qui a été fait (facultatif)');
    L.push('<id du ticket> complement | la question à poser pour clarifier');
    L.push('```');
    L.push('');
    L.push('Identifiants de ce rapport : ' + items.map(function (c) { return '`' + c.id + '`'; }).join(', '));
    L.push('');
    return L.join('\n');
  }
  function markReported(items, reportId) {
    var now = new Date().toISOString(), n = 0;
    items.forEach(function (c) {
      if (c.status === 'nouveau' || hasPendingReply(c)) {
        (c.replies || []).forEach(function (r) { if (!r.sentIn) r.sentIn = reportId; });
        c.status = 'signale'; c.signaledAt = now;
        (c.reports = c.reports || []).push(reportId);
        pushHistory(c, { date: now, status: 'signale', source: 'rapport', message: reportId });
        n++;
      }
    });
    var reports = pastReports();
    reports.push({ id: reportId, date: now, count: items.length });
    try { localStorage.setItem(REPORTS_KEY, JSON.stringify(reports)); } catch (e) {}
    if (pendingPopup) closePopup(true);
    persist(); renderList(); renderMarkers();
    return n;
  }
  /* Prépare un rapport : renvoie { id, md, items } ou null si rien à mettre dedans. Demande si l'on
     marque les tickets (Annuler = rapport généré sans les verrouiller). */
  function prepareReport() {
    var full = !!(document.getElementById('cmFullReport') && document.getElementById('cmFullReport').checked);
    var items = reportItems(full);
    if (!items.length) { cmStatus(full ? 'Aucun commentaire sur le site' : 'Rien de nouveau à signaler (coche « Rapport complet » pour tout exporter)'); return null; }
    var id = nextReportId();
    var md = buildReportMd(items, id, full);
    var toMark = items.filter(function (c) { return c.status === 'nouveau' || hasPendingReply(c); }).length;
    var marked = 0;
    if (toMark) {
      if (window.confirm('Marquer ' + toMark + ' ticket(s) comme signalé(s) dans le rapport ' + id + ' ?\n(Ils ne seront plus modifiables. Annuler = générer le rapport sans les marquer.)')) marked = markReported(items, id);
    }
    return { id: id, md: md, items: items, marked: marked };
  }
  window.cmExport = function () {
    var r = prepareReport();
    if (!r) return;
    var blob = new Blob([r.md], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'witmit-' + CONFIG.project + '-' + r.id + '.md';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    cmStatus('Rapport ' + r.id + ' téléchargé' + (r.marked ? ' — ' + r.marked + ' ticket(s) signalé(s)' : ''));
  };
  window.cmCopy = function () {
    var r = prepareReport();
    if (!r) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(r.md).then(function () {
        cmStatus('Rapport ' + r.id + ' copié' + (r.marked ? ' — ' + r.marked + ' ticket(s) signalé(s)' : '') + ' — colle-le à Claude');
      }).catch(function () { cmStatus('Copie impossible — essaie Télécharger'); });
    } else cmStatus('Copie non supportée par ce navigateur');
  };
  window.cmSendMail = function () {
    if (!EMAIL_TO) { cmStatus('Aucune adresse configurée (data-email) — utilise Télécharger ou Copier'); return; }
    var r = prepareReport();
    if (!r) return;
    var subject = CONFIG.project + ' — Rapport de retours ' + r.id + ' (' + r.items.length + ')';
    var mailto = 'mailto:' + EMAIL_TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(r.md);
    if (mailto.length > 1900) { cmStatus('Trop long pour un email — utilise Télécharger ou Copier'); return; }
    window.location.href = mailto;
  };

  /* ---------- retour : on colle le bloc produit par la session (ou tapé à la main) ----------
       witmit-retour R-…            (en-tête facultatif)
       <id> pris_en_compte
       <id> resolu | message facultatif
       <id> complement | question posée
     Statuts tolérés : « pris en compte », « vu », « résolu », « corrigé », « fait », « complément », « question ». */
  function normalizeStatus(word) {
    var w = normalizeText(word).replace(/[_-]/g, ' ');
    if (/^(pris en compte|vu|ok|en cours)$/.test(w)) return 'pris_en_compte';
    if (/^(resolu|resolue|corrige|corrigee|fait|done|ferme)$/.test(w)) return 'resolu';
    if (/^(complement|question|precision|a preciser)$/.test(w)) return 'complement';
    return null;
  }
  function applyFeedback(text) {
    var lines = String(text || '').split(/\r?\n/), applied = 0, unknown = 0, ignored = 0, now = new Date().toISOString();
    lines.forEach(function (raw) {
      var line = raw.replace(/^[-*>\s`]+/, '').trim();
      if (!line || /^witmit-retour/i.test(line) || /^```/.test(line)) return;
      var m = line.match(/^(\S+)\s+([^|]+?)\s*(?:\|\s*(.*))?$/);
      if (!m) { ignored++; return; }
      var c = findComment(m[1]), st = normalizeStatus(m[2]), msg = (m[3] || '').trim();
      if (!st) { ignored++; return; }   // pas un statut reconnu : ligne de prose, on l'ignore
      if (!c) { unknown++; return; }    // statut valide mais identifiant inconnu
      if (c.status === 'resolu' && st !== 'resolu') { ignored++; return; } // un résolu ne redevient pas ouvert par un retour
      c.status = st;
      if (st === 'pris_en_compte') { c.ackAt = now; if (msg) c.feedbackMessage = msg; }
      if (st === 'resolu') { c.resolvedAt = now; c.resolvedBy = 'retour'; if (msg) c.feedbackMessage = msg; }
      if (st === 'complement') { c.complementAt = now; c.complementMessage = msg || 'Peux-tu préciser ?'; }
      pushHistory(c, { date: now, status: st, source: 'retour', message: msg || undefined });
      applied++;
    });
    persist(); renderList(); renderMarkers();
    return { applied: applied, unknown: unknown, ignored: ignored };
  }
  window.cmPasteFeedback = function (show) {
    var box = document.getElementById('cmFeedbackBox');
    var open = typeof show === 'boolean' ? show : box.hidden;
    box.hidden = !open;
    if (open) { var ta = box.querySelector('textarea'); ta.value = ''; ta.focus(); }
  };
  window.cmApplyFeedback = function () {
    var box = document.getElementById('cmFeedbackBox');
    var res = applyFeedback(box.querySelector('textarea').value);
    box.hidden = true;
    cmStatus(res.applied + ' ticket(s) mis à jour' + (res.unknown ? ' · ' + res.unknown + ' identifiant(s) inconnu(s)' : '') + (res.ignored ? ' · ' + res.ignored + ' ligne(s) ignorée(s)' : ''));
  };

  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('click', onClickCapture, true);

  readUrlSwitch();
  applyReveal(isRevealed());
  load();
  renderMarkers();
  renderList();
  if (SYNC && allComments.length) setTimeout(function () { flushPending(); refreshStatuses(); }, 1500);
  } // fin boot()

  // Démarre dès que le <body> existe (que la balise <script> soit dans <head> ou en fin de page).
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
