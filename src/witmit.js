/*!
 * witmit 0.2.0 — widget d'annotation visuelle (charte « Objet »)
 * Un seul fichier : injecte son style, son interface et sa logique au chargement.
 * Polices (dossier witmit-polices/ à côté de ce fichier) : Tektur, Martian Mono, Syne et Doto, SIL Open Font License 1.1.
 * Usage : <script src="witmit.js" data-project="monprojet" data-email="moi@exemple.fr"></script>
 * Raccourci : Alt+A (Windows/Linux) · ⌥+A (Mac)
 * Auteur (site où l'on est connecté) : window.witmit.identify({ nom: 'Marine' }) · identify(null) — voir plus bas.
 *
 * Icônes : tracés de Phosphor Icons, graisse Regular (@phosphor-icons/core 2.1.1), recopiés dans l'objet ICONES.
 * Leur licence, qui doit voyager avec ce fichier :
 *
 *   MIT License
 *
 *   Copyright (c) 2023 Phosphor Icons
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *   SOFTWARE.
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

  /* ---------- icônes : Phosphor Regular 2.1.1 (licence MIT, en tête de ce fichier) ----------
     Tracés recopiés tels quels depuis assets/regular/<nom>.svg du paquet @phosphor-icons/core 2.1.1
     (viewBox 0 0 256 256, couleur du texte). Aucun fichier ni aucune requête en plus. Une icône n'a qu'un
     sens dans tout le widget (fiche Icones du design system) ; le nom accessible est porté par le bouton. */
  var ICONES = {
    PenNib: '<path d="M248,92.68a15.86,15.86,0,0,0-4.69-11.31L174.63,12.68a16,16,0,0,0-22.63,0L123.57,41.11l-58,21.77A16.06,16.06,0,0,0,55.35,75.23L32.11,214.68A8,8,0,0,0,40,224a8.4,8.4,0,0,0,1.32-.11l139.44-23.24a16,16,0,0,0,12.35-10.17l21.77-58L243.31,104A15.87,15.87,0,0,0,248,92.68Zm-69.87,92.19L63.32,204l47.37-47.37a28,28,0,1,0-11.32-11.32L52,192.7,71.13,77.86,126,57.29,198.7,130ZM112,132a12,12,0,1,1,12,12A12,12,0,0,1,112,132Zm96-15.32L139.31,48l24-24L232,92.68Z"/>',
    CrosshairSimple: '<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm8,191.63V184a8,8,0,0,0-16,0v31.63A88.13,88.13,0,0,1,40.37,136H72a8,8,0,0,0,0-16H40.37A88.13,88.13,0,0,1,120,40.37V72a8,8,0,0,0,16,0V40.37A88.13,88.13,0,0,1,215.63,120H184a8,8,0,0,0,0,16h31.63A88.13,88.13,0,0,1,136,215.63Z"/>',
    CursorClick: '<path d="M88,24V16a8,8,0,0,1,16,0v8a8,8,0,0,1-16,0ZM16,104h8a8,8,0,0,0,0-16H16a8,8,0,0,0,0,16ZM124.42,39.16a8,8,0,0,0,10.74-3.58l8-16a8,8,0,0,0-14.31-7.16l-8,16A8,8,0,0,0,124.42,39.16Zm-96,81.69-16,8a8,8,0,0,0,7.16,14.31l16-8a8,8,0,1,0-7.16-14.31ZM219.31,184a16,16,0,0,1,0,22.63l-12.68,12.68a16,16,0,0,1-22.63,0L132.7,168,115,214.09c0,.1-.08.21-.13.32a15.83,15.83,0,0,1-14.6,9.59l-.79,0a15.83,15.83,0,0,1-14.41-11L32.8,52.92A16,16,0,0,1,52.92,32.8L213,85.07a16,16,0,0,1,1.41,29.8l-.32.13L168,132.69ZM208,195.31,156.69,144h0a16,16,0,0,1,4.93-26l.32-.14,45.95-17.64L48,48l52.2,159.86,17.65-46c0-.11.08-.22.13-.33a16,16,0,0,1,11.69-9.34,16.72,16.72,0,0,1,3-.28,16,16,0,0,1,11.3,4.69L195.31,208Z"/>',
    BoundingBox: '<path d="M208,96a16,16,0,0,0,16-16V48a16,16,0,0,0-16-16H176a16,16,0,0,0-16,16v8H96V48A16,16,0,0,0,80,32H48A16,16,0,0,0,32,48V80A16,16,0,0,0,48,96h8v64H48a16,16,0,0,0-16,16v32a16,16,0,0,0,16,16H80a16,16,0,0,0,16-16v-8h64v8a16,16,0,0,0,16,16h32a16,16,0,0,0,16-16V176a16,16,0,0,0-16-16h-8V96ZM176,48h32V80H176ZM48,48H80V63.9a.51.51,0,0,0,0,.2V80H48ZM80,208H48V176H80v15.9a.51.51,0,0,0,0,.2V208Zm128,0H176V176h32Zm-24-48h-8a16,16,0,0,0-16,16v8H96v-8a16,16,0,0,0-16-16H72V96h8A16,16,0,0,0,96,80V72h64v8a16,16,0,0,0,16,16h8Z"/>',
    TextT: '<path d="M208,56V88a8,8,0,0,1-16,0V64H136V192h24a8,8,0,0,1,0,16H96a8,8,0,0,1,0-16h24V64H64V88a8,8,0,0,1-16,0V56a8,8,0,0,1,8-8H200A8,8,0,0,1,208,56Z"/>',
    SelectionPlus: '<path d="M152,40a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h32A8,8,0,0,1,152,40Zm-8,168H112a8,8,0,0,0,0,16h32a8,8,0,0,0,0-16ZM208,48V72a8,8,0,0,0,16,0V48a16,16,0,0,0-16-16H184a8,8,0,0,0,0,16Zm8,56a8,8,0,0,0-8,8v32a8,8,0,0,0,16,0V112A8,8,0,0,0,216,104ZM40,152a8,8,0,0,0,8-8V112a8,8,0,0,0-16,0v32A8,8,0,0,0,40,152Zm32,56H48V184a8,8,0,0,0-16,0v24a16,16,0,0,0,16,16H72a8,8,0,0,0,0-16ZM72,32H48A16,16,0,0,0,32,48V72a8,8,0,0,0,16,0V48H72a8,8,0,0,0,0-16ZM240,208H224V192a8,8,0,0,0-16,0v16H192a8,8,0,0,0,0,16h16v16a8,8,0,0,0,16,0V224h16a8,8,0,0,0,0-16Z"/>',
    ImageBroken: '<path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16h64a8,8,0,0,0,7.59-5.47l14.83-44.48L163,151.43a8.07,8.07,0,0,0,4.46-4.46l14.62-36.55,44.48-14.83A8,8,0,0,0,232,88V56A16,16,0,0,0,216,40ZM112.41,157.47,98.23,200H40V172l52-52,30.42,30.42L117,152.57A8,8,0,0,0,112.41,157.47ZM216,82.23,173.47,96.41a8,8,0,0,0-4.9,4.62l-14.72,36.82L138.58,144l-35.27-35.27a16,16,0,0,0-22.62,0L40,149.37V56H216Zm12.68,33a8,8,0,0,0-7.21-1.1l-23.8,7.94a8,8,0,0,0-4.9,4.61l-14.31,35.77-35.77,14.31a8,8,0,0,0-4.61,4.9l-7.94,23.8A8,8,0,0,0,137.73,216H216a16,16,0,0,0,16-16V121.73A8,8,0,0,0,228.68,115.24ZM216,200H148.83l3.25-9.75,35.51-14.2a8.07,8.07,0,0,0,4.46-4.46l14.2-35.51,9.75-3.25Z"/>',
    Bug: '<path d="M144,92a12,12,0,1,1,12,12A12,12,0,0,1,144,92ZM100,80a12,12,0,1,0,12,12A12,12,0,0,0,100,80Zm116,64A87.76,87.76,0,0,1,213,167l22.24,9.72A8,8,0,0,1,232,192a7.89,7.89,0,0,1-3.2-.67L207.38,182a88,88,0,0,1-158.76,0L27.2,191.33A7.89,7.89,0,0,1,24,192a8,8,0,0,1-3.2-15.33L43,167A87.76,87.76,0,0,1,40,144v-8H16a8,8,0,0,1,0-16H40v-8a87.76,87.76,0,0,1,3-23L20.8,79.33a8,8,0,1,1,6.4-14.66L48.62,74a88,88,0,0,1,158.76,0l21.42-9.36a8,8,0,0,1,6.4,14.66L213,89.05a87.76,87.76,0,0,1,3,23v8h24a8,8,0,0,1,0,16H216ZM56,120H200v-8a72,72,0,0,0-144,0Zm64,95.54V136H56v8A72.08,72.08,0,0,0,120,215.54ZM200,144v-8H136v79.54A72.08,72.08,0,0,0,200,144Z"/>',
    Ruler: '<path d="M235.32,73.37,182.63,20.69a16,16,0,0,0-22.63,0L20.68,160a16,16,0,0,0,0,22.63l52.69,52.68a16,16,0,0,0,22.63,0L235.32,96A16,16,0,0,0,235.32,73.37ZM84.68,224,32,171.31l32-32,26.34,26.35a8,8,0,0,0,11.32-11.32L75.31,128,96,107.31l26.34,26.35a8,8,0,0,0,11.32-11.32L107.31,96,128,75.31l26.34,26.35a8,8,0,0,0,11.32-11.32L139.31,64l32-32L224,84.69Z"/>',
    PencilSimpleLine: '<path d="M227.32,73.37,182.63,28.69a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H216a8,8,0,0,0,0-16H115.32l112-112A16,16,0,0,0,227.32,73.37ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.69,147.32,64l24-24L216,84.69Z"/>',
    ArrowsClockwise: '<path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z"/>',
    Lightbulb: '<path d="M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Zm-16,0a72,72,0,0,0-73.74-72c-39,.92-70.47,33.39-70.26,72.39a71.65,71.65,0,0,0,27.64,56.3A32,32,0,0,1,96,186v6h64v-6a32.15,32.15,0,0,1,12.47-25.35A71.65,71.65,0,0,0,200,104Zm-16.11-9.34a57.6,57.6,0,0,0-46.56-46.55,8,8,0,0,0-2.66,15.78c16.57,2.79,30.63,16.85,33.44,33.45A8,8,0,0,0,176,104a9,9,0,0,0,1.35-.11A8,8,0,0,0,183.89,94.66Z"/>',
    SealQuestion: '<path d="M225.86,102.82c-3.77-3.94-7.67-8-9.14-11.57-1.36-3.27-1.44-8.69-1.52-13.94-.15-9.76-.31-20.82-8-28.51s-18.75-7.85-28.51-8c-5.25-.08-10.67-.16-13.94-1.52-3.56-1.47-7.63-5.37-11.57-9.14C146.28,23.51,138.44,16,128,16s-18.27,7.51-25.18,14.14c-3.94,3.77-8,7.67-11.57,9.14C88,40.64,82.56,40.72,77.31,40.8c-9.76.15-20.82.31-28.51,8S41,67.55,40.8,77.31c-.08,5.25-.16,10.67-1.52,13.94-1.47,3.56-5.37,7.63-9.14,11.57C23.51,109.72,16,117.56,16,128s7.51,18.27,14.14,25.18c3.77,3.94,7.67,8,9.14,11.57,1.36,3.27,1.44,8.69,1.52,13.94.15,9.76.31,20.82,8,28.51s18.75,7.85,28.51,8c5.25.08,10.67.16,13.94,1.52,3.56,1.47,7.63,5.37,11.57,9.14C109.72,232.49,117.56,240,128,240s18.27-7.51,25.18-14.14c3.94-3.77,8-7.67,11.57-9.14,3.27-1.36,8.69-1.44,13.94-1.52,9.76-.15,20.82-.31,28.51-8s7.85-18.75,8-28.51c.08-5.25.16-10.67,1.52-13.94,1.47-3.56,5.37-7.63,9.14-11.57C232.49,146.28,240,138.44,240,128S232.49,109.73,225.86,102.82Zm-11.55,39.29c-4.79,5-9.75,10.17-12.38,16.52-2.52,6.1-2.63,13.07-2.73,19.82-.1,7-.21,14.33-3.32,17.43s-10.39,3.22-17.43,3.32c-6.75.1-13.72.21-19.82,2.73-6.35,2.63-11.52,7.59-16.52,12.38S132,224,128,224s-9.15-4.92-14.11-9.69-10.17-9.75-16.52-12.38c-6.1-2.52-13.07-2.63-19.82-2.73-7-.1-14.33-.21-17.43-3.32s-3.22-10.39-3.32-17.43c-.1-6.75-.21-13.72-2.73-19.82-2.63-6.35-7.59-11.52-12.38-16.52S32,132,32,128s4.92-9.15,9.69-14.11,9.75-10.17,12.38-16.52c2.52-6.1,2.63-13.07,2.73-19.82.1-7,.21-14.33,3.32-17.43S70.51,56.9,77.55,56.8c6.75-.1,13.72-.21,19.82-2.73,6.35-2.63,11.52-7.59,16.52-12.38S124,32,128,32s9.15,4.92,14.11,9.69,10.17,9.75,16.52,12.38c6.1,2.52,13.07,2.63,19.82,2.73,7,.1,14.33.21,17.43,3.32s3.22,10.39,3.32,17.43c.1,6.75.21,13.72,2.73,19.82,2.63,6.35,7.59,11.52,12.38,16.52S224,124,224,128,219.08,137.15,214.31,142.11ZM140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180Zm28-72c0,17.38-13.76,31.93-32,35.28V144a8,8,0,0,1-16,0v-8a8,8,0,0,1,8-8c13.23,0,24-9,24-20s-10.77-20-24-20-24,9-24,20v4a8,8,0,0,1-16,0v-4c0-19.85,17.94-36,40-36S168,88.15,168,108Z"/>',
    Tag: '<path d="M243.31,136,144,36.69A15.86,15.86,0,0,0,132.69,32H40a8,8,0,0,0-8,8v92.69A15.86,15.86,0,0,0,36.69,144L136,243.31a16,16,0,0,0,22.63,0l84.68-84.68a16,16,0,0,0,0-22.63Zm-96,96L48,132.69V48h84.69L232,147.31ZM96,84A12,12,0,1,1,84,72,12,12,0,0,1,96,84Z"/>',
    CloudArrowUp: '<path d="M178.34,165.66,160,147.31V208a8,8,0,0,1-16,0V147.31l-18.34,18.35a8,8,0,0,1-11.32-11.32l32-32a8,8,0,0,1,11.32,0l32,32a8,8,0,0,1-11.32,11.32ZM160,40A88.08,88.08,0,0,0,81.29,88.68,64,64,0,1,0,72,216h40a8,8,0,0,0,0-16H72a48,48,0,0,1,0-96c1.1,0,2.2,0,3.29.12A88,88,0,0,0,72,128a8,8,0,0,0,16,0,72,72,0,1,1,100.8,66,8,8,0,0,0,3.2,15.34,7.9,7.9,0,0,0,3.2-.68A88,88,0,0,0,160,40Z"/>',
    CircleNotch: '<path d="M232,128a104,104,0,0,1-208,0c0-41,23.81-78.36,60.66-95.27a8,8,0,0,1,6.68,14.54C60.15,61.59,40,93.27,40,128a88,88,0,0,0,176,0c0-34.73-20.15-66.41-51.34-80.73a8,8,0,0,1,6.68-14.54C208.19,49.64,232,87,232,128Z"/>',
    CloudCheck: '<path d="M160,40A88.09,88.09,0,0,0,81.29,88.67,64,64,0,1,0,72,216h88a88,88,0,0,0,0-176Zm0,160H72a48,48,0,0,1,0-96c1.1,0,2.2,0,3.29.11A88,88,0,0,0,72,128a8,8,0,0,0,16,0,72,72,0,1,1,72,72Zm37.66-93.66a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L144,148.69l42.34-42.35A8,8,0,0,1,197.66,106.34Z"/>',
    WarningCircle: '<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z"/>',
    Eye: '<path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z"/>',
    CheckCircle: '<path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/>',
    LockSimple: '<path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Z"/>',
    Question: '<path d="M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/>',
    ChatCircleText: '<path d="M168,112a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,112Zm-8,24H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm72-8A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Zm-16,0A88,88,0,1,0,51.81,172.06a8,8,0,0,1,.66,6.54L40,216,77.4,203.53a7.85,7.85,0,0,1,2.53-.42,8,8,0,0,1,4,1.08A88,88,0,0,0,216,128Z"/>',
    ArrowBendDownRight: '<path d="M229.66,157.66l-48,48a8,8,0,0,1-11.32-11.32L204.69,160H128A104.11,104.11,0,0,1,24,56a8,8,0,0,1,16,0,88.1,88.1,0,0,0,88,88h76.69l-34.35-34.34a8,8,0,0,1,11.32-11.32l48,48A8,8,0,0,1,229.66,157.66Z"/>',
    ArrowBendUpLeft: '<path d="M232,200a8,8,0,0,1-16,0,88.1,88.1,0,0,0-88-88H51.31l34.35,34.34a8,8,0,0,1-11.32,11.32l-48-48a8,8,0,0,1,0-11.32l48-48A8,8,0,0,1,85.66,61.66L51.31,96H128A104.11,104.11,0,0,1,232,200Z"/>',
    ArrowCounterClockwise: '<path d="M224,128a96,96,0,0,1-94.71,96H128A95.38,95.38,0,0,1,62.1,197.8a8,8,0,0,1,11-11.63A80,80,0,1,0,71.43,71.39a3.07,3.07,0,0,1-.26.25L44.59,96H72a8,8,0,0,1,0,16H24a8,8,0,0,1-8-8V56a8,8,0,0,1,16,0V85.8L60.25,60A96,96,0,0,1,224,128Z"/>',
    X: '<path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/>',
    Trash: '<path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"/>',
    Check: '<path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/>',
    DotsSixVertical: '<path d="M104,60A12,12,0,1,1,92,48,12,12,0,0,1,104,60Zm60,12a12,12,0,1,0-12-12A12,12,0,0,0,164,72ZM92,116a12,12,0,1,0,12,12A12,12,0,0,0,92,116Zm72,0a12,12,0,1,0,12,12A12,12,0,0,0,164,116ZM92,184a12,12,0,1,0,12,12A12,12,0,0,0,92,184Zm72,0a12,12,0,1,0,12,12A12,12,0,0,0,164,184Z"/>',
    EyeSlash: '<path d="M53.92,34.62A8,8,0,1,0,42.08,45.38L61.32,66.55C25,88.84,9.38,123.2,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208a127.11,127.11,0,0,0,52.07-10.83l22,24.21a8,8,0,1,0,11.84-10.76Zm47.33,75.84,41.67,45.85a32,32,0,0,1-41.67-45.85ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.16,133.16,0,0,1,25,128c4.69-8.79,19.66-33.39,47.35-49.38l18,19.75a48,48,0,0,0,63.66,70l14.73,16.2A112,112,0,0,1,128,192Zm6-95.43a8,8,0,0,1,3-15.72,48.16,48.16,0,0,1,38.77,42.64,8,8,0,0,1-7.22,8.71,6.39,6.39,0,0,1-.75,0,8,8,0,0,1-8-7.26A32.09,32.09,0,0,0,134,96.57Zm113.28,34.69c-.42.94-10.55,23.37-33.36,43.8a8,8,0,1,1-10.67-11.92A132.77,132.77,0,0,0,231.05,128a133.15,133.15,0,0,0-23.12-30.77C185.67,75.19,158.78,64,128,64a118.37,118.37,0,0,0-19.36,1.57A8,8,0,1,1,106,49.79,134,134,0,0,1,128,48c34.88,0,66.57,13.26,91.66,38.35,18.83,18.83,27.3,37.62,27.65,38.41A8,8,0,0,1,247.31,131.26Z"/>',
    CaretRight: '<path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"/>',
    CaretDown: '<path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"/>',
    CaretUp: '<path d="M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z"/>',
    MagnifyingGlassPlus: '<path d="M152,112a8,8,0,0,1-8,8H120v24a8,8,0,0,1-16,0V120H80a8,8,0,0,1,0-16h24V80a8,8,0,0,1,16,0v24h24A8,8,0,0,1,152,112Zm77.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88.11,88.11,0,1,1,11.31-11.31l50.07,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"/>',
    Info: '<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z"/>',
    Signature: '<path d="M232,168H63.86c2.66-5.24,5.33-10.63,8-16.11,15,1.65,32.58-8.78,52.66-31.14,5,13.46,14.45,30.93,30.58,31.25,9.06.18,18.11-5.2,27.42-16.37C189.31,143.75,203.3,152,232,152a8,8,0,0,0,0-16c-30.43,0-39.43-10.45-40-16.11a7.67,7.67,0,0,0-5.46-7.75,8.14,8.14,0,0,0-9.25,3.49c-12.07,18.54-19.38,20.43-21.92,20.37-8.26-.16-16.66-19.52-19.54-33.42a8,8,0,0,0-14.09-3.37C101.54,124.55,88,133.08,79.57,135.29,88.06,116.42,94.4,99.85,98.46,85.9c6.82-23.44,7.32-39.83,1.51-50.1-3-5.38-9.34-11.8-22.06-11.8C61.85,24,49.18,39.18,43.14,65.65c-3.59,15.71-4.18,33.21-1.62,48s7.87,25.55,15.59,31.94c-3.73,7.72-7.53,15.26-11.23,22.41H24a8,8,0,0,0,0,16H37.41c-11.32,21-20.12,35.64-20.26,35.88a8,8,0,1,0,13.71,8.24c.15-.26,11.27-18.79,24.7-44.12H232a8,8,0,0,0,0-16ZM58.74,69.21C62.72,51.74,70.43,40,77.91,40c5.33,0,7.1,1.86,8.13,3.67,3,5.33,6.52,24.19-21.66,86.39C56.12,118.78,53.31,93,58.74,69.21Z"/>',
    Broom: '<path d="M235.5,216.81c-22.56-11-35.5-34.58-35.5-64.8V134.73a15.94,15.94,0,0,0-10.09-14.87L165,110a8,8,0,0,1-4.48-10.34l21.32-53a28,28,0,0,0-16.1-37,28.14,28.14,0,0,0-35.82,16,.61.61,0,0,0,0,.12L108.9,79a8,8,0,0,1-10.37,4.49L73.11,73.14A15.89,15.89,0,0,0,55.74,76.8C34.68,98.45,24,123.75,24,152a111.45,111.45,0,0,0,31.18,77.53A8,8,0,0,0,61,232H232a8,8,0,0,0,3.5-15.19ZM67.14,88l25.41,10.3a24,24,0,0,0,31.23-13.45l21-53c2.56-6.11,9.47-9.27,15.43-7a12,12,0,0,1,6.88,15.92L145.69,93.76a24,24,0,0,0,13.43,31.14L184,134.73V152c0,.33,0,.66,0,1L55.77,101.71A108.84,108.84,0,0,1,67.14,88Zm48,128a87.53,87.53,0,0,1-24.34-42,8,8,0,0,0-15.49,4,105.16,105.16,0,0,0,18.36,38H64.44A95.54,95.54,0,0,1,40,152a85.9,85.9,0,0,1,7.73-36.29l137.8,55.12c3,18,10.56,33.48,21.89,45.16Z"/>',
    ClipboardText: '<path d="M168,152a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,152Zm-8-40H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm56-64V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V48A16,16,0,0,1,56,32H92.26a47.92,47.92,0,0,1,71.48,0H200A16,16,0,0,1,216,48ZM96,64h64a32,32,0,0,0-64,0ZM200,48H173.25A47.93,47.93,0,0,1,176,64v8a8,8,0,0,1-8,8H88a8,8,0,0,1-8-8V64a47.93,47.93,0,0,1,2.75-16H56V216H200Z"/>',
    DownloadSimple: '<path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z"/>',
    Copy: '<path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"/>',
    EnvelopeSimple: '<path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM203.43,64,128,133.15,52.57,64ZM216,192H40V74.19l82.59,75.71a8,8,0,0,0,10.82,0L216,74.19V192Z"/>',
    ArrowElbowDownLeft: '<path d="M200,32V176a8,8,0,0,1-8,8H67.31l34.35,34.34a8,8,0,0,1-11.32,11.32l-48-48a8,8,0,0,1,0-11.32l48-48a8,8,0,0,1,11.32,11.32L67.31,168H184V32a8,8,0,0,1,16,0Z"/>',
    Command: '<path d="M180,144H160V112h20a36,36,0,1,0-36-36V96H112V76a36,36,0,1,0-36,36H96v32H76a36,36,0,1,0,36,36V160h32v20a36,36,0,1,0,36-36ZM160,76a20,20,0,1,1,20,20H160ZM56,76a20,20,0,0,1,40,0V96H76A20,20,0,0,1,56,76ZM96,180a20,20,0,1,1-20-20H96Zm16-68h32v32H112Zm68,88a20,20,0,0,1-20-20V160h20a20,20,0,0,1,0,40Z"/>',
    Option: '<path d="M232,192a8,8,0,0,1-8,8H160.94a15.92,15.92,0,0,1-14.31-8.84L95.06,88H32a8,8,0,0,1,0-16H95.06a15.92,15.92,0,0,1,14.31,8.84L160.94,184H224A8,8,0,0,1,232,192ZM152,88h72a8,8,0,0,0,0-16H152a8,8,0,0,0,0,16Z"/>'
  };
  // <svg> d'une icône, à la taille voulue (px). Taille écrite en style : une règle de l'hôte sur « svg »
  // (largeur à 100 %, display:block du preflight de Tailwind) ne la change pas. cls : classes en plus.
  function icone(nom, px, cls) {
    var d = ICONES[nom];
    if (!d) return '';
    px = px || 16;
    return '<svg class="wm-icone' + (cls ? ' ' + cls : '') + '" data-icone="' + nom + '" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false" style="width:' + px + 'px;height:' + px + 'px">' + d + '</svg>';
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

  /* ---------- Formes et matières (fiches Fenetre, Touche, Etats ; décisions F1 à F5, F8, F9) ----------
     Une fenêtre (fenêtre de saisie, liste, bandeau, visionneuse, messages passagers) n'est pas découpée
     elle-même : habiller() lui ajoute en premiers enfants trois couches muettes, sans clic, qui portent la
     matière. .wm-ombre : copie floutée de la forme, posée 14 px plus bas (l'ombre d'un élément découpé
     serait coupée avec lui). .wm-verre : la face de verre dépoli, découpée. .wm-contour : le trait de 1 px
     et les deux coins witmit, en SVG retracé à la taille réelle. Aucun parent du verre ne porte filter,
     opacity < 1, mask, clip-path, mix-blend-mode ni backdrop-filter, même pendant une animation : ils
     couperaient le flou du fond (F4). Les fondus portent sur les couches enfants (F9). */
  .cm-ui {
    --wm-forme-fenetre: polygon(0 0, calc(100% - var(--wm-coupe-fenetre)) 0, 100% var(--wm-coupe-fenetre), 100% 100%, var(--wm-coupe-fenetre) 100%, 0 calc(100% - var(--wm-coupe-fenetre)));
    --wm-forme-touche: polygon(var(--wm-coupe-touche) 0, 100% 0, 100% calc(100% - var(--wm-coupe-touche)), calc(100% - var(--wm-coupe-touche)) 100%, 0 100%, 0 var(--wm-coupe-touche));
    /* Contour de focus d'une forme coupée : anneau de 2 px à 2 px de la forme, dont les coins suivent la
       coupe (6 px + 0,586 × l'écart : 7,17 px au bord intérieur, 8,34 px au bord extérieur). */
    --wm-anneau-touche: polygon(evenodd, 8.34px 0, 100% 0, 100% calc(100% - 8.34px), calc(100% - 8.34px) 100%, 0 100%, 0 8.34px, 8.34px 0,
      9.17px 2px, 2px 9.17px, 2px calc(100% - 2px), calc(100% - 9.17px) calc(100% - 2px), calc(100% - 2px) calc(100% - 9.17px), calc(100% - 2px) 2px, 9.17px 2px);
    /* Ombre de la copie floutée et survol des touches : un cran plus blanc (clair) ou plus clair (sombre). */
    --wm-ombre-copie: rgba(0,0,0,.30);
    --wm-face-touche-survol: rgba(255,255,255,.62);
  }
  body[data-wm-theme="client-sombre"] .cm-ui { --wm-ombre-copie: rgba(0,0,0,.35); --wm-face-touche-survol: rgba(255,255,255,.12); }
  .cm-ui[hidden], .cm-ui [hidden] { display:none !important; }
  .wm-habille { isolation:isolate; background:transparent; border:0; border-radius:0; box-shadow:none; }
  .wm-habille > .wm-ombre, .wm-habille > .wm-verre, .wm-habille > .wm-contour { position:absolute; left:0; top:0; width:100%; height:100%; margin:0; padding:0; border:0; pointer-events:none; }
  .wm-habille > .wm-ombre { z-index:-2; top:14px; filter:blur(14px); }
  .wm-habille > .wm-ombre > i { display:block; width:100%; height:100%; clip-path:var(--wm-forme-fenetre); background:var(--wm-ombre-copie); }
  .wm-habille > .wm-verre { z-index:-1; clip-path:var(--wm-forme-fenetre); background:var(--wm-surface); backdrop-filter:blur(var(--wm-verre-flou)) saturate(1.7); -webkit-backdrop-filter:blur(var(--wm-verre-flou)) saturate(1.7); }
  .wm-habille > .wm-contour { z-index:1; overflow:visible; display:block; max-width:none; }
  .wm-contour polygon { fill:none; stroke:var(--wm-contour-fenetre); stroke-width:1; }
  .wm-contour path { fill:none; stroke:var(--wm-ink); stroke-width:2.1; stroke-linecap:square; }
  /* Toutes les icônes : taille écrite sur la balise, couleur du texte qu'elles accompagnent. */
  .cm-ui svg.wm-icone { display:inline-block; flex:none; vertical-align:-0.18em; overflow:visible; max-width:none; fill:currentColor; }
  .cm-ui svg.wm-icone.wm-devant { margin-right:6px; }
  .cm-ui svg.wm-icone.wm-signal { color:var(--wm-signal); }
  .wm-tourne { animation:wmTourne 800ms linear infinite; }
  @keyframes wmTourne { to { transform:rotate(360deg); } }

  /* Touches (fiche Touche) : coins haut gauche et bas droit cassés de 6 px, trait fin ouvert aux coins,
     face ton sur ton. La découpe et le trait vont sur ::before, jamais sur le bouton : son contour de focus
     (::after) n'est ainsi pas rogné (F5). Principale : trait line-strong ; secondaire : trait line. */
  .cm-ui .wm-touche { position:relative; isolation:isolate; display:inline-flex; align-items:center; justify-content:center; gap:8px; height:36px; min-width:0; margin:0; padding:0 10px 0 14px;
    background:transparent; border:0; border-radius:0; box-shadow:none; font-family:var(--wm-font-outil); font-size:13px; font-weight:500; line-height:1; letter-spacing:normal; text-transform:none;
    color:var(--wm-ink); white-space:nowrap; cursor:pointer; text-decoration:none; }
  .cm-ui .wm-touche::before { content:''; position:absolute; inset:0; z-index:-1; clip-path:var(--wm-forme-touche); background:var(--wm-face-touche); border:1px solid var(--wm-line); pointer-events:none; }
  .cm-ui .wm-touche.wm-principale::before { border-color:var(--wm-line-strong); }
  .cm-ui .wm-touche:hover::before { background:var(--wm-face-touche-survol); }
  .cm-ui .wm-touche:active::before { background:var(--wm-surface-raised); }
  .cm-ui .wm-touche.wm-petite { height:32px; padding:0 8px 0 12px; gap:6px; }
  .cm-ui .wm-touche.cm-on::before, .cm-ui .wm-touche[aria-pressed="true"]::before { background:var(--wm-surface-raised); border-color:var(--wm-line-strong); }
  /* Désactivé (fiche Etats) : trait line, libellé et repère ink-faint, face inchangée, pas d'opacité. */
  .cm-ui .wm-touche:disabled, .cm-ui .wm-touche[aria-disabled="true"] { color:var(--wm-ink-faint); cursor:default; }
  .cm-ui .wm-touche:disabled::before, .cm-ui .wm-touche[aria-disabled="true"]::before { border-color:var(--wm-line); background:var(--wm-face-touche); }
  .cm-ui .wm-touche:disabled .wm-repere, .cm-ui .wm-touche[aria-disabled="true"] .wm-repere { border-color:var(--wm-line); color:var(--wm-ink-faint); }
  /* « annuler » et actions discrètes : texte seul, sans cadre (ink-soft : contraste sur le verre, T12). */
  .cm-ui .wm-texte { display:inline-flex; align-items:center; gap:6px; height:36px; margin:0; padding:0 8px; background:none; border:0; border-radius:0; box-shadow:none;
    font-family:var(--wm-font-outil); font-size:13px; font-weight:400; line-height:1; color:var(--wm-ink-soft); cursor:pointer; white-space:nowrap; text-transform:none; }
  .cm-ui .wm-texte:hover { color:var(--wm-ink); }
  /* Raccourci : la touche du clavier dans un petit carré arrondi de 4 px, à droite du libellé. */
  .cm-ui .wm-repere { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 4px; margin-left:4px; border:1px solid var(--wm-line-strong);
    border-radius:var(--wm-radius-repere); font-family:var(--wm-font-outil); font-size:12px; font-weight:400; line-height:1; color:var(--wm-ink-soft); flex:none; }
  /* Icône seule : icône Phosphor dans un cercle fin de 30 px, zone cliquable portée à 44 px par ::before. */
  .cm-ui .wm-cercle { position:relative; display:inline-flex; align-items:center; justify-content:center; flex:none; width:30px; height:30px; margin:0; padding:0;
    border:1px solid var(--wm-line-strong); border-radius:50%; background:transparent; box-shadow:none; color:var(--wm-ink-soft); font-size:0; line-height:0; cursor:pointer; }
  .cm-ui .wm-cercle::before { content:''; position:absolute; left:50%; top:50%; width:44px; height:44px; margin:-22px 0 0 -22px; border-radius:50%; }
  .cm-ui .wm-cercle:hover { color:var(--wm-ink); border-color:var(--wm-ink); }
  .cm-ui .wm-cercle.wm-cercle-24 { width:24px; height:24px; }
  .cm-ui .wm-cercle:disabled, .cm-ui .wm-cercle.wm-inactif { border-color:var(--wm-line); color:var(--wm-ink-faint); cursor:default; }
  /* Champs et zones en creux : même coupe que les touches, trait ouvert aux coins coupés. */
  .cm-ui .wm-champ { position:relative; display:block; }
  .cm-ui .wm-champ > textarea, .cm-ui textarea.wm-coupe, .cm-ui select.wm-coupe { clip-path:var(--wm-forme-touche); border-radius:0; outline:none; }
  .cm-ui .wm-champ > textarea:focus { border-color:var(--wm-line-strong); }

  /* Focus clavier (fiche Etats), seulement en :focus-visible. Forme coupée : anneau qui suit les coins,
     tracé par ::after (non découpé). Forme ronde : outline de 2 px à 2 px. */
  .cm-ui .wm-touche:focus, .cm-ui .wm-cercle:focus, .cm-ui .wm-texte:focus { outline:none; }
  .cm-ui .wm-touche:focus-visible::after, .cm-ui .wm-champ:has(> textarea:focus-visible)::after {
    content:''; position:absolute; left:-4px; top:-4px; right:-4px; bottom:-4px; z-index:2; background:var(--wm-ink); clip-path:var(--wm-anneau-touche); pointer-events:none; }
  .cm-ui .wm-cercle:focus-visible, .cm-ui .wm-texte:focus-visible, .cm-ui .cm-toggle-btn:focus-visible { outline:2px solid var(--wm-ink); outline-offset:2px; }
  @media (forced-colors:active) {
    .wm-contour polygon, .wm-contour path { stroke:CanvasText; }
    .cm-ui .wm-touche::before { border-color:ButtonText; }
    .cm-ui .wm-touche:focus-visible::after, .cm-ui .wm-champ:has(> textarea:focus-visible)::after { background:Highlight; }
  }

  /* Voyant (F8) : disque net de 7 px à coordonnées entières, sans ombre ni halo ; sur fond clair (bouton
     de métal clair, site sombre), cerne intérieur de 1,5 px en border. Le nombre reste dans le texte
     (lecteurs d'écran, tests), hors de la vue. */
  .cm-ui .wm-voyant, .cm-toggle-btn .cm-count-badge { display:block; box-sizing:border-box; width:7px; height:7px; min-width:0; padding:0; border-radius:50%; background:var(--wm-accent);
    border:1.5px solid var(--wm-accent-ring); box-shadow:none; overflow:hidden; text-indent:-999px; white-space:nowrap; }
  body[data-wm-theme="client-sombre"] .cm-ui .wm-voyant, body[data-wm-theme="client-sombre"] .cm-toggle-btn .cm-count-badge { border:0; }

  /* Boutons flottants, créés seulement si la page n'a pas déjà ses propres boutons #cmToggleBtn/#cmPanelBtn */
  .cm-fab { position:fixed; right:18px; bottom:18px; z-index:845; display:flex; gap:8px; } /* sous le panneau (850) : ne masque jamais ses boutons */

  /* Boutons compacts, ronds, icône seule — aspect intermédiaire aux jetons (habillés aux lots 2 et 3) */
  .cm-toggle-btn { width:38px; height:38px; padding:0; display:flex; align-items:center; justify-content:center; background:var(--wm-face-touche); backdrop-filter:blur(var(--wm-verre-flou)) saturate(1.7); -webkit-backdrop-filter:blur(var(--wm-verre-flou)) saturate(1.7); border:1px solid var(--wm-line-strong); border-radius:50%; font-size:16px; color:var(--wm-ink); cursor:pointer; box-shadow:var(--wm-ombre-bouton); transition:transform 170ms ease, box-shadow 170ms ease; position:relative; }
  .cm-toggle-btn:hover { transform:scale(1.06); }
  .cm-toggle-btn.cm-on { background:linear-gradient(180deg, var(--wm-metal-light-hi), var(--wm-metal-light-lo)); border-color:var(--wm-encre-repere); box-shadow:var(--wm-ombre-bouton-enfonce); color:var(--wm-encre-repere); }
  .cm-toggle-btn .cm-count-badge { position:absolute; top:1px; right:1px; } /* forme : voyant de 7 px (F8), plus bas */
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
  .cm-pill { position:fixed; top:calc(var(--wm-nav-h) + 12px); left:50%; transform:translateX(-50%); z-index:900; color:var(--wm-ink); font-family:var(--wm-font-outil); font-weight:500; font-size:12px; text-align:center; min-height:44px; padding:6px 22px 6px 18px; display:none; align-items:center; gap:12px; white-space:nowrap; cursor:default; touch-action:none; }
  .cm-pill.show { display:flex; }
  .cm-pill.cm-dragging .cm-drag-handle { opacity:1; }
  .cm-pill .cm-drag-handle { display:inline-flex; opacity:.65; line-height:1; color:var(--wm-ink-soft); }

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
  .cm-popup { position:absolute; z-index:950; width:260px; padding:14px 24px 20px 22px; color:var(--wm-ink); } /* matière : habiller() ; marges : les coins witmit restent libres */
  .cm-popup .cm-zone { cursor:move; touch-action:none; font-family:var(--wm-font-titre); font-size:12px; font-weight:700; color:var(--wm-ink); margin-bottom:6px; max-height:48px; overflow-y:auto; }
  .cm-popup textarea { width:100%; min-height:70px; resize:vertical; border:1px solid var(--wm-line); border-radius:8px; padding:8px; font-family:var(--wm-font-voix); font-size:14px; font-weight:500; line-height:1.45; color:var(--wm-ink); background:var(--wm-surface-raised); margin-bottom:8px; box-sizing:border-box; }
  .cm-popup .wm-champ { margin-bottom:8px; }
  .cm-popup .wm-champ > textarea { display:block; margin:0; }
  .cm-popup .cm-cat-row { display:flex; align-items:center; gap:6px; margin:-2px 0 0; }
  .cm-popup .cm-cat { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; font-family:var(--wm-font-outil); font-size:12px; color:var(--wm-ink); background:var(--wm-face-touche); border:1px solid var(--wm-line); border-radius:7px; padding:5px 6px; }
  .cm-popup .cm-cat-auto { flex-shrink:0; font-family:var(--wm-font-outil); font-size:12px; font-weight:500; color:var(--wm-ink-soft); border:1px solid var(--wm-line); border-radius:var(--wm-radius-repere); padding:1px 6px; }
  .cm-popup .cm-popup-actions { display:flex; flex-wrap:wrap; gap:4px; justify-content:flex-end; margin-top:16px; } /* fiche Fenetre : 4 px entre « annuler » et la touche */
  .cm-popup .cm-delete { margin-right:auto; }
  .cm-popup .cm-popup-actions { align-items:center; }
  .cm-popup .cm-popup-actions .wm-texte { padding:0 6px; }

  /* Liste des retours : verre aux jetons (aspect intermédiaire ; fiche Tiroir au lot 5). */
  .cm-panel { position:fixed; top:0; right:0; height:100vh; width:300px; max-width:86vw; z-index:850; color:var(--wm-ink); display:flex; flex-direction:column; transform:translateX(100%); transition:transform 240ms cubic-bezier(0.16, 1, 0.3, 1); }
  .cm-panel.show { transform:translateX(0); }
  .cm-panel-head { padding:16px 16px 12px 24px; border-bottom:1px solid var(--wm-line); }
  .cm-panel-head-row { display:flex; align-items:center; justify-content:space-between; font-family:var(--wm-font-titre); font-weight:700; font-size:15px; color:var(--wm-ink); }
  .cm-panel-head-row #cmPanelCount { font-family:var(--wm-font-compteur); font-weight:900; }
  .cm-panel-head-btns { display:flex; align-items:center; gap:10px; }
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
  .cm-panel-item details.cm-tech summary { cursor:pointer; list-style:none; display:inline-flex; align-items:center; gap:4px; }
  .cm-panel-item details.cm-tech summary::-webkit-details-marker { display:none; }
  .cm-panel-item details.cm-tech .wm-ouvert, .cm-panel-item details.cm-tech[open] .wm-ferme { display:none; }
  .cm-panel-item details.cm-tech[open] .wm-ouvert { display:inline-block; }
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
  .cm-lightbox .cm-lightbox-fenetre { position:relative; display:flex; flex-direction:column; align-items:center; gap:10px; padding:14px 24px 20px 20px; }
  .cm-lightbox img { position:relative; display:block; max-width:88vw; max-height:80vh; clip-path:var(--wm-forme-touche); border:1px solid var(--wm-line-strong); background:#fff; }
  .cm-lightbox .cm-lightbox-hint { position:relative; color:var(--wm-ink-soft); font-family:var(--wm-font-outil); font-size:12px; }
  /* Apparition en 160 ms portée par chaque couche de la fenêtre, jamais par un parent du verre (F9). */
  .cm-lightbox .cm-lightbox-fenetre > * { animation:wmApparait 160ms ease-out; }
  @keyframes wmApparait { from { opacity:0; } to { opacity:1; } }
  @media (prefers-reduced-motion:reduce) { .cm-lightbox .cm-lightbox-fenetre > *, .wm-tourne { animation:none; } }
  .cm-panel-item .cm-reply { margin-top:4px; font-size:12px; color:var(--wm-ink-soft); padding-left:6px; }
  .cm-panel-item .cm-when { color:var(--wm-ink-soft); font-size:10.5px; }
  .cm-panel-item .cm-thread { margin-top:5px; display:flex; flex-direction:column; gap:4px; }
  .cm-panel-item .cm-msg { font-size:11.5px; line-height:1.4; color:var(--wm-ink-soft); padding:4px 8px; border-radius:0 6px 6px 0; white-space:pre-wrap; word-break:break-word; }
  .cm-panel-item .cm-msg-equipe { background:var(--wm-surface-raised); border-left:2px solid var(--wm-line-strong); }
  .cm-panel-item .cm-msg-auteur { border-left:2px solid var(--wm-line); margin-left:12px; }
  .cm-panel-item .cm-msg-who { display:block; font-size:10.5px; color:var(--wm-ink-soft); white-space:normal; }
  .cm-panel-item .cm-thread-actions { display:flex; flex-wrap:wrap; gap:6px; margin-top:5px; }
  .cm-popup .cm-lock-line { font-size:11px; color:var(--wm-ink-soft); margin:-2px 0 6px; }
  .cm-popup.cm-locked textarea { background:transparent; color:var(--wm-ink-soft); }
  .cm-popup .cm-feedback { font-size:11.5px; line-height:1.4; color:var(--wm-ink-soft); background:var(--wm-surface-raised); border-left:2px solid var(--wm-ink); padding:4px 8px; border-radius:0 6px 6px 0; margin-bottom:6px; }
  .cm-popup .cm-reply-ta { min-height:50px; }
  .cm-panel-item .cm-item-actions { flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:6px; }
  .cm-panel-item.cm-done .num { opacity:.55; }
  .cm-panel-item.cm-done .zone, .cm-panel-item.cm-done .txt, .cm-panel-item.cm-done .cm-meta { opacity:.55; }
  .cm-panel-sub .cm-hide-done { margin-left:6px; font-family:var(--wm-font-outil); font-size:10px; font-weight:500; border:1px solid var(--wm-line); border-radius:10px; background:transparent; color:var(--wm-ink-soft); padding:1px 7px; cursor:pointer; }
  .cm-panel-sub .cm-hide-done.cm-on, .cm-panel-sub .cm-hide-done:hover { border-color:var(--wm-line-strong); color:var(--wm-ink); }
  .cm-panel-empty { padding:24px 16px; text-align:center; color:var(--wm-ink-soft); font-size:12.5px; line-height:1.5; }
  .cm-panel-foot { padding:8px 10px; border-top:1px solid var(--wm-line); display:flex; gap:6px; flex-wrap:wrap; }
  .cm-panel-foot:last-child { padding:12px 24px 22px 18px; } /* le coin witmit du bas droit reste libre */
  .cm-panel-report .cm-scope { flex-basis:100%; display:flex; align-items:center; gap:6px; font-size:11px; color:var(--wm-ink-soft); cursor:pointer; }
  .cm-panel-report .cm-scope input { margin:0; }
  .cm-feedback-box { border-top:1px solid var(--wm-line); padding:10px; background:var(--wm-surface-raised); }
  .cm-feedback-box .cm-feedback-title { font-family:var(--wm-font-titre); font-weight:700; font-size:12px; color:var(--wm-ink); margin-bottom:6px; }
  .cm-feedback-box textarea { width:100%; box-sizing:border-box; min-height:84px; resize:vertical; border:1px solid var(--wm-line); border-radius:8px; padding:6px 8px; font-family:var(--wm-font-outil); font-size:11px; line-height:1.4; color:var(--wm-ink); background:var(--wm-surface-raised); }
  .cm-feedback-box .cm-feedback-actions { display:flex; justify-content:flex-end; gap:6px; margin-top:6px; }
  .cm-panel-foot + .cm-panel-foot { border-top:none; padding-top:0; }
  .cm-panel-foot[hidden], .cm-panel-foot button[hidden] { display:none; }
  .cm-panel-foot .wm-touche { flex:1 1 auto; }
  .cm-feedback-box .cm-feedback-actions { align-items:center; }
  .cm-panel-item .cm-item-actions .wm-cercle { width:30px; height:30px; }
  .cm-panel-item .cm-thread-actions { align-items:center; }
  .cm-panel-item .cm-msg-who { display:flex; flex-wrap:wrap; align-items:center; gap:4px; }

  /* Message d'état (toast) : verre aux jetons (aspect intermédiaire ; fiche Etats au lot 7). */
  /* Message passager : petite fenêtre de verre sans coins witmit (fiche Etats). Le fondu de 200 ms porte
     sur chaque couche enfant, jamais sur .cm-status, qui contient le verre (F4, F9) ; visibility suit. */
  .cm-status { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:960; color:var(--wm-ink); font-family:var(--wm-font-outil); font-size:12px; line-height:18px; min-height:40px; padding:11px 20px 11px 16px; pointer-events:none; width:max-content; max-width:min(420px, 90vw); white-space:normal; visibility:hidden; transition:visibility 0s linear 200ms; }
  .cm-status.show { visibility:visible; transition-delay:0s; }
  .cm-status > * { opacity:0; transition:opacity 200ms ease; }
  .cm-status.show > * { opacity:1; }
  .cm-status > .wm-contenu { position:relative; display:block; }
  @media (prefers-reduced-motion:reduce) { .cm-status, .cm-status > * { transition:none; } }
  @media (max-width:700px) {
    .cm-panel { width:86vw; }
    .cm-popup { width:80vw; max-width:280px; }
    .cm-pill { max-width:92vw; white-space:normal; text-align:left; }
  }
`;
  var HTML = `
<div class="cm-frame cm-ui" id="cmFrame"></div>

<div class="cm-pill cm-ui" id="cmPill" title="Glisse la pastille pour la déplacer">
  <span class="cm-drag-handle" aria-hidden="true">${icone('DotsSixVertical', 14)}</span>
  Clic = élément · ⌘/Ctrl+clic = plusieurs · Glisser = zone · Maj+glisser = texte
  <button class="wm-touche wm-petite" onclick="cmToggle(false)">Terminer</button>
</div>

<div class="cm-panel cm-ui" id="cmPanel">
  <div class="cm-panel-head">
    <div class="cm-panel-head-row">
      <span>Commentaires — <span id="cmPanelCount">0</span></span>
      <span class="cm-panel-head-btns">
        <button class="cm-hide-widget wm-texte" onclick="cmReveal(false)" id="cmHideBtn" title="Cacher witmit sur ce site (Alt+A / ⌥+A ou ?witmit=on pour le retrouver)" hidden>${icone('EyeSlash', 14)}Masquer witmit</button>
        <button class="wm-cercle" onclick="cmTogglePanel(false)" aria-label="Fermer" title="Fermer">${icone('X', 14)}</button>
      </span>
    </div>
    <div class="cm-panel-sub" id="cmPanelSub"></div>
    <div class="cm-panel-author" id="cmAuthor" hidden></div>
  </div>
  <div class="cm-panel-list" id="cmList"></div>
  <div class="cm-feedback-box" id="cmFeedbackBox" hidden>
    <div class="cm-feedback-title">Coller un retour</div>
    <textarea placeholder="witmit-retour R-…&#10;&lt;id&gt; pris_en_compte&#10;&lt;id&gt; resolu | ce qui a été fait&#10;&lt;id&gt; complement | question"></textarea>
    <div class="cm-feedback-actions"><button class="wm-texte" onclick="cmPasteFeedback(false)">Annuler</button><button class="primary wm-touche wm-principale" onclick="cmApplyFeedback()">Appliquer</button></div>
  </div>
  <div class="cm-panel-foot cm-panel-tools">
    <button class="wm-touche wm-petite" onclick="cmClearAll()">${icone('Trash', 16)}Effacer (page)</button>
    <button class="wm-touche wm-petite" onclick="cmClearSite()">${icone('Broom', 16)}Vider tout (site)</button>
    <button class="wm-touche wm-petite" onclick="cmPasteFeedback()" id="cmPasteBtn">${icone('ClipboardText', 16)}Coller un retour</button>
  </div>
  <div class="cm-panel-foot cm-panel-report" id="cmReportFoot">
    <label class="cm-scope" title="Par défaut : seulement les nouveautés (tickets nouveaux + réponses aux compléments)"><input type="checkbox" id="cmFullReport"> Rapport complet</label>
    <button class="wm-touche wm-petite" onclick="cmExport()">${icone('DownloadSimple', 16)}Télécharger</button>
    <button class="wm-touche wm-petite" onclick="cmCopy()">${icone('Copy', 16)}Copier</button>
    <button class="primary wm-touche wm-petite wm-principale" onclick="cmSendMail()">${icone('EnvelopeSimple', 16)}Envoyer</button>
  </div>
</div>

<div class="cm-status cm-ui" id="cmStatus"></div>
`;
  var BUTTONS_HTML = `
<button class="cm-toggle-btn cm-ui" onclick="cmToggle()" id="cmToggleBtn" title="Mode commentaire"><span class="cm-btn-off">${icone('CrosshairSimple', 20)}</span><span class="cm-btn-on" style="display:none;">${icone('X', 16)}</span></button>
<button class="cm-toggle-btn cm-ui" onclick="cmTogglePanel()" id="cmPanelBtn" title="Voir les commentaires de cette page">${icone('PenNib', 22)}<span class="cm-count-badge" id="cmCount" data-zero="1"></span></button>
`;

  /* ---------- habillage des fenêtres (F2, F3) ----------
     habiller(el) pose en premiers enfants de el trois couches muettes (aria-hidden, sans clic) : l'ombre,
     le verre et le contour (trait de 1 px + coins witmit, sauf sansCoins pour les messages passagers).
     Le contenu ne change pas de place dans le DOM. Un seul ResizeObserver retrace les contours quand une
     fenêtre change de taille, et une fois de plus quand les polices sont arrivées. */
  var habilles = [];
  var formeObs = window.ResizeObserver ? new ResizeObserver(function (entries) {
    entries.forEach(function (e) { tracerContour(e.target); });
  }) : null;
  function tracerContour(el) {
    if (!el.isConnected) { if (formeObs) formeObs.unobserve(el); habilles = habilles.filter(function (x) { return x !== el; }); return; } // fenêtre retirée
    var svg = el.querySelector(':scope > .wm-contour');
    if (!svg) return;
    var W = el.offsetWidth, H = el.offsetHeight, c = 11;
    if (!W || !H) return;                                           // caché : retracé quand il apparaît
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    // Trait à 0,5 px du bord (net sur un pixel), angles haut droit et bas gauche cassés de 11 px.
    svg.querySelector('polygon').setAttribute('points', '0.5,0.5 ' + (W - c - 0.2) + ',0.5 ' + (W - 0.5) + ',' + (c + 0.2) + ' ' +
      (W - 0.5) + ',' + (H - 0.5) + ' ' + (c + 0.2) + ',' + (H - 0.5) + ' 0.5,' + (H - c - 0.2));
    // Coins witmit : équerres de 14 px posées à 7 px des angles droits (haut gauche, bas droit).
    var coins = svg.querySelectorAll('path');
    if (coins.length === 2) {
      coins[0].setAttribute('d', 'M8.4 16.8V8.4H16.8');
      coins[1].setAttribute('d', 'M' + (W - 8.4) + ' ' + (H - 16.8) + 'V' + (H - 8.4) + 'H' + (W - 16.8));
    }
  }
  function habiller(el, sansCoins) {
    if (!el || el.querySelector(':scope > .wm-verre')) return el;
    el.classList.add('wm-habille');
    el.insertAdjacentHTML('afterbegin',
      '<span class="wm-ombre" aria-hidden="true"><i></i></span><span class="wm-verre" aria-hidden="true"></span>' +
      '<svg class="wm-contour" aria-hidden="true" focusable="false"><polygon points=""></polygon>' + (sansCoins ? '' : '<path d=""></path><path d=""></path>') + '</svg>');
    habilles.push(el);
    if (el.isConnected) tracerContour(el);                         // sinon : tracé par l'observateur à l'insertion
    if (formeObs) formeObs.observe(el);
    return el;
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { habilles.slice().forEach(tracerContour); });
  // Réservé aux pages de test du dépôt (planche de la charte) : dessiner les touches et les icônes avec le vrai
  // code. Ce n'est pas une interface publique : elle peut changer sans prévenir.
  window.witmit._planche = { icone: icone, habiller: habiller, icones: Object.keys(ICONES) };

  /* Le widget injecte lui-même son style et son interface — la page hôte n'a rien à copier. */
  function injectUI() {
    var style = document.createElement('style');
    style.id = 'cmStyles';
    style.textContent = fontFacesCss() + CSS;
    document.head.appendChild(style);
    var wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    habiller(document.getElementById('cmPanel'));
    habiller(document.getElementById('cmPill'));
    habiller(document.getElementById('cmStatus'), true);   // message passager : trop petit pour les coins witmit
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
    { key: 'bug-visuel',      icon: 'ImageBroken', label: 'Bug visuel',
      words: ['casse', 'deborde', 'chevauche', 'decale', 'coupe', 'tronque', 'mal aligne', 'superpose', 'disparait', "ne s'affiche pas", 'ne s affiche pas', 'illisible', 'flou', 'pixelise', 'deforme', 'ecrase'] },
    { key: 'bug-fonctionnel', icon: 'Bug', label: 'Bug fonctionnel',
      words: ['ne marche pas', 'ne fonctionne pas', 'marche pas', 'fonctionne pas', 'erreur', 'plante', 'bloque', 'rien ne se passe', 'impossible de', 'ne repond pas', "ne s'enregistre pas", 'ne s enregistre pas', 'crash', 'boucle', 'bug', 'ne se charge pas', 'ne charge pas', 'pas a jour', 'rafraichi', 'actualise', 'perdu', 'vide'] },
    { key: 'ajustement',      icon: 'Ruler', label: 'Ajustement visuel',
      words: ['trop grand', 'trop petit', 'trop large', 'trop etroit', 'trop haut', 'trop bas', 'plus grand', 'plus petit', 'plus large', 'plus etroit', 'agrandir', 'reduire', 'espace', 'marge', 'align', 'centr', 'couleur', 'police', 'gras', 'taille', 'contraste', 'arrondi', 'ombre', 'bordure', 'padding', 'largeur', 'hauteur'] },
    { key: 'texte',           icon: 'PencilSimpleLine', label: 'Texte à changer',
      words: ['faute', 'orthographe', 'typo', 'reformuler', 'remplacer par', 'renommer', 'libelle', 'wording', 'majuscule', 'accent', 'traduire', 'traduction', 'ecrire', 'formulation', 'coquille', 'pluriel', 'singulier'] },
    { key: 'comportement',    icon: 'ArrowsClockwise', label: 'Changement de comportement',
      words: ['devrait', 'plutot que', 'au lieu de', 'quand on clique', 'quand je clique', 'a la place', 'ordre', 'enchainement', 'rediriger', 'ouvrir', 'fermer', 'par defaut', 'automatiquement', 'desactiver', 'activer', 'trier', 'filtrer'] },
    { key: 'suggestion',      icon: 'Lightbulb', label: 'Suggestion',
      words: ['il faudrait', 'ce serait bien', 'idee', 'ajouter', 'proposer', 'on pourrait', 'manque', 'et si', 'pourquoi pas', 'serait mieux', 'penser a', 'prevoir'] },
    { key: 'question',        icon: 'SealQuestion', label: 'Question',
      words: ['pourquoi', 'comment', 'est-ce que', 'est ce que', "c'est quoi", 'c est quoi', 'a quoi sert', 'que se passe', 'quelle est', 'quel est', 'peut-on', 'peut on'] },
    { key: 'a-classer',       icon: 'Tag', label: 'À classer', words: [] }
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
        cmStatus('Ticket envoyé');
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
        cmStatus(data.avertissement ? 'Message envoyé — mais ' + data.avertissement.replace(/^message envoyé à l'équipe, mais /, '') : (data.rouvert ? 'Ticket rouvert, l’équipe est prévenue' : 'Réponse envoyée'));
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
    if (!SYNC || !c.sync) return SYNC && isEditable(c) ? '<span class="cm-sync-chip" title="Pas encore envoyé">' + icone('CloudArrowUp', 14, 'wm-devant') + 'à envoyer</span>' : '';
    if (c.sync.state === 'sent') return '<span class="cm-sync-chip cm-sync-sent" title="Reçu par witmit le ' + cmEsc(frDate(c.sync.at)) + '">' + icone('CloudCheck', 14, 'wm-devant') + 'envoyé</span>';
    if (c.sync.state === 'pending') return '<span class="cm-sync-chip" title="Envoi en cours">' + icone('CircleNotch', 14, 'wm-devant wm-tourne') + 'envoi…</span>';
    return '<span class="cm-sync-chip cm-sync-error" onmousedown="event.stopPropagation()" onclick="cmRetrySync(\'' + c.id + '\')" title="' + cmEsc(c.sync.error || 'erreur') + ' — cliquer pour réessayer">' + icone('WarningCircle', 14, 'wm-devant wm-signal') + 'à renvoyer</span>';
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
    nouveau:        { icon: '',             label: 'Nouveau' },
    signale:        { icon: 'LockSimple',   label: 'Signalé' },
    pris_en_compte: { icon: 'Eye',          label: 'Pris en compte' },
    complement:     { icon: 'Question',     label: 'Complément demandé' },
    resolu:         { icon: 'CheckCircle',  label: 'Résolu' }   // même icône pour résolu et répondu (décision du 29/09)
  };
  function isDone(c) { return c.status === 'resolu'; }
  function isEditable(c) { return !c.status || c.status === 'nouveau'; }
  function frDate(iso) { try { return new Date(iso).toLocaleDateString('fr-FR'); } catch (e) { return ''; } }
  function statusLabel(c) {
    if (c.status === 'signale') return 'Signalé le ' + frDate(c.signaledAt);
    if (c.status === 'resolu') return (c.repondu ? 'Répondu le ' : 'Résolu le ') + frDate(c.resolvedAt) + (c.resolvedBy === 'moi' ? ' (par moi)' : '');
    if (c.status === 'pris_en_compte') return 'Pris en compte' + (c.ackAt ? ' le ' + frDate(c.ackAt) : '');
    if (c.status === 'complement') return 'Complément demandé' + (c.complementAt ? ' le ' + frDate(c.complementAt) : '');
    return '';
  }
  // Le libellé du statut précédé de son icône (HTML), pour la liste et la fenêtre.
  function statusHtml(c) {
    var st = STATUS[c.status] || STATUS.nouveau;
    return (st.icon ? icone(st.icon, 14, 'wm-devant') : '') + cmEsc(statusLabel(c));
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
      var who = equipe ? icone('ChatCircleText', 14) + 'Équipe' : (m.rouvre ? icone('ArrowCounterClockwise', 14) + 'Tu as rouvert le ticket' : icone('ArrowBendDownRight', 14) + 'Toi');
      return '<div class="cm-msg cm-msg-' + (equipe ? 'equipe' : 'auteur') + '"><span class="cm-msg-who">' + who + ' · ' + cmEsc(frDate(m.cree_le)) + '</span>' + cmEsc(m.texte) + '</div>';
    });
    (c.replies || []).forEach(function (r) {
      var err = r.sync && r.sync.state === 'error';
      var chip = err
        ? '<span class="cm-sync-chip cm-sync-error" onclick="cmRetryReply(\'' + c.id + '\', \'' + r.id + '\')" title="' + cmEsc(r.sync.error) + ' — cliquer pour réessayer">' + icone('WarningCircle', 14, 'wm-devant wm-signal') + 'à renvoyer</span>' +
          '<button class="cm-msg-drop wm-cercle wm-cercle-24" onclick="cmDropReply(\'' + c.id + '\', \'' + r.id + '\')" title="Abandonner ce message" aria-label="Abandonner ce message">' + icone('X', 12) + '</button>'
        : '<span class="cm-sync-chip" title="Envoi en cours">' + icone('CircleNotch', 14, 'wm-devant wm-tourne') + 'envoi…</span>';
      msgs.push('<div class="cm-msg cm-msg-auteur cm-msg-pending"><span class="cm-msg-who">' + (r.rouvrir ? icone('ArrowCounterClockwise', 14) + 'Tu rouvres le ticket' : icone('ArrowBendDownRight', 14) + 'Toi') + ' · ' + cmEsc(frDate(r.date)) + ' ' + chip + '</span>' + cmEsc(r.text) + '</div>');
    });
    var acts = [];
    if (canReply(c)) acts.push('<button class="cm-reply-btn wm-touche wm-petite" onclick="cmReplyLive(\'' + c.id + '\', false)">' + icone('ArrowBendUpLeft', 16) + 'Répondre</button>');
    if (canReopen(c)) acts.push('<button class="cm-reopen-btn wm-touche wm-petite" onclick="cmReplyLive(\'' + c.id + '\', true)">Ça ne convient pas ? Rouvrir</button>');
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
      list.innerHTML = '<div class="cm-panel-empty">Aucun commentaire sur cette page pour l’instant.<br>Active le mode commentaire (bouton ' + icone('CrosshairSimple', 14) + ' ou ' + SHORTCUT_LABEL + ') puis clique, encadre une zone ou Maj+glisse sur du texte.</div>';
      majPiedsTiroir();
      return;
    }
    var html = '';
    pc.forEach(function (c, i) {
      if (hideDone() && isDone(c)) return;
      html += '<div class="cm-panel-item' + (c.id === focusedId ? ' cm-current' : '') + (isDone(c) ? ' cm-done' : '') + '" data-id="' + c.id + '">' +
        '<div class="num">' + (i + 1) + '</div>' +
        '<div class="body" onmousedown="cmFocusDown(event, \'' + c.id + '\')" title="Voir sur la page et modifier ici">' +
          '<div class="zone">' + typeIcon(c.type, c.targets && c.targets.length > 1) + cmEsc(c.zone) + '</div>' +
          '<div class="txt">' + cmEsc(c.text) + '</div>' +
          (c.shot && c.shot.dataUrl ? '<img class="cm-shot" src="' + c.shot.dataUrl + '" alt="Capture" title="Voir la capture" onmousedown="event.stopPropagation()" onclick="cmShowShot(\'' + c.id + '\')">' : '') +
          (SYNC ? '' : c.replies && c.replies.length ? c.replies.map(function (r) { return '<div class="cm-reply">' + icone('ArrowBendDownRight', 14, 'wm-devant') + cmEsc(r.text) + ' <span class="cm-when">(' + frDate(r.date) + (r.sentIn ? '' : ', à envoyer') + ')</span></div>'; }).join('') : '') +
          (c.status === 'complement' && c.complementMessage ? '<div class="cm-feedback cm-feedback-q">' + icone('Question', 14, 'wm-devant') + cmEsc(c.complementMessage) + '</div>' : '') +
          (c.feedbackMessage && c.status !== 'complement' && !(SYNC && c.thread && c.thread.length) ? '<div class="cm-feedback">' + icone('ChatCircleText', 14, 'wm-devant') + cmEsc(c.feedbackMessage) + '</div>' : '') +
          (SYNC ? threadHtml(c) : '') +
          '<div class="cm-meta"><span class="cm-cat-chip" title="Catégorie">' + icone(categoryOf(c.category).icon, 14, 'wm-devant') + categoryOf(c.category).label + '</span>' +
          syncChip(c) +
          (c.status !== 'nouveau' ? '<span class="cm-status-chip cm-st-' + c.status + '">' + statusHtml(c) + '</span>' : '') +
          (c.tech ? '<details class="cm-tech" onmousedown="event.stopPropagation()"><summary>' + icone('CaretRight', 14, 'wm-ferme') + icone('CaretDown', 14, 'wm-ouvert') + 'détails techniques</summary><pre>' + cmEsc(techSummary(c.tech)) + '</pre></details>' : '') +
          '</div></div>' +
        '<div class="cm-item-actions">' +
          (!isDone(c) ? '<button class="st wm-cercle" onclick="cmResolve(\'' + c.id + '\')" title="Marquer résolu (par moi) — verrouille le ticket" aria-label="Résoudre">' + icone('Check', 15) + '</button>' : '<span class="st cm-st-locked wm-cercle wm-inactif" title="Résolu — verrouillé">' + icone('CheckCircle', 15) + '</span>') +
          (c.status === 'signale' ? '<button class="reopen wm-cercle" onclick="cmReopen(\'' + c.id + '\')" title="Rouvrir pour corriger (sera renvoyé au prochain rapport)" aria-label="Rouvrir">' + icone('ArrowCounterClockwise', 15) + '</button>' : '') +
          '<button class="del wm-cercle" onclick="cmDeleteById(\'' + c.id + '\')" aria-label="Supprimer" title="Supprimer">' + icone('Trash', 15) + '</button>' +
        '</div></div>';
    });
    if (!html) html = '<div class="cm-panel-empty">Tout est résolu sur cette page.</div>';
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

  /* Icône par type de cible, dans la fenêtre et la liste (fiche Icones) : élément, zone, passage de texte,
     plusieurs éléments. Le rapport Markdown garde ses symboles jusqu'au lot 8 (C3, Léa 3.12). */
  function typeIcon(type, multi) {
    return icone(multi ? 'SelectionPlus' : type === 'box' ? 'BoundingBox' : type === 'text' ? 'TextT' : 'CursorClick', 14, 'wm-devant');
  }
  function typeEmojiRapport(type) {
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
      '<div class="cm-zone">' + typeIcon(meta && meta.type, meta && meta.targets && meta.targets.length > 1) + cmEsc(zone) + '</div>' +
      (locked ? '<div class="cm-lock-line">' + icone('LockSimple', 14, 'wm-devant') + cmEsc(statusLabel(meta.existing)) + ' — non modifiable</div>' : '') +
      '<span class="wm-champ"><textarea' + (locked ? ' readonly' : '') + ' placeholder="Ton commentaire, ta question ou ta critique… (Entrée = enregistrer, Maj+Entrée = nouvelle ligne, Échap = annuler)">' +
      (isEdit ? cmEsc(meta.existing.text) : '') + '</textarea></span>' +
      (askReply ? '<div class="cm-feedback cm-feedback-q">' + icone('Question', 14, 'wm-devant') + cmEsc(meta.existing.complementMessage || 'Complément demandé') + '</div>' +
                  '<span class="wm-champ"><textarea class="cm-reply-ta" placeholder="Ta réponse… (Entrée = enregistrer)"></textarea></span>' : '') +
      '<div class="cm-cat-row"><select class="cm-cat wm-coupe"' + (locked ? ' disabled' : '') + ' title="Catégorie (proposée d’après le texte, modifiable)">' +
      CATEGORIES.map(function (cat) { return '<option value="' + cat.key + '">' + cat.label + '</option>'; }).join('') +
      '</select><span class="cm-cat-auto">auto</span></div>' +
      '<div class="cm-popup-actions">' +
      (isEdit ? '<button class="cm-delete wm-cercle" title="Supprimer ce commentaire" aria-label="Supprimer ce commentaire">' + icone('Trash', 15) + '</button>' : '') +
      '<button class="cm-cancel wm-texte">' + (locked && !askReply ? 'Fermer' : 'Annuler') + '</button>' +
      (locked && !askReply ? '' : '<button class="cm-save wm-touche wm-principale">' + (askReply ? 'Enregistrer la réponse' : 'Enregistrer') + '</button>') + '</div>';
    habiller(pop);
    document.body.appendChild(pop);
    tracerContour(pop);                                             // tout de suite, sans attendre l'observateur
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
    if (zoneEl) zoneEl.innerHTML = typeIcon('pin', meta.targets.length > 1) + cmEsc(multiLabel(meta.targets));
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
    var txt = el.querySelector(':scope > .wm-contenu');
    if (!txt) { txt = document.createElement('span'); txt.className = 'wm-contenu'; el.appendChild(txt); }
    txt.textContent = msg;
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
    ov.innerHTML = '<div class="cm-lightbox-fenetre"><img alt="Capture de la zone commentée"><div class="cm-lightbox-hint">Cliquer pour fermer</div></div>';
    habiller(ov.firstChild);
    ov.querySelector('img').src = c.shot.dataUrl;
    ov.onclick = function () { ov.remove(); };
    document.body.appendChild(ov);
    tracerContour(ov.firstChild);
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
        var st = c.status === 'nouveau' ? 'nouveau' : statusLabel(c);
        L.push('### #' + n + ' · ' + typeEmojiRapport(c.type) + ' ' + c.zone + ' — ' + categoryOf(c.category).label + ' · ' + st + (c.supersedes ? ' · remplace la version du ' + frDate(c.supersedes) : ''));
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
