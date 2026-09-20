/*!
 * Annotate — widget d'annotation visuelle (V1, mode maquette / localStorage)
 * Un seul fichier : injecte son style, son interface et sa logique au chargement.
 * Usage : <script src="annotate.js" data-project="monprojet" data-email="moi@exemple.fr"></script>
 * Raccourci : Alt+A (Windows/Linux) · ⌥+A (Mac)
 */
(function () {
  if (window.__annotateLoaded) return; // chargé deux fois par erreur : on ne s'installe qu'une fois
  window.__annotateLoaded = true;

  /* ---------- configuration lue sur la balise <script> ----------
     <script src="annotate.js" data-project="monprojet" data-email="moi@exemple.fr"></script>
     - data-project : nom du projet (clé de stockage + titre du rapport) — obligatoire en pratique
     - data-email   : destinataire du bouton « Envoyer » (facultatif) */
  var SCRIPT_EL = document.currentScript || document.querySelector('script[data-project]');
  var CONFIG = {
    project: (SCRIPT_EL && SCRIPT_EL.getAttribute('data-project')) || 'annotate',
    email: (SCRIPT_EL && SCRIPT_EL.getAttribute('data-email')) || '',
    // data-multi-lines="true" : relier par des lignes fines les éléments d'une sélection multiple
    multiLines: !!(SCRIPT_EL && /^(true|1|oui)$/i.test(SCRIPT_EL.getAttribute('data-multi-lines') || ''))
  };

  var CSS = `
  /* Palette du widget : reprend les variables de la page hôte si elles existent (TellUs),
     sinon des valeurs de repli neutres — le widget reste lisible sur n'importe quelle page. */
  .cm-ui, mark.cm-highlight {
    --cm-orange: var(--orange-500, #FC8005);
    --cm-teal: var(--teal-500, #35838E);
    --cm-teal-dark: var(--teal-700, #235259);
    --cm-text: var(--text, #1A1917);
    --cm-text2: var(--text2, #515151);
    --cm-text-muted: var(--textm, #9E9B93);
    --cm-border: var(--border, #E0DDD5);
    --cm-border2: var(--border2, #ECEAE4);
    --cm-surface: var(--surface, #FFFFFF);
    --cm-bg: var(--bg, #F5F4F0);
    --cm-shadow-md: var(--shadow-md, 0 4px 12px rgba(17,40,48,.10), 0 2px 4px rgba(17,40,48,.06));
    --cm-shadow-lg: var(--shadow-lg, 0 12px 32px rgba(17,40,48,.14), 0 4px 8px rgba(17,40,48,.08));
    --cm-transition: var(--transition, 170ms ease);
    --cm-nav-h: var(--nav-h, 0px);
    --cm-ease: var(--ease-enter, cubic-bezier(0.16, 1, 0.3, 1));
  }

  /* Boutons flottants, créés seulement si la page n'a pas déjà ses propres boutons #cmToggleBtn/#cmPanelBtn */
  .cm-fab { position:fixed; right:18px; bottom:18px; z-index:845; display:flex; gap:8px; } /* sous le panneau (850) : ne masque jamais ses boutons */

  /* Boutons compacts, ronds, icône seule — pour ne jamais gêner la lecture (retour utilisateur) */
  .cm-toggle-btn { width:38px; height:38px; padding:0; display:flex; align-items:center; justify-content:center; background: rgba(255,255,255,.75); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); border:1px solid var(--cm-border); border-radius:50%; font-size:16px; cursor:pointer; box-shadow:var(--cm-shadow-md); transition:all var(--cm-transition); position:relative; }
  [data-theme="dark"] .cm-toggle-btn { background: rgba(21,42,49,.75); }
  .cm-toggle-btn:hover { border-color:var(--cm-orange); transform:scale(1.06); }
  .cm-toggle-btn.cm-on { background:var(--cm-orange); border-color:var(--cm-orange); }
  .cm-toggle-btn .cm-count-badge { position:absolute; top:-4px; right:-4px; min-width:16px; height:16px; padding:0 3px; border-radius:9px; background:var(--cm-teal); color:#fff; font-family:'League Spartan',sans-serif; font-size:9.5px; font-weight:700; display:flex; align-items:center; justify-content:center; box-shadow:0 0 0 2px var(--cm-surface); }
  .cm-toggle-btn .cm-count-badge:empty, .cm-toggle-btn .cm-count-badge[data-zero="1"] { display:none; }

  body.cm-active { cursor: crosshair; }
  body.cm-active .cm-ui, body.cm-active .cm-ui * { cursor: auto; }

  /* Cadre "vignette" — fort sur le bord, dégradé vers l'intérieur sur une distance fixe (même esprit que
     l'indicateur de contrôle de Claude in Chrome). Zéro impact sur la mise en page : position:fixed +
     pointer-events:none, ne recouvre jamais la navbar ni rien d'autre. */
  .cm-frame { position:fixed; inset:0; z-index:895; pointer-events:none; display:none; }
  .cm-frame.show { display:block; }
  .cm-frame::before {
    content:''; position:absolute; inset:0;
    animation: cmFrameWave 3.4s ease-in-out infinite;
  }
  /* "vague" douce : le halo respire (s'étend puis se resserre) plutôt qu'un simple fondu d'opacité —
     bord toujours net et marqué, intérieur qui pulse pour rester bien visible même en fond sombre. */
  @keyframes cmFrameWave {
    0%, 100% {
      box-shadow:
        inset 0 0 0 4px rgba(252,128,5,.90),
        inset 0 0 70px 0 rgba(252,128,5,.30),
        inset 0 0 30px 0 rgba(252,128,5,.24);
    }
    50% {
      box-shadow:
        inset 0 0 0 4px rgba(252,128,5,1),
        inset 0 0 120px 0 rgba(252,128,5,.55),
        inset 0 0 56px 0 rgba(252,128,5,.42);
    }
  }
  [data-theme="dark"] .cm-frame::before { animation: cmFrameWaveDark 3.4s ease-in-out infinite; }
  @keyframes cmFrameWaveDark {
    0%, 100% {
      box-shadow:
        inset 0 0 0 4px rgba(255,158,61,.95),
        inset 0 0 85px 0 rgba(255,140,20,.45),
        inset 0 0 38px 0 rgba(255,140,20,.34);
    }
    50% {
      box-shadow:
        inset 0 0 0 4px rgba(255,181,107,1),
        inset 0 0 140px 0 rgba(255,140,20,.72),
        inset 0 0 64px 0 rgba(255,140,20,.55);
    }
  }
  @media (prefers-reduced-motion:reduce) {
    .cm-frame::before, [data-theme="dark"] .cm-frame::before { animation:none; box-shadow: inset 0 0 0 4px rgba(252,128,5,.97), inset 0 0 95px 0 rgba(252,128,5,.42), inset 0 0 42px 0 rgba(252,128,5,.32); }
  }

  /* Pastille d'état — flotte sous la navbar par défaut, ne la recouvre jamais, et peut être
     déplacée n'importe où sur la page (comme les panneaux des maquettes) si elle gêne la lecture. */
  .cm-pill { position:fixed; top:calc(var(--cm-nav-h) + 12px); left:50%; transform:translateX(-50%); z-index:900; background:var(--cm-orange); color:#fff; font-family:'League Spartan',sans-serif; font-weight:700; font-size:12px; text-align:center; padding:8px 10px 8px 12px; border-radius:50px; display:none; align-items:center; gap:12px; box-shadow:var(--cm-shadow-lg); white-space:nowrap; cursor:grab; touch-action:none; }
  .cm-pill.show { display:flex; }
  .cm-pill.cm-dragging { cursor:grabbing; box-shadow:var(--cm-shadow-lg), 0 0 0 2px rgba(255,255,255,.5); }
  .cm-pill .cm-drag-handle { font-size:14px; opacity:.65; line-height:1; }
  .cm-pill button { font-family:'League Spartan',sans-serif; font-weight:700; font-size:11.5px; background:rgba(255,255,255,.22); border:1px solid rgba(255,255,255,.55); color:#fff; border-radius:50px; padding:5px 12px; cursor:pointer; }
  .cm-pill button:hover { background:rgba(255,255,255,.34); }

  .cm-pin { position:absolute; width:24px; height:24px; border-radius:50% 50% 50% 4px; background:var(--cm-orange); color:#fff; font-family:'League Spartan',sans-serif; font-weight:700; font-size:11px; display:flex; align-items:center; justify-content:center; transform:translate(-50%,-100%) rotate(-45deg); box-shadow:var(--cm-shadow-md); z-index:840; cursor:pointer; }
  .cm-pin span { transform:rotate(45deg); }
  .cm-pin:hover { filter:brightness(1.08); }
  /* Pastilles réduites des autres éléments d'une sélection multiple (même numéro) */
  .cm-pin.cm-pin-secondary { width:18px; height:18px; font-size:9px; opacity:.85; }
  /* Survol d'une pastille : les cadres du même commentaire s'allument */
  .cm-box-saved.cm-glow { box-shadow:0 0 0 3px rgba(252,128,5,.35); }
  .cm-pin.cm-glow { filter:brightness(1.12); }
  #cmLinks { position:absolute; left:0; top:0; pointer-events:none; z-index:835; overflow:visible; }
  #cmLinks line { stroke:var(--cm-orange, #FC8005); stroke-width:1; stroke-dasharray:3 3; opacity:.7; }
  body:not(.cm-active) #cmLinks { display:none; }

  /* Contour d'un encadré sélectionné par glisser-déposer (pendant le drag, puis conservé comme repère si le commentaire est enregistré) */
  .cm-box { position:absolute; border:2px dashed var(--cm-orange); background:rgba(252,128,5,.10); border-radius:6px; z-index:820; pointer-events:none; box-sizing:border-box; }
  .cm-box.cm-box-saved { border-style:solid; background:rgba(252,128,5,.06); }
  .cm-box.cm-box-outline { border-width:1.5px; background:transparent; border-radius:4px; }
  /* Encadré ajustable tant que sa bulle est ouverte : déplaçable au centre, 8 poignées pour redimensionner */
  .cm-box.cm-box-editable { pointer-events:auto; touch-action:none; z-index:830; }
  body .cm-box.cm-box-editable { cursor:move; }
  .cm-handle { position:absolute; box-sizing:border-box; }
  /* Seul repère visible : le petit grip à deux traits de l'angle bas-droit (comme celui d'une zone de texte) */
  .cm-handle-se { width:14px; height:14px; right:1px; bottom:1px;
    background: linear-gradient(135deg, transparent 0 55%, var(--cm-orange) 55% 62%, transparent 62% 76%, var(--cm-orange) 76% 83%, transparent 83%); opacity:.9; }
  /* Autres coins : invisibles, saisissables ; de petits points apparaissent au survol de l'encadré */
  .cm-handle-nw, .cm-handle-ne, .cm-handle-sw { width:10px; height:10px; }
  .cm-handle-nw::after, .cm-handle-ne::after, .cm-handle-sw::after { content:''; position:absolute; inset:2px; border-radius:50%; background:var(--cm-orange); opacity:0; transition:opacity 150ms; }
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
  body:not(.cm-active) mark.cm-highlight { background:transparent; }
  /* Onde douce autour du cadre quand on cherche un commentaire depuis la liste */
  .cm-ola { animation: cmOla 1s ease-out 2; }
  @keyframes cmOla { 0% { box-shadow:0 0 0 0 rgba(252,128,5,.55); } 100% { box-shadow:0 0 0 18px rgba(252,128,5,0); } }
  /* Contour "en cours d'édition" — reste affiché tant que le popup lié est ouvert (Enregistrer,
     Annuler ou un clic ailleurs le referment), pour qu'on sache toujours à quel objet le commentaire
     en cours de saisie est rattaché. */
  .cm-box.cm-box-editing { border-style:solid; border-width:2.5px; background:rgba(252,128,5,.14); }

  /* Surlignage du texte sélectionné */
  mark.cm-highlight { background:rgba(252,128,5,.32); color:inherit; border-radius:2px; padding:0 1px; box-decoration-break:clone; -webkit-box-decoration-break:clone; }
  [data-theme="dark"] mark.cm-highlight { background:rgba(252,128,5,.42); }

  .cm-popup { position:absolute; z-index:950; width:260px; background:var(--cm-surface); border:1px solid var(--cm-border); border-radius:12px; box-shadow:var(--cm-shadow-lg); padding:12px; }
  .cm-popup .cm-zone { cursor:move; touch-action:none; font-family:'League Spartan',sans-serif; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--cm-teal); margin-bottom:6px; max-height:48px; overflow-y:auto; }
  .cm-popup textarea { width:100%; min-height:70px; resize:vertical; border:1px solid var(--cm-border); border-radius:8px; padding:8px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--cm-text); background:var(--cm-bg); margin-bottom:8px; box-sizing:border-box; }
  .cm-popup .cm-popup-actions { display:flex; gap:8px; justify-content:flex-end; }
  .cm-popup button { font-family:'League Spartan',sans-serif; font-size:12px; font-weight:700; border-radius:7px; padding:6px 12px; border:none; cursor:pointer; }
  .cm-popup .cm-cancel { background:transparent; color:var(--cm-text-muted); }
  .cm-popup .cm-cancel:hover { color:var(--cm-text2); }
  .cm-popup .cm-save { background:var(--cm-teal); color:#fff; }
  .cm-popup .cm-save:hover { background:var(--cm-teal-dark); }
  .cm-popup .cm-delete { background:transparent; color:var(--cm-text-muted); margin-right:auto; padding:6px 8px; }
  .cm-popup .cm-delete:hover { color:#e5484d; }

  .cm-panel { position:fixed; top:0; right:0; height:100vh; width:300px; max-width:86vw; z-index:850; background:var(--cm-surface); border-left:1px solid var(--cm-border); box-shadow:var(--cm-shadow-lg); display:flex; flex-direction:column; transform:translateX(100%); transition:transform 240ms var(--cm-ease); }
  .cm-panel.show { transform:translateX(0); }
  .cm-panel-head { padding:16px 16px 12px; border-bottom:1px solid var(--cm-border2); }
  .cm-panel-head-row { display:flex; align-items:center; justify-content:space-between; font-family:'League Spartan',sans-serif; font-weight:700; font-size:13.5px; color:var(--cm-text); }
  .cm-panel-head-row button { background:none; border:none; color:var(--cm-text-muted); cursor:pointer; font-size:16px; line-height:1; }
  .cm-panel-head-row button:hover { color:var(--cm-text); }
  .cm-panel-sub { font-size:11px; color:var(--cm-text-muted); margin-top:3px; }
  .cm-panel-list { overflow-y:auto; padding:8px; flex:1; }
  .cm-panel-item { display:flex; gap:8px; padding:9px 8px; border-radius:9px; }
  .cm-panel-item:hover { background:var(--cm-bg); }
  .cm-panel-item .num { flex-shrink:0; width:20px; height:20px; border-radius:50%; background:var(--cm-orange); color:#fff; font-size:10.5px; font-weight:700; display:flex; align-items:center; justify-content:center; font-family:'League Spartan',sans-serif; margin-top:1px; }
  .cm-panel-item .body { flex:1; min-width:0; cursor:pointer; }
  .cm-panel-item .zone { font-size:10.5px; color:var(--cm-teal); font-weight:700; text-transform:uppercase; letter-spacing:.3px; margin-bottom:2px; }
  .cm-panel-item .txt { font-size:12.5px; color:var(--cm-text2); line-height:1.4; word-wrap:break-word; }
  .cm-panel-item .del { flex-shrink:0; background:none; border:none; color:var(--cm-text-muted); cursor:pointer; font-size:13px; }
  .cm-panel-item .del:hover { color:var(--cm-orange); }
  .cm-panel-empty { padding:24px 16px; text-align:center; color:var(--cm-text-muted); font-size:12.5px; line-height:1.5; }
  .cm-panel-foot { padding:8px 10px; border-top:1px solid var(--cm-border2); display:flex; gap:6px; }
  .cm-panel-foot + .cm-panel-foot { border-top:none; padding-top:0; }
  .cm-panel-foot button { flex:1; font-family:'League Spartan',sans-serif; font-size:11px; font-weight:700; border-radius:8px; padding:8px 4px; border:1px solid var(--cm-border); background:transparent; color:var(--cm-text2); cursor:pointer; }
  .cm-panel-foot button:hover { border-color:var(--cm-teal); color:var(--cm-teal); }
  .cm-panel-foot button.primary { background:var(--cm-teal); color:#fff; border-color:var(--cm-teal); }
  .cm-panel-foot button.primary:hover { background:var(--cm-teal-dark); }

  .cm-status { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:960; background:var(--cm-text); color:#fff; font-family:'DM Sans',sans-serif; font-size:12.5px; padding:8px 16px; border-radius:20px; box-shadow:var(--cm-shadow-lg); opacity:0; pointer-events:none; transition:opacity 200ms ease; white-space:nowrap; max-width:90vw; }
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
      <button onclick="cmTogglePanel(false)" aria-label="Fermer">✕</button>
    </div>
    <div class="cm-panel-sub" id="cmPanelSub"></div>
  </div>
  <div class="cm-panel-list" id="cmList"></div>
  <div class="cm-panel-foot">
    <button onclick="cmClearAll()">🗑️ Effacer (page)</button>
    <button onclick="cmClearSite()">🧹 Vider tout (site)</button>
  </div>
  <div class="cm-panel-foot">
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
    style.textContent = CSS;
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

  function boot() {
  injectUI();
  var PAGE_FILE = (location.pathname.split('/').pop() || document.title || 'page').toLowerCase();
  var PAGE_TITLE = document.title || PAGE_FILE;
  var STORAGE_KEY = 'annotate_' + CONFIG.project + '_v1'; // PARTAGÉ entre toutes les pages du projet ouvertes dans le même navigateur
  var EMAIL_TO = CONFIG.email;
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
    return allComments.filter(function (c) { return c.page === PAGE_FILE; });
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      allComments = raw ? JSON.parse(raw) : [];
      allComments.forEach(function (c) { if (!c.id) c.id = uid(); });
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
      var anchorEl = null;
      // Sélection multiple : on ne garde que les cibles actuellement visibles ; la pastille principale va sur la première.
      var multi = null;
      if (c.type === 'pin' && c.targets && c.targets.length > 1) {
        multi = [];
        c.targets.forEach(function (t) { var el = resolveStablePath(t.path); if (isVisible(el)) multi.push(el); });
        if (!multi.length) return;
        anchorEl = multi[0];
      } else if (c.anchor && c.anchor.path) {
        anchorEl = resolveStablePath(c.anchor.path);
        if (!isVisible(anchorEl)) return; // étape/onglet masqué pour l'instant : on n'affiche pas ce repère
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
      pin.onclick = function (e) {
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
      };
      document.body.appendChild(pin);
    });
    // Survol d'une pastille : les cadres de son commentaire s'allument (utile pour un groupe d'éléments)
    var pins = document.querySelectorAll('.cm-pin');
    for (var k = 0; k < pins.length; k++) {
      pins[k].onmouseenter = function () { glow(this.dataset.id, true); };
      pins[k].onmouseleave = function () { glow(this.dataset.id, false); };
    }
  }
  function glow(id, on) {
    var frames = document.querySelectorAll('.cm-box-saved[data-id="' + id + '"], .cm-pin[data-id="' + id + '"]');
    for (var i = 0; i < frames.length; i++) frames[i].classList.toggle('cm-glow', on);
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
      if (m.type === 'attributes') return !isOwnNode(m.target);
      for (var i = 0; i < m.addedNodes.length; i++) if (!isOwnNode(m.addedNodes[i])) return true;
      for (var j = 0; j < m.removedNodes.length; j++) if (!isOwnNode(m.removedNodes[j])) return true;
      return false;
    });
    if (!relevant) return;
    clearTimeout(moTimer);
    moTimer = setTimeout(function () { renderMarkers(); positionEditOutline(); }, 120);
  });
  domObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'hidden'], childList: true, subtree: true });

  function renderList() {
    var pc = pageComments();
    var list = document.getElementById('cmList');
    var cmCountEl = document.getElementById('cmCount');
    if (cmCountEl) { cmCountEl.textContent = pc.length || ''; cmCountEl.dataset.zero = pc.length ? '0' : '1'; }
    var panelBtnEl = document.getElementById('cmPanelBtn');
    if (panelBtnEl) panelBtnEl.classList.toggle('cm-on', pc.length > 0);
    var panelCountEl = document.getElementById('cmPanelCount');
    if (panelCountEl) panelCountEl.textContent = pc.length;
    var subEl = document.getElementById('cmPanelSub');
    if (subEl) {
      var nPages = {};
      allComments.forEach(function (c) { nPages[c.page] = true; });
      var nPagesCount = Object.keys(nPages).length;
      subEl.textContent = allComments.length + ' au total sur ' + nPagesCount + ' page(s) du site';
    }
    if (!pc.length) {
      list.innerHTML = '<div class="cm-panel-empty">Aucun commentaire sur cette page pour l’instant.<br>Active le mode commentaire (bouton 💬 ou ' + SHORTCUT_LABEL + ') puis clique, encadre une zone ou Maj+glisse sur du texte.</div>';
      return;
    }
    var html = '';
    pc.forEach(function (c, i) {
      html += '<div class="cm-panel-item">' +
        '<div class="num">' + (i + 1) + '</div>' +
        '<div class="body" onclick="cmFocus(\'' + c.id + '\')" title="Voir sur la page"><div class="zone">' + typeIcon(c.type) + ' ' + cmEsc(c.zone) + '</div><div class="txt">' + cmEsc(c.text) + '</div></div>' +
        '<button class="del" onclick="cmDeleteById(\'' + c.id + '\')" aria-label="Supprimer">✕</button>' +
        '</div>';
    });
    list.innerHTML = html;
  }

  /* Clic sur un commentaire de la liste : on active le mode (les repères ne sont visibles qu'en mode
     annotation), on fait défiler jusqu'au repère et on le fait clignoter pour le retrouver d'un coup d'œil. */
  window.cmFocus = function (id) {
    if (!active) cmToggle(true);
    renderMarkers();
    var frame = document.querySelector('.cm-box-saved[data-id="' + id + '"]');
    var targets = frame ? [frame] : (sessionMarks[id] || []);
    var pin = document.querySelector('.cm-pin[data-id="' + id + '"]');
    var scrollEl = targets[0] || pin;
    if (!scrollEl) { cmStatus('Repère non visible sur cette vue (étape ou onglet masqué ?)'); return; }
    scrollEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    targets.forEach(function (el) {
      el.classList.remove('cm-ola');
      void el.offsetWidth; // relance l'animation si on reclique
      el.classList.add('cm-ola');
      setTimeout(function () { el.classList.remove('cm-ola'); }, 2100);
    });
  };

  window.cmDeleteById = function (id) {
    if (sessionMarks[id]) { unwrapMarks(sessionMarks[id]); delete sessionMarks[id]; }
    allComments = allComments.filter(function (c) { return c.id !== id; });
    persist(); renderMarkers(); renderList();
  };
  window.cmClearAll = function () {
    var pc = pageComments();
    if (!pc.length) return;
    pc.forEach(function (c) { if (sessionMarks[c.id]) { unwrapMarks(sessionMarks[c.id]); delete sessionMarks[c.id]; } });
    allComments = allComments.filter(function (c) { return c.page !== PAGE_FILE; });
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
      box.className = 'cm-box cm-ui cm-box-editing';
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
    closePopup(true);
    var isEdit = !!(meta && meta.existing);
    if (meta && meta.outlineEl) showEditOutline(meta.outlineEl);
    if (isEdit && meta.type === 'box') meta.boxEl = document.querySelector('.cm-box-saved[data-id="' + meta.existing.id + '"]'); // (re)trouvé après un éventuel re-rendu
    if (meta && meta.type === 'box' && meta.boxEl && meta.box) makeBoxEditable(meta.boxEl, meta);
    var pop = document.createElement('div');
    pop.className = 'cm-popup cm-ui';
    pop.innerHTML =
      '<div class="cm-zone">' + typeIcon(meta && meta.type) + ' ' + cmEsc(zone) + '</div>' +
      '<textarea placeholder="Ton commentaire, ta question ou ta critique… (Entrée = enregistrer, Maj+Entrée = nouvelle ligne, Échap = annuler)">' +
      (isEdit ? cmEsc(meta.existing.text) : '') + '</textarea>' +
      '<div class="cm-popup-actions">' +
      (isEdit ? '<button class="cm-delete" title="Supprimer ce commentaire">🗑</button>' : '') +
      '<button class="cm-cancel">Annuler</button><button class="cm-save">Enregistrer</button></div>';
    document.body.appendChild(pop);
    placePopup(pop, targetRectOf(meta), x, y);
    pop._meta = meta;
    makePopupDraggable(pop, pop.querySelector('.cm-zone'));
    var ta = pop.querySelector('textarea');
    ta.focus();
    if (isEdit) { var vlen = ta.value.length; ta.setSelectionRange(vlen, vlen); }

    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        pop.querySelector('.cm-save').click();
      }
    });

    pop.querySelector('.cm-cancel').onclick = function (e) { e.stopPropagation(); closePopup(true); };
    if (isEdit) {
      pop.querySelector('.cm-delete').onclick = function (e) {
        e.stopPropagation();
        endBoxEdit(meta);
        window.cmDeleteById(meta.existing.id);
        hideEditOutline();
        pop.remove();
        pendingPopup = null;
      };
    }
    pop.querySelector('.cm-save').onclick = function (e) {
      e.stopPropagation();
      var text = ta.value.trim();
      endBoxEdit(meta);
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
          meta.existing.text = text;
          if (desc) { meta.existing.zone = desc.label; meta.existing.anchor = desc.anchor; meta.existing.fallback = meta.box; }
          if (multi) { meta.existing.zone = multi.zone; meta.existing.anchor = multi.anchor; meta.existing.fallback = multi.fallback; meta.existing.targets = multi.targets; }
          cmStatus('Commentaire modifié');
        } else {
          var id = uid();
          var c = { id: id, type: meta.type, page: PAGE_FILE, pageTitle: PAGE_TITLE, zone: desc ? desc.label : zone, text: text, date: new Date().toISOString() };
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
          allComments.push(c);
          cmStatus('Commentaire enregistré');
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
    panel.classList.toggle('show', show);
  };

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
    var PILL_POS_KEY = 'annotate_pill_pos';
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

  // Raccourci clavier : Alt+A (Windows/Linux) / ⌥+A (Mac) — "A" comme Annotate, le même partout.
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
    if (e.key === 'Escape') {
      if (pendingPopup) { e.preventDefault(); closePopup(true); }
      else if (active) { e.preventDefault(); cmToggle(false); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.shiftKey || !e.altKey) return;
    if (e.code !== 'KeyA') return;
    if (isTypingIn(e.target)) return;
    e.preventDefault();
    cmToggle();
  });
  var cmToggleBtnEl = document.getElementById('cmToggleBtn');
  if (cmToggleBtnEl) cmToggleBtnEl.title = 'Mode commentaire (' + SHORTCUT_LABEL + ')';

  var statusTimer = null;
  function cmStatus(msg) {
    var el = document.getElementById('cmStatus');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  /* Rapport UNIQUE regroupant les commentaires de TOUTES les pages du site visitées dans ce
     navigateur (localStorage partagé entre les fichiers file://) — pas seulement la page courante. */
  function buildReport() {
    if (!allComments.length) return '';
    var byPage = {};
    var order = [];
    allComments.forEach(function (c) {
      if (!byPage[c.page]) { byPage[c.page] = { title: c.pageTitle || c.page, items: [] }; order.push(c.page); }
      byPage[c.page].items.push(c);
    });
    var lines = [
      CONFIG.project + ' — Rapport de commentaires (site)',
      'Date : ' + new Date().toLocaleString('fr-FR'),
      allComments.length + ' commentaire(s) sur ' + order.length + ' page(s)',
      ''
    ];
    var n = 0;
    order.forEach(function (page) {
      var grp = byPage[page];
      lines.push('=== ' + grp.title + ' (' + page + ') ===');
      grp.items.forEach(function (c) {
        n++;
        lines.push('#' + n + ' [' + typeIcon(c.type) + ' ' + c.zone + ']');
        lines.push(c.text);
        lines.push('');
      });
    });
    return lines.join('\n');
  }

  window.cmCopy = function () {
    if (!allComments.length) { cmStatus('Aucun commentaire à copier sur tout le site'); return; }
    var txt = buildReport();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () {
        cmStatus('Copié (tout le site) — colle-le à Claude ou où tu veux');
      }).catch(function () {
        cmStatus('Copie impossible — essaie Envoyer par email');
      });
    } else {
      cmStatus('Copie non supportée par ce navigateur');
    }
  };

  window.cmSendMail = function () {
    if (!allComments.length) { cmStatus('Aucun commentaire à envoyer'); return; }
    if (!EMAIL_TO) { cmStatus('Aucune adresse configurée (data-email) — utilise Copier'); return; }
    var body = buildReport();
    var subject = CONFIG.project + ' — Rapport de commentaires (' + allComments.length + ')';
    var mailto = 'mailto:' + EMAIL_TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    if (mailto.length > 1900) {
      cmStatus('Trop long pour un email — utilise Copier');
      return;
    }
    window.location.href = mailto;
  };

  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('click', onClickCapture, true);

  load();
  renderMarkers();
  renderList();
  } // fin boot()

  // Démarre dès que le <body> existe (que la balise <script> soit dans <head> ou en fin de page).
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
