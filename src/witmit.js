/*!
 * witmit 0.2.0 — widget d'annotation visuelle (charte « Objet »)
 * Un seul fichier : injecte son style, son interface et sa logique au chargement.
 * Police : celle du système (aucun fichier de police chargé).
 * Usage : <script src="witmit.js" data-project="monprojet" data-email="moi@exemple.fr"></script>
 * Raccourcis : ⌥ deux fois / alt deux fois montre et cache witmit (mode live) · ⌥+A / alt+A lance et arrête le mode annotation
 * Auteur (site où l'on est connecté) : window.witmit.identify({ nom: 'Camille' }) · identify(null) — voir plus bas.
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
                     production : widget invisible par défaut, révélé par ⌥ deux fois / alt deux fois ou ?witmit=on) */
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
    // witmit le lit sur la page). witmit prend le thème du site : site clair → titane clair (V2).
    hostTheme: (function (v) { return v === 'light' || v === 'dark' ? v : 'auto'; })(SCRIPT_EL && SCRIPT_EL.getAttribute('data-host-theme'))
  };
  var VERSION = '0.2.0';

  /* ---------- police : celle du système (V2) ----------
     Plus aucune police embarquée ni chargée : witmit écrit avec la police système (SF Pro sur Mac, Segoe UI
     sous Windows, Roboto sous Android). data-fonts, attribut de 0.2.0, est ignoré. Aucune requête de police. */

  /* ---------- icônes : Phosphor Regular 2.1.1 (licence MIT, en tête de ce fichier) ----------
     Tracés recopiés tels quels depuis assets/regular/<nom>.svg du paquet @phosphor-icons/core 2.1.1
     (viewBox 0 0 256 256, couleur du texte). Aucun fichier ni aucune requête en plus. Une icône n'a qu'un
     sens dans tout le widget (fiche Icones du design system) ; le nom accessible est porté par le bouton. */
  var ICONES = {
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
     Un site où l'on est connecté peut dire à witmit qui écrit : window.witmit.identify({ nom: 'Camille' }),
     identify(null) pour oublier (déconnexion), ou data-user-name="Camille" sur la balise. Si le site parle
     avant que ce script soit chargé, il met l'appel en file :
       (window.witmitQueue = window.witmitQueue || []).push(['identify', { nom: 'Camille' }]);
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
    el.innerHTML = AUTHOR ? icone('Signature', 14) + '<span>tes retours sont signés : <b></b></span>' : '';
    if (AUTHOR) el.querySelector('b').textContent = AUTHOR;
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

  /* Raccourcis (K6) : libellés d'après la plateforme ; « ⌥ » sur Mac, « alt » ailleurs (textes de Léa). */
  var IS_MAC = /Mac|iPhone|iPod|iPad/i.test(
    (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || ''
  );
  var RACC_DOUBLE_ALT = IS_MAC ? '⌥ deux fois' : 'alt deux fois';
  var RACC_ANNOTER = IS_MAC ? '⌥+A' : 'alt+A';
  // Repère « ⌥ deux fois » de « masquer witmit » : à l'écran, ⌥ est l'icône Option dans le petit carré (la chasse fixe du système
  // ne l'a pas), suivie de « deux fois » hors du carré ; lu « option deux fois » par un lecteur d'écran ; « alt deux fois » hors Mac.
  // Repère « ⌥+A » de l'aide de l'état vide : même carré, lu « option+A » par un lecteur d'écran ; « alt+A » hors Mac.
  var REPERE_ANNOTER = '<span class="wm-repere">' + (IS_MAC ? icone('Option', 12) + '<span class="wm-lu">option</span>+A' : 'alt+A') + '</span>';
  var REPERE_DOUBLE_ALT = '<span class="wm-repere-double"><span class="wm-repere">' + (IS_MAC ? icone('Option', 12) + '<span class="wm-lu">option</span>' : 'alt') +
    '</span><span>deux fois</span></span>';
  // Gestes du bandeau (Léa 3.2 ; fiche Bandeau) : ⌘ en icône Command (« ctrl » hors Mac) et « maj » en mot, chacun
  // dans le petit carré ; chaque « geste : effet » ne se coupe jamais. Aucun geste tactile.
  var REPERE_MULTI = '<span class="wm-repere">' + (IS_MAC ? icone('Command', 12) + '<span class="wm-lu">cmd</span>' : 'ctrl') + '</span>';
  // « · » collé au geste qui suit (espace insécable) : sur deux lignes, une ligne ne finit jamais par « · ».
  var GESTES_HTML = '<span class="wm-geste"><b>clic</b> : élément</span> ·\u00a0<span class="wm-geste">' + REPERE_MULTI + '+<b>clic</b> : plusieurs</span> ·\u00a0' +
    '<span class="wm-geste"><b>glisser</b> : zone</span> ·\u00a0<span class="wm-geste"><span class="wm-repere">maj</span>+<b>glisser</b> : texte</span>';

  var CSS = `
  /* ---------- jetons de la charte V2 (design system witmit, version 6, tokens.json) ----------
     Valeurs recopiées telles quelles, préfixées --wm-. Elles ne sont JAMAIS posées sur :root, html ni
     body : rien ne fuit dans la page hôte, et aucune variable de l'hôte n'entre dans witmit.
     Thème : data-wm-theme sur <body>, celui du site (site clair → titane clair « client-clair » ;
     site sombre → titane sombre « client-sombre »), boutons ronds compris. */
  .cm-ui, mark.cm-highlight {
    --wm-ground: rgba(250,250,250,0.72);
    --wm-surface: rgba(250,250,250,0.72);
    --wm-surface-raised: rgba(0,0,0,0.05);
    --wm-face-touche: rgba(0,0,0,0.07);
    --wm-ink: #141414;
    --wm-ink-soft: #141414;
    --wm-ink-faint: rgba(20,20,20,0.60);
    --wm-line: rgba(0,0,0,0.10);
    --wm-contour-fenetre: rgba(0,0,0,0.14);
    --wm-line-strong: rgba(0,0,0,0.30);
    --wm-accent: #f7821a;
    --wm-accent-ring: #0a0a0a;
    --wm-signal: #b8291d;
    /* Fond mat de la liste, filet qui la sépare de la page, ligne choisie, bloc intérieur, face d'un champ
       posé dans un bloc, libellé du bouton principal orange (tokens.json, V2). */
    --wm-liste-fond: #fafafa;
    --wm-liste-separation: rgba(0,0,0,0.12);
    --wm-selection-ligne: rgba(0,0,0,0.07);
    --wm-bloc-fond: rgba(0,0,0,0.028);
    --wm-bloc-lisere: rgba(255,255,255,0.75);
    --wm-champ-fond: rgba(255,255,255,0.80);
    --wm-bouton-principal-texte: #ffffff;
    /* Cadres de sélection (fiche Selection) : d'après le fond derrière eux, comme les repères. */
    --wm-cadre-trait: rgba(0,0,0,0.30);
    --wm-cadre-trait-sombre: rgba(255,255,255,0.42);
    --wm-cadre-pointilles: rgba(0,0,0,0.42);
    --wm-cadre-pointilles-sombre: rgba(255,255,255,0.50);
    --wm-cadre-poignee: rgba(0,0,0,0.40);
    --wm-cadre-poignee-sombre: rgba(255,255,255,0.55);
    --wm-cadre-gris-trace: rgba(128,128,128,0.26);
    --wm-cadre-gris-actif: rgba(128,128,128,0.12);
    --wm-ombre-cadre: 0 2px 10px rgba(0,0,0,0.22), inset 0 0 6px rgba(0,0,0,0.20);
    --wm-ombre-bloc: 0 1px 6px rgba(0,0,0,0.05);
    /* Métal poli des boutons ronds et de l'épingle active : titane neutre (tokens.json ; paliers mi et fin,
       reflet et trait clair d'après la maquette V2). */
    --wm-metal-dark-hi: #5c5c5c;
    --wm-metal-dark-lo: #181818;
    --wm-metal-light-hi: #fafafa;
    --wm-metal-light-lo: #bdbdbd;
    /* Ombre des fenêtres à la manière de macOS (thème clair) : noir à 34 %, glissée de 22 px, flou ~56 px,
       plus une ombre de contact. En sombre : lueur blanche de même forme et liseré (plus bas). */
    --wm-ombre-fenetre: 0 22px 56px rgba(0,0,0,0.34), 0 1px 3px rgba(0,0,0,0.14);
    --wm-ombre-copie: rgba(0,0,0,0.34);
    --wm-ombre-contact: 0 1px 3px rgba(0,0,0,0.14);
    /* Bord du verre (fiche Fenetre) : en clair, trait de 1 px contour-fenetre (noir à 14 %) et ombre de contact ;
       en sombre, liseré blanc à 16 % dedans et 5 % dehors. */
    --wm-verre-bord: inset 0 0 0 1px var(--wm-contour-fenetre), var(--wm-ombre-contact);
    --wm-ombre-epingle: inset 0 1.5px 0 rgba(255,255,255,0.75), inset 0 -3px 5px rgba(0,0,0,0.26), 0 3px 10px rgba(0,0,0,0.28);
    --wm-ombre-bouton: inset 0 1px 1px rgba(255,240,220,0.45), 0 8px 18px rgba(0,0,0,0.30);
    --wm-ombre-bouton-enfonce: inset 0 3px 6px rgba(90,70,50,0.45), inset 0 -1px 0 #ffffff, 0 1px 2px rgba(0,0,0,0.40);
    --wm-ombre-bouton-enfonce-sombre: inset 0 3px 6px rgba(0,0,0,0.6),inset 0 -1px 0 rgba(255,240,220,0.2),0 1px 2px rgba(0,0,0,0.4);
    /* Métal des deux boutons ronds (fiche BoutonWitmit) : trait, signe, reflet et paliers du dégradé poli. */
    --wm-metal-dark-trait: #0a0a0a;
    --wm-metal-dark-signe: #f4f4f4;
    --wm-metal-dark-reflet: rgba(255,255,255,0.28);
    --wm-metal-dark-mi: #2e2e2e;
    --wm-metal-dark-fin: #383838;
    --wm-metal-light-trait: #6f6f6f;
    --wm-metal-light-signe: #141414;
    --wm-metal-light-reflet: rgba(255,255,255,0.75);
    --wm-metal-light-mi: #e0e0e0;
    --wm-metal-light-fin: #e8e8e8;
    --wm-ombre-bouton-clair: inset 0 1px 1px #ffffff, 0 8px 18px rgba(0,0,0,0.45);
    --wm-space-1: 4px;
    --wm-space-2: 8px;
    --wm-space-3: 12px;
    --wm-space-4: 16px;
    --wm-space-5: 20px;
    --wm-radius-repere: 4px;
    --wm-radius-numero: 5px;
    --wm-radius-rond: 999px;
    /* Arrondis de la V2 (tokens.json, onglet Rayons) : plus aucun angle cassé dans le widget. */
    --wm-radius-fenetre: 9px;     /* fenêtres, bandeau, liste */
    --wm-radius-bloc: 7px;        /* bloc intérieur à la manière d'Apple */
    --wm-radius-bouton: 6px;      /* boutons, lignes de la liste, cadres de sélection */
    --wm-radius-epingle: 6px;     /* les quatre coins de l'épingle */
    --wm-radius-champ: 5px;       /* champs, vignettes, zones en creux */
    --wm-radius-message: 8px;     /* messages passagers */
    --wm-radius-coude: 3px;       /* coude des coins witmit (fenêtres, cadres) */
    /* Verre (fenêtres, bandeau, messages passagers) : 72 % en clair, 70 % en sombre, flou de 40 px, saturation 1,9. */
    --wm-verre-flou: 40px;
    --wm-verre-saturation: 1.9;
    --wm-verre-opacite-clair: 0.72;
    --wm-verre-opacite-sombre: 0.70;
    --wm-cible-min: 44px;
    --wm-texte-min: 13px;
    /* Police système partout dans l'outil, texte de la personne compris ; chasse fixe du système pour les
       seules touches de clavier citées dans une aide. Aucun fichier de police chargé. */
    --wm-font-systeme: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --wm-font-touche: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    /* Encre des repères posés sur le site (épingles, cadres, liens) : fixe, elle ne suit pas le verre
       mais le fond derrière chaque repère (fiche Reperes) — valeurs de --wm-ink clair et sombre. */
    --wm-encre-repere: #141414;
    --wm-encre-repere-claire: #f4f4f4;
    --wm-encre-repere-55: rgba(20,20,20,.55);
    --wm-encre-repere-claire-55: rgba(244,244,244,.55);
    /* Face de l'épingle (fiches Epingle et Reperes ; décision a3) : le verre des fenêtres, choisi d'après le
       fond derrière elle (titane clair sur fond clair ; titane sombre sur fond sombre). */
    --wm-epingle-verre-clair: rgba(250,250,250,.72);
    --wm-epingle-verre-sombre: rgba(27,27,27,.70);
    --wm-epingle-contour-sombre: rgba(255,255,255,.55);
    --wm-ombre-epingle-metal-sombre: inset 0 1px 1px rgba(255,255,255,.28), 0 3px 10px rgba(0,0,0,.28);
    --wm-ombre-epingle-metal-clair: inset 0 1px 1px #ffffff, 0 3px 10px rgba(0,0,0,.45);
    /* Halo du mode annotation (fiche Bandeau) : orange, mêmes valeurs sur tous les sites, sans variante de thème. */
    --wm-halo-filet: rgba(10,10,10,.9);
    --wm-halo-lueur-courte: rgba(247,130,26,.42);
    --wm-halo-lueur: rgba(247,130,26,.40);
    /* Rond de la loupe posé sur une capture (fiche Tiroir) : sur l'image, jamais sur le verre. */
    --wm-loupe-fond: rgba(22,22,22,.66);
    /* Mise en page seulement (pas d'identité) : la barre de navigation de l'hôte, si elle est déclarée. */
    --wm-nav-h: var(--nav-h, 0px);
  }
  body[data-wm-theme="client-sombre"] .cm-ui, body[data-wm-theme="client-sombre"] mark.cm-highlight {
    --wm-ground: rgba(27,27,27,0.70);
    --wm-surface: rgba(27,27,27,0.70);
    --wm-surface-raised: rgba(255,255,255,0.06);
    --wm-face-touche: rgba(255,255,255,0.14);
    --wm-ink: #ffffff;
    --wm-ink-soft: #ffffff;
    --wm-ink-faint: rgba(255,255,255,0.60);
    --wm-line: rgba(255,255,255,0.09);
    --wm-contour-fenetre: rgba(255,255,255,0.16);
    --wm-line-strong: rgba(255,255,255,0.30);
    --wm-signal: #ff6b5b;
    --wm-liste-fond: #1b1b1b;
    --wm-liste-separation: rgba(255,255,255,0.12);
    --wm-selection-ligne: rgba(255,255,255,0.09);
    --wm-bloc-fond: rgba(255,255,255,0.04);
    --wm-bloc-lisere: rgba(255,255,255,0.08);
    --wm-champ-fond: rgba(255,255,255,0.06);
    /* Lueur du thème sombre : même géométrie que l'ombre du thème clair, en blanc à 22 % ; liseré blanc à
       16 % dedans et 5 % dehors. */
    --wm-ombre-fenetre: 0 22px 56px rgba(255,255,255,0.22), inset 0 0 0 1px rgba(255,255,255,0.16), 0 0 0 1px rgba(255,255,255,0.05);
    --wm-ombre-copie: rgba(255,255,255,0.22);
    --wm-ombre-contact: inset 0 0 0 1px rgba(255,255,255,0.16), 0 0 0 1px rgba(255,255,255,0.05);
    /* Le liseré du thème sombre porte déjà le trait intérieur : pas de second trait de contour. */
    --wm-verre-bord: var(--wm-ombre-contact);
  }
  /* Sans flou d'arrière-plan, ou si la personne réduit la transparence : verre presque opaque (0,94). */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .cm-ui { --wm-ground: rgba(250,250,250,0.94); --wm-surface: rgba(250,250,250,0.94); }
    body[data-wm-theme="client-sombre"] .cm-ui { --wm-ground: rgba(27,27,27,0.94); --wm-surface: rgba(27,27,27,0.94); }
  }
  @media (prefers-reduced-transparency: reduce) {
    .cm-ui { --wm-ground: rgba(250,250,250,0.94); --wm-surface: rgba(250,250,250,0.94); }
    body[data-wm-theme="client-sombre"] .cm-ui { --wm-ground: rgba(27,27,27,0.94); --wm-surface: rgba(27,27,27,0.94); }
  }
  /* La liste est mate, sans verre : titane neutre (#FAFAFA en clair, #1B1B1B en sombre ; décision du 26/10). */
  body .cm-ui.cm-panel { --wm-ground: var(--wm-liste-fond); --wm-surface: var(--wm-liste-fond); }

  /* Réinitialisation limitée à nos couches : les règles de l'hôte (preflight de Tailwind, styles posés sur
     button, mark, svg ou *) ne doivent pas déteindre sur witmit. Tout est écrit en toutes lettres. */
  .cm-ui, .cm-ui *, .cm-ui::before, .cm-ui::after, .cm-ui *::before, .cm-ui *::after { box-sizing:border-box; }
  .cm-ui { font-family:var(--wm-font-systeme); font-size:13px; line-height:1.5; font-weight:400; letter-spacing:normal; text-transform:none; color:var(--wm-ink); }
  mark.cm-highlight { background:none; color:inherit; }

  /* ---------- Formes et matières (fiches Fenetre, Touche, Etats ; V2 : arrondis, plus aucun angle cassé) ----------
     Une fenêtre (fenêtre de saisie, liste, bandeau, visionneuse, messages passagers) n'est pas peinte
     elle-même : habiller() lui ajoute en premiers enfants trois couches muettes, sans clic, qui portent la
     matière. .wm-ombre : copie floutée de la forme, posée 22 px plus bas. .wm-verre : la face de verre
     dépoli, arrondie, avec son bord (trait ou liseré, ombre de contact). .wm-contour : les deux coins witmit,
     en SVG retracé à la taille réelle. Arrondi de la fenêtre : --wm-rayon (9 px ; liste : seulement côté
     page ; messages passagers : 8 px). Aucun parent du verre ne porte filter, opacity < 1, mask, clip-path,
     mix-blend-mode ni backdrop-filter, même pendant une animation : ils couperaient le flou du fond (F4).
     Les fondus portent sur les couches enfants (F9). */
  .cm-ui {
    /* Survol d'un bouton secondaire : un cran plus marqué (tokens.json, face-touche-survol). */
    --wm-face-touche-survol: rgba(0,0,0,.11);
  }
  body[data-wm-theme="client-sombre"] .cm-ui { --wm-face-touche-survol: rgba(255,255,255,.20); }
  .cm-ui[hidden], .cm-ui [hidden] { display:none !important; }
  .wm-habille { --wm-rayon: var(--wm-radius-fenetre); isolation:isolate; background:transparent; border:0; border-radius:0; box-shadow:none; }
  .wm-habille.cm-panel { --wm-rayon: var(--wm-radius-fenetre) 0 0 var(--wm-radius-fenetre); }   /* liste collée au bord droit : arrondie côté page seulement */
  .wm-habille.cm-status { --wm-rayon: var(--wm-radius-message); }
  .wm-habille > .wm-ombre, .wm-habille > .wm-verre, .wm-habille > .wm-contour { position:absolute; left:0; top:0; width:100%; height:100%; margin:0; padding:0; border:0; pointer-events:none; }
  .wm-habille > .wm-ombre { z-index:-2; top:22px; filter:blur(28px); }   /* ombre macOS : glissée de 22 px, flou ~56 px ; lueur en sombre */
  .wm-habille > .wm-ombre > i { display:block; width:100%; height:100%; border-radius:var(--wm-rayon); background:var(--wm-ombre-copie); }
  .wm-habille > .wm-verre { z-index:-1; border-radius:var(--wm-rayon); background:var(--wm-surface); box-shadow:var(--wm-verre-bord);
    backdrop-filter:blur(var(--wm-verre-flou)) saturate(var(--wm-verre-saturation)); -webkit-backdrop-filter:blur(var(--wm-verre-flou)) saturate(var(--wm-verre-saturation)); }
  .wm-habille > .wm-contour { z-index:1; overflow:visible; display:block; max-width:none; }
  /* Coins witmit : trait de 2,1 px à l'encre, coude arrondi de 3 px (tracé dans tracerContour). */
  .wm-contour path { fill:none; stroke:var(--wm-ink); stroke-width:2.1; stroke-linecap:square; stroke-linejoin:round; }
  /* Toutes les icônes : taille écrite sur la balise, couleur du texte qu'elles accompagnent. */
  .cm-ui svg.wm-icone { display:inline-block; flex:none; vertical-align:-0.18em; overflow:visible; max-width:none; fill:currentColor; }
  .cm-ui svg.wm-icone.wm-devant { margin-right:6px; }
  .cm-ui svg.wm-icone.wm-signal { color:var(--wm-signal); }
  .wm-tourne { animation:wmTourne 800ms linear infinite; }
  @keyframes wmTourne { to { transform:rotate(360deg); } }

  /* Touches (fiche Touche) : arrondi de 6 px (radius-bouton), face ton sur ton. La face et le trait vont sur
     ::before ; le contour de focus (::after) suit l'arrondi, 2 px à 2 px de la face (F5). Principale : trait
     line-strong ; secondaire : trait line. */
  .cm-ui .wm-touche { position:relative; isolation:isolate; display:inline-flex; align-items:center; justify-content:center; gap:8px; height:36px; min-width:0; margin:0; padding:0 10px 0 14px;
    background:transparent; border:0; border-radius:0; box-shadow:none; font-family:var(--wm-font-systeme); font-size:14px; font-weight:400; line-height:1; letter-spacing:normal; text-transform:none;
    color:var(--wm-ink); white-space:nowrap; cursor:pointer; text-decoration:none; }
  .cm-ui .wm-touche::before { content:''; position:absolute; inset:0; z-index:-1; border-radius:var(--wm-radius-bouton); background:var(--wm-face-touche); border:1px solid var(--wm-line); pointer-events:none; }
  .cm-ui .wm-touche.wm-principale::before { border-color:var(--wm-line-strong); }
  .cm-ui .wm-touche.wm-principale { font-weight:500; }   /* bouton principal en graisse 500 (charte V2, Typographie) */
  .cm-ui .wm-touche:hover::before { background:var(--wm-face-touche-survol); }
  .cm-ui .wm-touche:active::before { background:var(--wm-surface-raised); }
  .cm-ui .wm-touche.wm-petite { height:32px; padding:0 8px 0 12px; gap:6px; }
  .cm-ui .wm-touche.cm-on::before, .cm-ui .wm-touche[aria-pressed="true"]::before { background:var(--wm-surface-raised); border-color:var(--wm-line-strong); }
  /* Désactivé (fiche Etats) : trait line, libellé et repère ink-faint, face inchangée, pas d'opacité. */
  .cm-ui .wm-touche:disabled, .cm-ui .wm-touche[aria-disabled="true"] { color:var(--wm-ink-faint); cursor:default; }
  .cm-ui .wm-touche:disabled::before, .cm-ui .wm-touche[aria-disabled="true"]::before { border-color:var(--wm-line); background:var(--wm-face-touche); }
  .cm-ui .wm-touche:disabled .wm-repere, .cm-ui .wm-touche[aria-disabled="true"] .wm-repere { border-color:var(--wm-line); color:var(--wm-ink-faint); }
  /* « annuler » et actions discrètes : texte seul, sans cadre (ink-soft : contraste sur le verre, T12). */
  .cm-ui .wm-texte { display:inline-flex; align-items:center; gap:6px; height:36px; margin:0; padding:0 8px; background:none; border:0; border-radius:var(--wm-radius-bouton); box-shadow:none;
    font-family:var(--wm-font-systeme); font-size:14px; font-weight:400; line-height:1; color:var(--wm-ink-soft); cursor:pointer; white-space:nowrap; text-transform:none; }
  .cm-ui .wm-texte:hover { color:var(--wm-ink); }
  /* Raccourci : la touche du clavier dans un petit carré arrondi de 4 px, à droite du libellé. */
  .cm-ui .wm-repere { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 4px; margin-left:4px; border:1px solid var(--wm-line-strong);
    border-radius:var(--wm-radius-repere); font-family:var(--wm-font-touche); font-size:13px; font-weight:400; line-height:1; color:var(--wm-ink-soft); flex:none; }
  /* Texte pour les lecteurs d'écran seulement (« cmd » derrière l'icône ⌘). */
  .cm-ui .wm-lu { position:absolute; width:1px; height:1px; margin:-1px; padding:0; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
  /* Icône seule : icône Phosphor dans un cercle fin de 30 px, zone cliquable portée à 44 px par ::before. */
  .cm-ui .wm-cercle { position:relative; display:inline-flex; align-items:center; justify-content:center; flex:none; width:30px; height:30px; margin:0; padding:0;
    border:1px solid var(--wm-line-strong); border-radius:50%; background:transparent; box-shadow:none; color:var(--wm-ink-soft); font-size:0; line-height:0; cursor:pointer; }
  .cm-ui .wm-cercle::before { content:''; position:absolute; left:50%; top:50%; width:44px; height:44px; margin:-22px 0 0 -22px; border-radius:50%; }
  .cm-ui .wm-cercle:hover { color:var(--wm-ink); border-color:var(--wm-ink); }
  .cm-ui .wm-cercle.wm-cercle-24 { width:24px; height:24px; }
  .cm-ui .wm-cercle:disabled, .cm-ui .wm-cercle.wm-inactif { border-color:var(--wm-line); color:var(--wm-ink-faint); cursor:default; }
  /* Champs et zones en creux : arrondi de 5 px (radius-champ). */
  .cm-ui .wm-champ { position:relative; display:block; }
  .cm-ui .wm-champ > textarea, .cm-ui textarea.wm-coupe, .cm-ui select.wm-coupe { border-radius:var(--wm-radius-champ); outline:none; }
  .cm-ui .wm-champ > textarea:focus { border-color:var(--wm-line-strong); }
  /* Une règle de focus de la page hôte (ombre colorée, « :focus-visible { box-shadow } ») n'atteint pas nos champs. */
  .cm-ui textarea:focus, .cm-ui textarea:focus-visible, .cm-ui input:focus, .cm-ui input:focus-visible, .cm-ui select:focus, .cm-ui select:focus-visible { box-shadow:none; }

  /* Focus clavier (fiche Etats), seulement en :focus-visible : contour de 2 px à l'encre, à 2 px de la forme,
     qui suit son arrondi (comme un outline de 2 px décalé de 2 px). Touche et champ : tracé par ::after, posé
     autour de la face (la touche « terminer » du bandeau a une zone cliquable plus haute que sa face).
     Forme ronde ou texte seul : outline de 2 px à 2 px. Un champ, lui, est toujours « :focus-visible » pour
     Chromium, même après un clic ou un focus posé par le script : son anneau ne s'affiche que si le focus
     vient du clavier (body[data-wm-clavier], voir modaliteFocus) ; au clic, seul son trait passe à line-strong. */
  .cm-ui .wm-touche:focus, .cm-ui .wm-cercle:focus, .cm-ui .wm-texte:focus { outline:none; }
  .cm-ui .wm-touche:focus-visible::after, body[data-wm-clavier] .cm-ui .wm-champ:has(> textarea:focus)::after {
    content:''; position:absolute; left:-4px; top:-4px; right:-4px; bottom:-4px; z-index:2; background:none; border:2px solid var(--wm-ink); border-radius:calc(var(--wm-radius-bouton) + 4px); pointer-events:none; }
  body[data-wm-clavier] .cm-ui .wm-champ:has(> textarea:focus)::after { border-radius:calc(var(--wm-radius-champ) + 4px); }
  .cm-ui .wm-cercle:focus-visible, .cm-ui .wm-texte:focus-visible, .cm-ui .cm-toggle-btn:focus-visible { outline:2px solid var(--wm-ink); outline-offset:2px; }
  @media (forced-colors:active) {
    .wm-contour path { stroke:CanvasText; }
    .wm-habille > .wm-verre { border:1px solid CanvasText; }   /* les ombres disparaissent en contraste forcé : le bord reste */
    .cm-ui .wm-touche::before { border-color:ButtonText; }
    .cm-ui .wm-touche:focus-visible::after, body[data-wm-clavier] .cm-ui .wm-champ:has(> textarea:focus)::after { border-color:Highlight; }
  }

  /* Voyant (F8) : disque net de 7 px à coordonnées entières, sans ombre ni halo ; sur fond clair (bouton
     de métal clair, site sombre), cerne intérieur de 1,5 px en border. Le nombre reste dans le texte
     (lecteurs d'écran, tests), hors de la vue. */
  .cm-ui .wm-voyant, .cm-ui .cm-count-badge { display:block; box-sizing:border-box; width:7px; height:7px; min-width:0; padding:0; border-radius:50%; background:var(--wm-accent);
    border:1.5px solid var(--wm-accent-ring); box-shadow:none; overflow:hidden; text-indent:-999px; white-space:nowrap; }
  body[data-wm-theme="client-sombre"] .cm-ui .wm-voyant, body[data-wm-theme="client-sombre"] .cm-ui .cm-count-badge { border:0; }
  .cm-ui .cm-count-badge:empty, .cm-ui .cm-count-badge[data-zero="1"] { display:none; }

  /* ---------- Les deux boutons ronds (fiche BoutonWitmit ; décisions C6, F8, L1) ----------
     Bouton witmit (#cmPanelBtn, 52 px) : il ouvre et ferme la liste, enfoncé = liste ouverte. Collé à sa
     gauche, le bouton du mode annotation (#cmToggleBtn, 40 px dessinés, 44 px cliquables) : enfoncé = mode
     actif. Métal poli, clair sur un site clair et sombre sur un site sombre (même attribut que le verre, V2) ;
     l'état se lit à l'enfoncement, jamais à la teinte. Créés seulement si la page n'a pas déjà les siens. */
  .cm-fab { position:fixed; right:24px; bottom:24px; z-index:845; display:flex; align-items:center; gap:8px; margin:0; padding:0;
    transition:right 240ms cubic-bezier(0.16, 1, 0.3, 1); }  /* sous le panneau (850), sauf quand il le chevauche (écran étroit) */
  .cm-fab.wm-decale { z-index:855; }                        /* liste ouverte : à gauche de la liste, toujours cliquables */
  .cm-ui .wm-bouton { position:relative; flex:none; box-sizing:border-box; display:flex; align-items:center; justify-content:center; margin:0; padding:0; border-radius:50%;
    font-size:0; line-height:0; cursor:pointer; outline:none; transition:box-shadow 120ms ease;
    /* métal sombre (défaut, site sombre ; le métal clair suit « client-clair ») */
    border:1px solid var(--wm-metal-dark-trait); color:var(--wm-metal-dark-signe); box-shadow:var(--wm-ombre-bouton);
    background:radial-gradient(ellipse 75% 50% at 50% 14%, var(--wm-metal-dark-reflet) 0%, transparent 70%),
      linear-gradient(165deg, var(--wm-metal-dark-hi) 0%, var(--wm-metal-dark-mi) 42%, var(--wm-metal-dark-lo) 62%, var(--wm-metal-dark-fin) 100%); }
  .cm-ui .wm-bouton[aria-pressed="true"], .cm-ui .wm-bouton[aria-expanded="true"] { box-shadow:var(--wm-ombre-bouton-enfonce-sombre); }
  body[data-wm-theme="client-clair"] .cm-ui .wm-bouton, .cm-ui .wm-bouton.wm-metal-clair {
    border-color:var(--wm-metal-light-trait); color:var(--wm-metal-light-signe); box-shadow:var(--wm-ombre-bouton-clair);
    background:radial-gradient(ellipse 75% 50% at 50% 14%, var(--wm-metal-light-reflet) 0%, transparent 70%),
      linear-gradient(165deg, var(--wm-metal-light-hi) 0%, var(--wm-metal-light-mi) 42%, var(--wm-metal-light-lo) 62%, var(--wm-metal-light-fin) 100%); }
  body[data-wm-theme="client-clair"] .cm-ui .wm-bouton[aria-pressed="true"], body[data-wm-theme="client-clair"] .cm-ui .wm-bouton[aria-expanded="true"],
  .cm-ui .wm-bouton.wm-metal-clair[aria-pressed="true"], .cm-ui .wm-bouton.wm-metal-clair[aria-expanded="true"] { box-shadow:var(--wm-ombre-bouton-enfonce); }
  .cm-ui .wm-bouton.wm-metal-sombre { border-color:var(--wm-metal-dark-trait); color:var(--wm-metal-dark-signe); box-shadow:var(--wm-ombre-bouton);
    background:radial-gradient(ellipse 75% 50% at 50% 14%, var(--wm-metal-dark-reflet) 0%, transparent 70%),
      linear-gradient(165deg, var(--wm-metal-dark-hi) 0%, var(--wm-metal-dark-mi) 42%, var(--wm-metal-dark-lo) 62%, var(--wm-metal-dark-fin) 100%); }
  .cm-ui .wm-bouton.wm-metal-sombre[aria-pressed="true"], .cm-ui .wm-bouton.wm-metal-sombre[aria-expanded="true"] { box-shadow:var(--wm-ombre-bouton-enfonce-sombre); }
  .cm-ui .wm-bouton-witmit { width:52px; height:52px; }
  .cm-ui .wm-bouton-mode { width:40px; height:40px; }
  .cm-ui .wm-bouton-mode::before { content:''; position:absolute; inset:-3px; border-radius:50%; }   /* zone cliquable de 44 px : 40 px moins le trait (le ::before part du bord intérieur), + 2 × 3 */
  /* Le signe du bouton witmit : le logo B1 calé à 28 px, centré sans décalage (fiche BoutonWitmit). Jamais agrandi ni réduit. */
  .cm-ui .wm-bouton-witmit .wm-signe { display:flex; margin:0; color:inherit; }
  .cm-ui .wm-bouton-witmit .wm-logo { display:block; flex:none; width:28px; height:28px; }
  /* Voyant du bouton witmit : 7 px, logé à 10 px du haut et 9 px de la droite du rond (coordonnées entières). */
  .cm-ui .wm-bouton-witmit .cm-count-badge { position:absolute; left:35px; top:9px; }
  .cm-ui .wm-bouton.wm-metal-clair .cm-count-badge { border:1.5px solid var(--wm-accent-ring); }
  .cm-ui .wm-bouton.wm-metal-sombre .cm-count-badge { border:0; }
  /* Focus clavier (fiche Etats, forme ronde) : outline de 2 px à 2 px. Le bouton est posé sur le site, pas
     sur le verre : le trait prend l'encre qui tranche sur le site (sombre sur un site clair, et l'inverse). */
  .cm-ui .wm-bouton:focus-visible { outline:2px solid var(--wm-encre-repere); outline-offset:2px; }
  body[data-wm-theme="client-sombre"] .cm-ui .wm-bouton:focus-visible { outline-color:var(--wm-encre-repere-claire); }
  @media (max-width:480px) { .cm-fab { right:16px; bottom:16px; } }   /* M1 : à 16 px des bords sur un téléphone */
  @media (prefers-reduced-motion:reduce) { .cm-fab, .cm-ui .wm-bouton { transition:none; } }
  @media (forced-colors:active) { .cm-ui .wm-bouton { border-color:ButtonText; } .cm-ui .wm-bouton[aria-pressed="true"], .cm-ui .wm-bouton[aria-expanded="true"] { border-width:3px; } }

  /* Boutons fournis par la page (C8, maquettes TellUs) : witmit les adopte (data-wm-fourni="page") sans
     toucher à leur contenu ; touche ronde à icône seule, ton sur ton, aux jetons ; .cm-on = enfoncé. */
  .cm-ui[data-wm-fourni="page"] { position:relative; box-sizing:border-box; width:40px; height:40px; margin:0; padding:0; display:flex; align-items:center; justify-content:center;
    border-radius:50%; border:1px solid var(--wm-line-strong); background:var(--wm-face-touche); backdrop-filter:blur(var(--wm-verre-flou)) saturate(var(--wm-verre-saturation)); -webkit-backdrop-filter:blur(var(--wm-verre-flou)) saturate(var(--wm-verre-saturation));
    font-size:16px; line-height:1; color:var(--wm-ink); cursor:pointer; box-shadow:var(--wm-ombre-bouton); transition:box-shadow 120ms ease; }
  .cm-ui[data-wm-fourni="page"]:hover { background:var(--wm-face-touche-survol); }
  .cm-ui[data-wm-fourni="page"].cm-on { background:var(--wm-surface-raised); box-shadow:var(--wm-ombre-bouton-enfonce-sombre); }
  .cm-ui[data-wm-fourni="page"]:focus-visible { outline:2px solid var(--wm-ink); outline-offset:2px; }
  .cm-ui[data-wm-fourni="page"] .cm-count-badge { position:absolute; top:3px; right:3px; }

  /* Mode live, widget caché : aucune couche visible (toutes portent cm-ui) tant qu'il n'est pas révélé */
  body.cm-concealed .cm-ui:not(.wm-toast-masquage) { display:none !important; }   /* sauf le message qui dit comment revenir (Léa 45) */

  body.cm-active { cursor: crosshair; }
  body.cm-active .cm-ui, body.cm-active .cm-ui * { cursor: default; }
  /* Curseurs de notre interface (la règle générique ci-dessus les neutraliserait) */
  body.cm-active .cm-ui button, body.cm-active .cm-pin, body.cm-active .cm-panel-item .body, body.cm-active .cm-panel-item .del { cursor:pointer; }
  body.cm-active .cm-popup .cm-tete { cursor:move; }
  body.cm-active .cm-popup textarea { cursor:text; }
  body.cm-active .cm-popup .cm-vignette { cursor:zoom-in; }
  body .cm-pill .cm-drag-handle { cursor:grab; }              /* la poignée ⠿ : main ouverte… */
  body .cm-pill.cm-dragging, body .cm-pill.cm-dragging * { cursor:grabbing; } /* …qui se referme pendant le déplacement */

  /* Halo du mode annotation (fiche Bandeau) : trait jaune de 3 px au bord de l'écran, filet sombre de 1 px
     juste à l'intérieur (il cerne le jaune sur le clair et disparaît de lui-même sur le sombre), lueur
     courte. Une seule règle pour tous les sites. Seule l'opacité de la lueur (::after) est animée : rien
     ne se repeint à chaque image. La couche ne capte aucun clic et n'est l'ancêtre d'aucun verre. Elle est
     posée au-dessus du site mais SOUS toutes les couches witmit (815 : la plus basse, les cadres, est à 820). */
  /* Apparition et disparition en fondu de 200 ms sur l'opacité de la couche ; cachée par visibility (pas display)
     pour que le fondu de sortie se joue (F11). La couche n'est le parent d'aucun verre : son opacité ne coupe aucun flou. */
  .cm-frame { position:fixed; inset:0; z-index:815; pointer-events:none; visibility:hidden; opacity:0; border:0 solid transparent; transition:opacity 200ms ease, visibility 0s linear 200ms; }
  .cm-frame.show { visibility:visible; opacity:1; transition:opacity 200ms ease, visibility 0s linear 0s; }
  .cm-frame::before, .cm-frame::after { content:''; position:absolute; inset:0; pointer-events:none; border:0 solid transparent; }
  .cm-frame::before { box-shadow: inset 0 0 0 3px var(--wm-accent), inset 0 0 0 4px var(--wm-halo-filet), inset 0 0 10px 2px var(--wm-halo-lueur-courte); }
  .cm-frame::after { box-shadow: inset 0 0 26px 6px var(--wm-halo-lueur); opacity:0; animation: wmHaloSouffle 4s ease-in-out infinite; }
  @keyframes wmHaloSouffle { 0%, 100% { opacity:0; } 50% { opacity:1; } }
  @media (prefers-reduced-motion:reduce) {
    .cm-frame, .cm-frame.show { transition:none; }   /* aucun fondu (Léa 48) */
    .cm-frame::after { animation:none; opacity:.5; }
  }
  @media (forced-colors:active) {
    .cm-frame::before { border:3px solid Highlight; }
    .cm-popup, .cm-panel, .cm-pill, .cm-status, .cm-toggle-btn { border-color:CanvasText; }
  }

  /* Bandeau du mode annotation (fiche Bandeau ; Léa 3.2) : fenêtre de verre de 44 px, au thème du site,
     coins witmit (habiller), centrée à 12 px sous la barre de navigation, déplaçable par sa poignée (position
     gardée). Placement et passage sur deux lignes : placerBandeau() (mesure réelle : s'il ne tient pas sur une
     ligne dans la place libre, à côté de la liste ouverte comprise). */
  .cm-pill { position:fixed; top:calc(var(--wm-nav-h) + 12px); left:50%; transform:translateX(-50%); z-index:900; color:var(--wm-ink); font-family:var(--wm-font-systeme); font-weight:400; font-size:14px; line-height:20px; text-align:left; display:none; white-space:nowrap; cursor:default; touch-action:none; width:max-content; max-width:calc(100vw - 16px); }
  .cm-pill.show { display:block; }
  .cm-pill .wm-bandeau-corps { position:relative; display:flex; align-items:center; gap:8px; height:44px; padding:0 22px 0 18px; }
  .cm-pill .wm-poignee { display:inline-flex; align-items:center; justify-content:center; flex:none; width:20px; height:44px; color:var(--wm-ink-soft); }
  .cm-pill.cm-dragging .wm-poignee { color:var(--wm-ink); }
  .cm-pill .wm-bandeau-mode { display:inline-flex; align-items:center; gap:6px; flex:none; font-weight:500; color:var(--wm-ink); }
  .cm-pill .wm-bandeau-mode .wm-voyant { flex:none; }
  .cm-pill .wm-filet { flex:none; width:1px; height:20px; background:var(--wm-line); }
  .cm-pill .wm-gestes { color:var(--wm-ink-soft); }
  .cm-pill .wm-gestes b { font-weight:500; color:var(--wm-ink); }
  .cm-pill .wm-geste { white-space:nowrap; }
  .cm-pill .wm-gestes .wm-repere { display:inline-flex; vertical-align:middle; margin:0 1px; }
  .cm-pill .wm-gestes .wm-repere svg.wm-icone { vertical-align:0; }
  /* « terminer » : touche principale compacte de 32 px ; le bouton fait 44 px de haut (zone cliquable), la face
     et son contour de focus restent à 32 px. */
  .cm-ui.cm-pill .wm-terminer { flex:none; height:44px; }
  .cm-ui.cm-pill .wm-terminer::before { top:6px; bottom:6px; }
  .cm-ui.cm-pill .wm-terminer:focus-visible::after { top:2px; bottom:2px; }
  /* Deux lignes : ligne 1 poignée, voyant, « annotation », « terminer » ; ligne 2 les gestes, à la ligne entre
     deux gestes seulement. */
  .cm-pill.wm-deux-lignes { white-space:normal; }
  .cm-pill.wm-deux-lignes .wm-bandeau-corps { display:grid; grid-template-columns:auto auto 1fr auto; grid-template-areas:"poignee mode . terminer" "gestes gestes gestes gestes"; column-gap:8px; height:auto; padding:0 22px 16px 14px; }
  .cm-pill.wm-deux-lignes .wm-poignee { grid-area:poignee; }
  .cm-pill.wm-deux-lignes .wm-bandeau-mode { grid-area:mode; }
  .cm-pill.wm-deux-lignes .wm-filet { display:none; }
  .cm-pill.wm-deux-lignes .wm-terminer { grid-area:terminer; }
  .cm-pill.wm-deux-lignes .wm-gestes { grid-area:gestes; padding-left:6px; line-height:24px; }

  /* ---------- Repères sur le site (fiches Reperes, Epingle, Selection ; F6, F7, F10, T7) ----------
     Une seule encre par repère, choisie d'après le fond du site derrière lui (isDarkBehind) : #141412 sur fond
     clair, #f6f3ee sur fond sombre (classe wm-sur-sombre posée au dessin). Jamais de couleur de marque ni
     d'aplat ; le jaune n'apparaît que dans le voyant « nouveau » de l'épingle. Mesures en pixels fixes. Les
     états se lisent à la matière et au trait : repos, nouveau (voyant), actif (métal, traits pleins), traité
     (pointillés). Ordre des couches inchangé : cadres 820-830, onde 825, liens 835, épingles 840. */
  .cm-pin, .cm-box, .wm-onde, mark.cm-highlight { --wm-encre: var(--wm-encre-repere); --wm-encre-55: var(--wm-encre-repere-55); --wm-encre-inverse: var(--wm-encre-repere-claire); }
  .cm-ui.wm-sur-sombre, mark.cm-highlight.wm-sur-sombre { --wm-encre: var(--wm-encre-repere-claire); --wm-encre-55: var(--wm-encre-repere-claire-55); --wm-encre-inverse: var(--wm-encre-repere); }

  /* Épingle (F6) : touche de verre de 24 px de haut, qui s'élargit avec le numéro ; quatre coins arrondis à
     6 px (radius-epingle, V2) ; deux petits crochets witmit à l'intérieur, à 3 px du bord, en haut à gauche et
     en bas à droite (::before : trait de 2 px, coude arrondi de 1,5 px, bras --wm-coin-pin) ; zone cliquable de
     44 px (::after transparent). Son bord droit s'aligne sur le cadre de l'élément, son bord bas 6 px au-dessus
     du cadre : le point posé en JS est ce coin bas droit (translate -100 %, -100 %). */
  .cm-pin { --wm-coin-pin: 6px; position:absolute; z-index:840; height:24px; min-width:24px; padding:0 6px; display:flex; align-items:center; justify-content:center; transform:translate(-100%,-100%); border-radius:var(--wm-radius-epingle); font-family:var(--wm-font-systeme); font-size:13px; font-weight:500; line-height:1; white-space:nowrap; color:var(--wm-encre); background:var(--wm-epingle-verre-clair); -webkit-backdrop-filter:blur(1.5px) saturate(1.7); backdrop-filter:blur(1.5px) saturate(1.7); box-shadow:inset 0 0 0 1px var(--wm-encre-repere-55), var(--wm-ombre-epingle); cursor:pointer; }
  .cm-pin.wm-sur-sombre { background:var(--wm-epingle-verre-sombre); box-shadow:inset 0 0 0 1px var(--wm-epingle-contour-sombre), var(--wm-ombre-epingle); }
  .cm-pin.wm-dessous { transform:translate(-100%,0); }            /* pas de place au-dessus : sous le coin bas droit */
  .cm-pin.wm-pin-texte { transform:translate(0,-100%); }          /* passage de texte : au-dessus de son début */
  .cm-pin > span { position:relative; }
  .cm-pin::before { content:''; position:absolute; inset:3px; pointer-events:none; box-sizing:border-box; background:none; border:2px solid var(--wm-encre); border-radius:1.5px;
    -webkit-mask:linear-gradient(#000,#000) left top / var(--wm-coin-pin) var(--wm-coin-pin) no-repeat, linear-gradient(#000,#000) right bottom / var(--wm-coin-pin) var(--wm-coin-pin) no-repeat;
    mask:linear-gradient(#000,#000) left top / var(--wm-coin-pin) var(--wm-coin-pin) no-repeat, linear-gradient(#000,#000) right bottom / var(--wm-coin-pin) var(--wm-coin-pin) no-repeat; }
  .cm-pin::after { content:''; position:absolute; inset:-10px; }
  /* Épingles secondaires d'une sélection multiple : 20 px, numéro en 12 px, crochets de 5 px, jamais de voyant. */
  .cm-pin.cm-pin-secondary { --wm-coin-pin: 5px; height:20px; min-width:20px; padding:0 5px; }
  .cm-pin.cm-pin-secondary::after { inset:-12px; }
  /* Zone en édition : la fenêtre est déjà ouverte ; la zone élargie de l'épingle ne doit pas couvrir les poignées. */
  body.wm-zone-en-edition .cm-pin::after { pointer-events:none; }
  /* Nouveau : voyant jaune de 7 px centré sur le coin haut droit ; cerne intérieur sur fond clair, disque plein
     sur fond sombre ; jamais de halo. */
  .cm-pin .wm-voyant-epingle { position:absolute; right:-4px; top:-4px; width:7px; height:7px; border-radius:50%; background:var(--wm-accent); border:1.5px solid var(--wm-accent-ring); pointer-events:none; }
  .cm-pin.wm-sur-sombre .wm-voyant-epingle { border:0; }
  /* Traité : même face « à plat », contour de 1 px en pointillés (55 %), ni liseré ni ombre, chiffre à pleine encre. */
  .cm-pin.cm-done { box-shadow:none; outline:1px dashed var(--wm-encre-repere-55); outline-offset:-1px; }
  .cm-pin.cm-done.wm-sur-sombre { outline-color:var(--wm-epingle-contour-sombre); }
  /* Actif (fenêtre ouverte, ligne sélectionnée, survol) : l'épingle devient métal, comme le bouton witmit. */
  .cm-pin.cm-focus, .cm-pin.cm-glow, .cm-pin:hover { --wm-encre: var(--wm-encre-repere-claire); -webkit-backdrop-filter:none; backdrop-filter:none; outline:none;
    background:linear-gradient(165deg, var(--wm-metal-dark-hi) 0%, var(--wm-metal-dark-mi) 42%, var(--wm-metal-dark-lo) 62%, var(--wm-metal-dark-fin) 100%);
    box-shadow:inset 0 0 0 1px var(--wm-metal-dark-trait), var(--wm-ombre-epingle-metal-sombre); }
  .cm-pin.wm-sur-sombre.cm-focus, .cm-pin.wm-sur-sombre.cm-glow, .cm-pin.wm-sur-sombre:hover { --wm-encre: var(--wm-encre-repere);
    background:linear-gradient(165deg, var(--wm-metal-light-hi) 0%, var(--wm-metal-light-mi) 42%, var(--wm-metal-light-lo) 62%, var(--wm-metal-light-fin) 100%);
    box-shadow:inset 0 0 0 1px var(--wm-metal-light-trait), var(--wm-ombre-epingle-metal-clair); }
  .cm-pin:focus-visible { outline:2px solid var(--wm-encre-repere); outline-offset:2px; }
  .cm-pin.wm-sur-sombre:focus-visible { outline-color:var(--wm-encre-repere-claire); }

  /* Liens d'une sélection multiple : pointillés 3 3, encre à 55 %, sous les épingles. */
  #cmLinks { position:absolute; left:0; top:0; pointer-events:none; z-index:835; overflow:visible; }
  #cmLinks line { stroke:var(--wm-encre-repere-55); stroke-width:1; stroke-dasharray:3 3; }
  #cmLinks line.wm-sur-sombre { stroke:var(--wm-encre-repere-claire-55); }
  #cmLinks line.cm-focus { stroke:var(--wm-encre-repere); }
  #cmLinks line.cm-focus.wm-sur-sombre { stroke:var(--wm-encre-repere-claire); }
  body:not(.cm-active) #cmLinks { display:none; }

  /* Cadres (F7, fiche Selection) : .cm-box garde exactement la boîte visée (élément ou zone) ; le dessin vit
     dans son enfant .wm-cadre : 16 px de marge autour d'un élément visé, aucune autour d'une zone encadrée.
     Coins witmit de 18 px (bras de 14,4 px, trait de 3,6 px) en haut à gauche et en bas à droite ; traits de
     1 px ouverts à 20 px des angles, centrés sur l'épaisseur des coins ; un côté de moins de 56 px n'a pas de
     trait (classes wm-court-h et wm-court-v posées en JS). Aucun remplissage, aucune ombre ; arrondi de 6 px
     (radius-bouton, V2 : plus d'angle droit). En tracé (on glisse) : rectangle arrondi de 1 px en pointillés, sans coins. */
  .cm-box { position:absolute; z-index:820; pointer-events:none; box-sizing:border-box; background:transparent; border:1px dashed var(--wm-encre); border-radius:var(--wm-radius-bouton); }
  .cm-box.cm-box-saved, .cm-box.cm-box-editing, .cm-box.cm-box-editable { border:0; }
  .cm-box > .wm-cadre { --wm-th: var(--wm-encre-55); --wm-tv: var(--wm-encre-55); position:absolute; inset:0; pointer-events:none; border-radius:var(--wm-radius-bouton); background:
    linear-gradient(var(--wm-th),var(--wm-th)) 20px 0 / calc(100% - 40px) 1px no-repeat,
    linear-gradient(var(--wm-th),var(--wm-th)) 20px 100% / calc(100% - 40px) 1px no-repeat,
    linear-gradient(var(--wm-tv),var(--wm-tv)) 0 20px / 1px calc(100% - 40px) no-repeat,
    linear-gradient(var(--wm-tv),var(--wm-tv)) 100% 20px / 1px calc(100% - 40px) no-repeat; }
  .cm-box.cm-box-outline > .wm-cadre, .cm-box.cm-box-editing > .wm-cadre { inset:-16px; }
  /* Coins tracés en fond (une bordure de 3,6 px serait arrondie au pixel de l'écran). */
  .cm-box > .wm-cadre::before, .cm-box > .wm-cadre::after { --wm-trait-coin: 3.6px; content:''; position:absolute; width:14.4px; height:14.4px; }
  .cm-box > .wm-cadre::before { left:-1.3px; top:-1.3px; background:linear-gradient(var(--wm-encre),var(--wm-encre)) 0 0 / 100% var(--wm-trait-coin) no-repeat, linear-gradient(var(--wm-encre),var(--wm-encre)) 0 0 / var(--wm-trait-coin) 100% no-repeat; }
  .cm-box > .wm-cadre::after { right:-1.3px; bottom:-1.3px; background:linear-gradient(var(--wm-encre),var(--wm-encre)) 100% 100% / 100% var(--wm-trait-coin) no-repeat, linear-gradient(var(--wm-encre),var(--wm-encre)) 100% 100% / var(--wm-trait-coin) 100% no-repeat; }
  /* Actif (fenêtre ouverte, élément visé pendant la saisie, survol de l'épingle, zone en édition) : traits pleins. */
  .cm-box.cm-focus > .wm-cadre, .cm-box.cm-glow > .wm-cadre, .cm-box.cm-box-editing > .wm-cadre, .cm-box.cm-box-editable > .wm-cadre { --wm-th: var(--wm-encre); --wm-tv: var(--wm-encre); }
  /* Traité : coins en trait de 1 px, traits en pointillés de 1 px à 55 %. */
  .cm-box.cm-done:not(.cm-focus):not(.cm-glow) > .wm-cadre { background:
    repeating-linear-gradient(90deg, var(--wm-th) 0 3px, transparent 3px 6px) 20px 0 / calc(100% - 40px) 1px no-repeat,
    repeating-linear-gradient(90deg, var(--wm-th) 0 3px, transparent 3px 6px) 20px 100% / calc(100% - 40px) 1px no-repeat,
    repeating-linear-gradient(180deg, var(--wm-tv) 0 3px, transparent 3px 6px) 0 20px / 1px calc(100% - 40px) no-repeat,
    repeating-linear-gradient(180deg, var(--wm-tv) 0 3px, transparent 3px 6px) 100% 20px / 1px calc(100% - 40px) no-repeat; }
  .cm-box.cm-done:not(.cm-focus):not(.cm-glow) > .wm-cadre::before, .cm-box.cm-done:not(.cm-focus):not(.cm-glow) > .wm-cadre::after { --wm-trait-coin: 1px; width:12.8px; height:12.8px; }
  .cm-box.cm-done:not(.cm-focus):not(.cm-glow) > .wm-cadre::before { left:0; top:0; }
  .cm-box.cm-done:not(.cm-focus):not(.cm-glow) > .wm-cadre::after { right:0; bottom:0; }
  /* Petit côté (moins de 56 px, marge comprise) : pas de trait, il ne reste que les deux coins. */
  .cm-box.wm-court-h > .wm-cadre { --wm-th: transparent !important; }
  .cm-box.wm-court-v > .wm-cadre { --wm-tv: transparent !important; }
  .cm-box.cm-box-saved { transition:none; }

  /* Zone en édition (fenêtre ouverte) : le centre déplace, 8 poignées redimensionnent. Les deux coins witmit
     servent de poignées d'angle (haut gauche, bas droit) ; les six autres sont des carrés pleins de 8 × 8 px
     à l'encre, cernés de 1 px de l'encre opposée. Prise de 24 × 24 px, 44 px quand la zone dépasse 88 px. */
  .cm-box.cm-box-editable { pointer-events:auto; touch-action:none; z-index:830; }
  body .cm-box.cm-box-editable { cursor:move; }
  .cm-box .cm-handle { position:absolute; width:24px; height:24px; transform:translate(-50%,-50%); box-sizing:border-box; background:none; }
  .cm-box.wm-prise-large .cm-handle { width:44px; height:44px; }
  .cm-box .cm-handle-nw { left:0; top:0; } .cm-box .cm-handle-n { left:50%; top:0; } .cm-box .cm-handle-ne { left:100%; top:0; }
  .cm-box .cm-handle-e { left:100%; top:50%; } .cm-box .cm-handle-se { left:100%; top:100%; } .cm-box .cm-handle-s { left:50%; top:100%; }
  .cm-box .cm-handle-sw { left:0; top:100%; } .cm-box .cm-handle-w { left:0; top:50%; }
  .cm-box .cm-handle-n::after, .cm-box .cm-handle-ne::after, .cm-box .cm-handle-e::after, .cm-box .cm-handle-s::after, .cm-box .cm-handle-sw::after, .cm-box .cm-handle-w::after { content:''; position:absolute; left:50%; top:50%; width:8px; height:8px; margin:-4px 0 0 -4px; background:var(--wm-encre); box-shadow:0 0 0 1px var(--wm-encre-inverse); }
  body .cm-ui .cm-handle-nw, body .cm-ui .cm-handle-se { cursor:nwse-resize; } body .cm-ui .cm-handle-ne, body .cm-ui .cm-handle-sw { cursor:nesw-resize; }
  body .cm-ui .cm-handle-n, body .cm-ui .cm-handle-s { cursor:ns-resize; } body .cm-ui .cm-handle-e, body .cm-ui .cm-handle-w { cursor:ew-resize; }

  /* Hors mode annotation, la page redevient propre : repères masqués, réaffichés à l'activation. */
  body:not(.cm-active) .cm-pin, body:not(.cm-active) .cm-box.cm-box-saved, body:not(.cm-active) .wm-onde { display:none; }

  /* Onde (repère retrouvé depuis la liste, ou qui vient d'être commenté) : un élément à part, contour de 1 px
     à l'encre qui part du bord du repère, s'écarte de 16 px et s'efface, 600 ms, deux fois. Plus de halo en
     box-shadow. Animations réduites : pas d'onde, le repère passe directement à l'état actif. Les classes
     cm-ola et cm-ola-light restent posées sur le repère le temps de l'onde (repère pour les tests). */
  .wm-onde { position:absolute; z-index:825; pointer-events:none; }
  .wm-onde::before { content:''; position:absolute; inset:0; border:1px solid var(--wm-encre); border-radius:var(--wm-radius-bouton); opacity:0; animation:wmOnde 600ms ease-out 2; }
  @keyframes wmOnde { from { inset:0; opacity:1; } to { inset:-16px; opacity:0; } }
  @media (prefers-reduced-motion:reduce) { .wm-onde { display:none; } }

  /* Passage de texte (F10) : marqué comme le ferait un correcteur, souligné et pris entre deux coins witmit
     (début du premier morceau, fin du dernier : classes wm-debut et wm-fin), qui débordent de 4 px de chaque côté.
     Aucune marge : le texte garde sa place, sa couleur et sa police ; witmit ne touche qu'au trait (relecture de
     Paula). Les coins sont en border-box (le mark n'est pas sous la remise à zéro de .cm-ui). Hors mode : rien. */
  body.cm-active mark.cm-highlight { position:relative; padding:0; border-radius:0; text-decoration-line:underline; text-decoration-style:solid; text-decoration-thickness:2px; text-decoration-color:var(--wm-encre); text-underline-offset:4px; text-decoration-skip-ink:none; }
  body.cm-active mark.cm-highlight.wm-debut::before, body.cm-active mark.cm-highlight.wm-fin::after { content:''; position:absolute; box-sizing:border-box; width:7px; height:7px; border:0 solid var(--wm-encre); pointer-events:none; }
  body.cm-active mark.cm-highlight.wm-debut::before { left:-4px; top:-2px; border-left-width:2px; border-top-width:2px; }
  body.cm-active mark.cm-highlight.wm-fin::after { right:-4px; bottom:-6px; border-right-width:2px; border-bottom-width:2px; }
  body.cm-active mark.cm-highlight.cm-focus { text-decoration-thickness:3px; }
  body.cm-active mark.cm-highlight.cm-focus.wm-debut::before, body.cm-active mark.cm-highlight.cm-focus.wm-fin::after { width:10px; height:10px; border-width:3px; }
  body.cm-active mark.cm-highlight.cm-focus.wm-debut::before { border-right-width:0; border-bottom-width:0; }
  body.cm-active mark.cm-highlight.cm-focus.wm-fin::after { border-left-width:0; border-top-width:0; }
  body.cm-active mark.cm-highlight.cm-done:not(.cm-focus) { text-decoration-thickness:1px; text-decoration-style:dotted; }
  body.cm-active mark.cm-highlight.cm-done:not(.cm-focus)::before, body.cm-active mark.cm-highlight.cm-done:not(.cm-focus)::after { content:none; }

  /* ---------- Fenêtre de saisie (fiche Fenetre ; M1) ----------
     380 px, au plus 100vw − 16px sous 480 px de large. Matière par habiller(). La tête entière sert de
     poignée (titre, croix, élément visé dessous) ; corps : champ arrondi en police système, catégorie en touches
     dépliées (I4), actions. Les marges laissent libres les deux coins witmit. */
  .cm-popup { position:absolute; z-index:950; width:380px; padding:0; color:var(--wm-ink); font-family:var(--wm-font-systeme); font-size:13px; line-height:1.4; text-align:left; }
  @media (max-width:480px) { .cm-popup { width:min(380px, calc(100vw - 16px)); } }
  .cm-popup .cm-tete { position:relative; padding:14px 14px 10px 22px; border-bottom:1px solid var(--wm-line); cursor:move; touch-action:none; -webkit-user-select:none; user-select:none; }
  .cm-popup .cm-tete-l1 { display:flex; align-items:center; gap:8px; margin:0 0 6px; }
  .cm-popup .cm-titre { flex:1; min-width:0; margin:0; font-family:var(--wm-font-systeme); font-size:15px; font-weight:600; line-height:1.3; letter-spacing:normal; text-transform:none; color:var(--wm-ink); }
  .cm-popup .cm-zone { display:flex; align-items:center; gap:6px; min-width:0; font-family:var(--wm-font-systeme); font-size:13px; font-weight:400; line-height:1.4; color:var(--wm-ink-soft); white-space:nowrap; overflow:hidden; }
  .cm-popup .cm-zone .wm-icone { margin:0; }
  .cm-popup .cm-zone-txt { min-width:0; overflow:hidden; text-overflow:ellipsis; }
  .cm-popup .cm-aide-multi { display:flex; align-items:center; gap:4px; margin-top:4px; font-size:13px; color:var(--wm-ink-soft); white-space:nowrap; }
  .cm-popup .cm-aide-multi .wm-repere { margin:0; }
  .cm-popup .cm-corps { position:relative; padding:12px 24px 20px 20px; }
  .cm-popup .cm-libelle { display:block; margin:0 0 6px; font-family:var(--wm-font-systeme); font-size:13px; font-weight:400; line-height:1.4; letter-spacing:normal; text-transform:none; color:var(--wm-ink-soft); }
  .cm-popup .cm-libelle-cat { margin-top:12px; }
  /* Champ (fiche Fenetre, fiche Etats) : arrondi de 5 px, trait line (line-strong au focus), police système 15 px. Sans
     poignée de redimensionnement : le champ grandit avec le texte, puis défile.
     Les règles de focus de la page hôte (ombre, fond, bord) ne l'atteignent pas : anneau de la charte seul. */
  .cm-popup .wm-champ > textarea { display:block; width:100%; min-height:74px; max-height:240px; margin:0; padding:9px 12px; resize:none; overflow-y:auto;
    border:1px solid var(--wm-line); border-radius:var(--wm-radius-champ); background:var(--wm-champ-fond); box-shadow:none; outline:none;
    font-family:var(--wm-font-systeme); font-size:15px; font-weight:400; line-height:1.45; letter-spacing:normal; text-transform:none; color:var(--wm-ink); }
  .cm-popup .wm-champ > textarea:focus, .cm-popup .wm-champ > textarea:focus-visible { border-color:var(--wm-line-strong); background:var(--wm-champ-fond); box-shadow:none; outline:none; }
  .cm-popup .wm-champ > textarea::placeholder { font-family:var(--wm-font-systeme); font-size:14px; font-weight:400; line-height:1.5; color:var(--wm-ink-faint); opacity:1; }
  .cm-popup .wm-champ > textarea.cm-reply-ta { min-height:44px; }
  .cm-popup .cm-champ-reponse { margin-top:12px; }
  /* Champ vide + entrée : une phrase sous le champ, icône Info, encre (jamais de rouge). */
  .cm-popup .cm-refus { display:flex; align-items:center; gap:6px; margin-top:6px; font-size:13px; line-height:1.4; color:var(--wm-ink); }
  /* Vignette de la capture d'une zone : 112 × 64 px, arrondi de 5 px, trait line-strong. */
  .cm-popup .cm-vignette-ligne { display:flex; align-items:center; gap:12px; margin-top:10px; }
  .cm-popup .cm-vignette { position:relative; isolation:isolate; flex:none; display:block; width:112px; height:64px; margin:0; padding:0; border:0; border-radius:var(--wm-radius-champ); background:transparent; box-shadow:none; cursor:zoom-in; }
  .cm-popup .cm-vignette-face { position:absolute; inset:0; display:block; overflow:hidden; border-radius:var(--wm-radius-champ); border:1px solid var(--wm-line-strong); background:var(--wm-surface-raised); }
  .cm-popup .cm-vignette img { display:block; width:100%; height:100%; max-width:none; object-fit:cover; }
  .cm-popup .cm-vignette:focus { outline:none; }
  .cm-popup .cm-vignette:focus-visible::after { content:''; position:absolute; left:-4px; top:-4px; right:-4px; bottom:-4px; z-index:2; background:none; border:2px solid var(--wm-ink); border-radius:calc(var(--wm-radius-champ) + 4px); pointer-events:none; }
  .cm-popup .cm-vignette-meta { font-size:13px; line-height:1.4; color:var(--wm-ink-soft); }
  /* Catégorie (I4) : sélecteur fermé en touche secondaire pleine largeur ; ouvert, les huit catégories en
     touches de 36 px dans la fenêtre, 8 px d'écart (zones de 44 px sans chevauchement). */
  .cm-popup .cm-cat.wm-touche { display:flex; width:100%; justify-content:flex-start; gap:8px; padding:0 10px 0 12px; font-size:14px; font-weight:400; }
  .cm-popup .cm-cat-nom { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; text-align:left; }
  .cm-popup .cm-cat-auto { flex:none; display:inline-flex; align-items:center; height:18px; padding:0 5px; font-family:var(--wm-font-systeme); font-size:13px; font-weight:400; line-height:1; color:var(--wm-ink-soft); border:1px solid var(--wm-line); border-radius:var(--wm-radius-repere); }
  .cm-popup .cm-cat-liste { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
  .cm-popup .cm-cat-choix.wm-touche { max-width:100%; justify-content:flex-start; gap:6px; padding:0 8px 0 10px; font-size:13px; font-weight:400; }
  .cm-popup .cm-cat-choix span { min-width:0; overflow:hidden; text-overflow:ellipsis; }
  /* Lecture seule : verrou, texte de la personne entre « », catégorie en méta. Complément : zone en creux. */
  .cm-popup .cm-lock-line, .cm-popup .cm-meta-lu { display:flex; flex-wrap:wrap; align-items:center; gap:4px 6px; font-size:13px; line-height:1.4; color:var(--wm-ink-soft); }
  .cm-popup .cm-lock-line { margin:0 0 8px; }
  .cm-popup .cm-lock-line b, .cm-popup .cm-feedback-titre b { color:var(--wm-ink); font-weight:500; }
  .cm-popup .cm-meta-lu { margin-top:8px; }
  .cm-popup .cm-lock-line .wm-icone, .cm-popup .cm-meta-lu .wm-icone, .cm-popup .cm-feedback-titre .wm-icone { margin:0; }
  .cm-popup .cm-texte-lu, .cm-popup .cm-feedback-msg { font-family:var(--wm-font-systeme); font-size:15px; font-weight:400; line-height:1.4; color:var(--wm-ink); white-space:pre-wrap; word-break:break-word; }
  .cm-popup .cm-feedback { margin-top:10px; padding:8px 10px; background:var(--wm-surface-raised); border-radius:var(--wm-radius-champ); }
  .cm-popup .cm-feedback-titre { display:flex; align-items:center; gap:5px; margin-bottom:2px; font-size:13px; line-height:1.4; color:var(--wm-ink-soft); }
  /* Actions : supprimer (cercle, jamais rouge) à gauche ; « annuler » en texte et la touche principale à droite. */
  .cm-popup .cm-popup-actions { display:flex; align-items:center; justify-content:flex-end; gap:4px; margin-top:16px; }
  .cm-popup .cm-delete { margin-right:auto; }
  .cm-popup .cm-popup-actions .wm-texte { padding:0 6px; }
  .cm-popup .cm-popup-actions .wm-touche { padding:0 8px 0 12px; }

  /* ---------- Liste des retours (fiches Tiroir, FilDeMessages, Rapport ; C7, M1) ----------
     Fenêtre witmit de 380 px sur toute la hauteur, collée à droite (pleine largeur, en surimpression, sous
     480 px). Matière par habiller(). Tête, liste qui défile, encart « coller un retour », pied collé en bas. */
  .cm-panel { position:fixed; top:0; right:0; height:100vh; width:380px; max-width:100vw; z-index:850; color:var(--wm-ink); display:flex; flex-direction:column;
    font-family:var(--wm-font-systeme); font-size:13px; line-height:1.4; text-align:left; transform:translateX(100%); visibility:hidden;
    transition:transform 240ms cubic-bezier(0.16, 1, 0.3, 1), visibility 0s linear 240ms; }
  .cm-panel.show { transform:translateX(0); visibility:visible; transition-delay:0s; }
  @media (max-width:480px) { .cm-panel { width:100vw; } }
  @media (prefers-reduced-motion:reduce) { .cm-panel { transition:none; } }
  /* Tête : marges 14 / 14 / 12 / 22, filet dessous. */
  .cm-panel-head { flex:none; padding:14px 14px 12px 22px; border-bottom:1px solid var(--wm-line); }
  .cm-panel-head-row { display:flex; align-items:center; gap:10px; margin:0 0 6px; }
  .cm-panel-titre { flex:1; min-width:0; font-family:var(--wm-font-systeme); font-size:15px; font-weight:600; line-height:1.3; color:var(--wm-ink); }
  .cm-panel-head-row #cmPanelCount { font-family:var(--wm-font-systeme); font-size:22px; font-weight:600; line-height:1; color:var(--wm-ink); }
  .cm-panel-ligne, .cm-panel-sub, .cm-panel-author { display:flex; flex-wrap:wrap; align-items:center; gap:0 6px; min-height:22px; font-size:13px; line-height:1.4; color:var(--wm-ink-soft); }
  .cm-panel-author[hidden], .cm-panel-ailleurs[hidden] { display:none; }
  .cm-panel-author b { color:var(--wm-ink); font-weight:500; }
  .cm-panel-filtres { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:0 12px; min-height:28px; margin-top:2px; }
  .cm-panel-filtres:not(:has(> :not([hidden]))) { display:none; }   /* maquette, page vide : aucune ligne de filtres */
  /* « masquer les terminés » (case de 16 px) et « masquer witmit » : textes seuls, zone de 44 px de haut. */
  .cm-ui .cm-filtre { position:relative; display:inline-flex; align-items:center; gap:6px; height:28px; margin:0; padding:0; background:none; border:0; border-radius:var(--wm-radius-bouton); box-shadow:none;
    font-family:var(--wm-font-systeme); font-size:13px; font-weight:400; line-height:1; color:var(--wm-ink-soft); cursor:pointer; white-space:nowrap; text-transform:none; }
  .cm-ui .cm-filtre::before { content:''; position:absolute; left:0; right:0; top:-8px; bottom:-8px; }
  .cm-ui .cm-filtre:hover { color:var(--wm-ink); }
  .cm-ui .cm-filtre:focus { outline:none; }
  .cm-ui .cm-filtre:focus-visible { outline:2px solid var(--wm-ink); outline-offset:2px; }
  .cm-ui .cm-filtre .wm-repere { margin-left:2px; }
  /* « ⌥ deux fois » : le carré de la touche, puis « deux fois » collé à lui. */
  .cm-ui .wm-repere-double { display:inline-flex; align-items:center; gap:4px; }
  .cm-ui .wm-repere-double .wm-repere { margin-left:0; }
  .cm-ui .wm-case { position:relative; flex:none; display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; border:1px solid var(--wm-line-strong); border-radius:var(--wm-radius-repere); color:var(--wm-ink); background:transparent; }
  .cm-ui .wm-case .wm-icone { display:none; }
  .cm-ui [aria-checked="true"] > .wm-case .wm-icone, .cm-ui input:checked + .wm-case .wm-icone { display:inline-block; }
  /* La liste : 12 px des bords ; une ligne = numéro, corps, actions (12 px d'écart). */
  .cm-panel-list { flex:1; min-height:0; overflow-y:auto; padding:4px 12px; }
  @media (max-width:480px) { .cm-panel-list { padding-bottom:76px; } }   /* M1 : la fin de la liste défile au-dessus des deux boutons (52 + 24 px) */
  .cm-panel-item { position:relative; isolation:isolate; display:flex; gap:12px; padding:12px 8px; border-bottom:1px solid var(--wm-line); }
  .cm-panel-item:last-child { border-bottom:0; }
  .cm-panel-item::before { content:''; position:absolute; inset:0; z-index:-1; border-radius:var(--wm-radius-bouton); background:transparent; pointer-events:none; }
  .cm-panel-item:hover::before, .cm-panel-item.cm-current::before { background:var(--wm-surface-raised); }
  .cm-panel-item .num { flex:none; display:flex; align-items:center; justify-content:center; min-width:24px; height:24px; padding:0 5px; border:1px solid var(--wm-line-strong); border-radius:var(--wm-radius-numero);
    background:transparent; font-family:var(--wm-font-systeme); font-size:13px; font-weight:500; line-height:1; color:var(--wm-ink); }
  /* Ligne sélectionnée : même face + numéro plein, chiffre dans l'encre de l'autre thème (pas de barre à gauche). */
  .cm-panel-item.cm-current .num { background:var(--wm-ink); border-color:var(--wm-ink); color:var(--wm-encre-repere-claire); }
  body[data-wm-theme="client-sombre"] .cm-panel-item.cm-current .num { color:var(--wm-encre-repere); }
  .cm-panel-item .body { flex:1; min-width:0; cursor:pointer; }
  .cm-panel-item .zone { display:flex; align-items:center; gap:6px; min-width:0; font-size:13px; font-weight:400; line-height:1.4; color:var(--wm-ink-soft); white-space:nowrap; overflow:hidden; }
  .cm-panel-item .zone .wm-icone { margin:0; }
  .cm-panel-item .zone-txt { min-width:0; overflow:hidden; text-overflow:ellipsis; }
  /* Texte de la personne : police système 15 px, entre « » (posés par le style : le texte du retour reste intact). */
  .cm-panel-item .txt { margin-top:3px; font-family:var(--wm-font-systeme); font-size:14px; font-weight:400; line-height:1.4; color:var(--wm-ink); white-space:pre-wrap; word-wrap:break-word; overflow-wrap:anywhere; }
  .cm-panel-item .txt::before, .cm-voix::before { content:'« '; }
  .cm-panel-item .txt::after, .cm-voix::after { content:' »'; }
  /* Méta : ligne 1 = verrou, statut (ou marque d'envoi) en gras, voyant, prénom, date ; ligne 2 = catégorie. */
  .cm-panel-item .cm-meta { display:flex; flex-wrap:wrap; align-items:center; gap:4px 6px; margin-top:6px; font-size:13px; line-height:1.4; color:var(--wm-ink-soft); }
  .cm-panel-item .cm-meta2 { gap:2px 14px; margin-top:0; }
  .cm-panel-item .cm-meta b { color:var(--wm-ink); font-weight:500; }
  .cm-panel-item .cm-meta > span, .cm-panel-item .cm-mi { display:inline-flex; align-items:center; gap:5px; white-space:nowrap; }
  .cm-panel-item .cm-meta .wm-icone { margin:0; }
  .cm-panel-item .cm-status-chip, .cm-panel-item .cm-sync-chip, .cm-panel-item .cm-cat-chip { display:inline-flex; align-items:center; gap:5px; margin:0; padding:0; border:0; border-radius:0; background:none; box-shadow:none;
    font-family:var(--wm-font-systeme); font-size:13px; font-weight:400; line-height:1.4; color:var(--wm-ink-soft); white-space:nowrap; text-transform:none; }
  .cm-panel-item .cm-status-chip b, .cm-panel-item .cm-sync-chip b { color:var(--wm-ink); font-weight:500; }
  .cm-panel-item .cm-verrou { display:inline-flex; color:var(--wm-ink-soft); }
  .cm-panel-item .cm-nouveau { color:var(--wm-ink); font-weight:500; gap:5px; }
  .cm-panel-item .cm-nouveau .wm-voyant { display:inline-block; }
  /* « à renvoyer » : un bouton ; icône et soulignement rouges, mot à l'encre ; zone de 44 px de haut. */
  .cm-ui button.cm-sync-error { position:relative; cursor:pointer; border-radius:var(--wm-radius-bouton); }
  .cm-ui button.cm-sync-error::before { content:''; position:absolute; left:0; right:0; top:-13px; bottom:-13px; }
  .cm-ui .cm-sync-error b { text-decoration:underline 1px var(--wm-signal); text-underline-offset:3px; }
  .cm-ui .cm-sync-error.wm-sans-renvoi b { text-decoration:none; }   /* refus définitif : pas un bouton, pas de soulignement */
  .cm-ui .cm-sync-error:focus { outline:none; }
  .cm-ui .cm-sync-error:focus-visible { outline:2px solid var(--wm-ink); outline-offset:2px; }
  /* Détails techniques : repli en texte seul ; ouvert, zone en creux de 160 px au plus, 12 px. */
  .cm-panel-item details.cm-tech { font-size:13px; line-height:1.4; color:var(--wm-ink-soft); }
  .cm-panel-item details.cm-tech[open] { flex-basis:100%; }
  .cm-panel-item details.cm-tech summary { display:inline-flex; align-items:center; gap:5px; min-height:24px; cursor:pointer; list-style:none; }
  .cm-panel-item details.cm-tech summary::-webkit-details-marker { display:none; }
  .cm-panel-item details.cm-tech .wm-ouvert, .cm-panel-item details.cm-tech[open] .wm-ferme { display:none; }
  .cm-panel-item details.cm-tech[open] .wm-ouvert { display:inline-block; }
  .cm-panel-item details.cm-tech pre { margin:6px 0 0; padding:8px 10px; background:var(--wm-surface-raised); border:0; border-radius:var(--wm-radius-champ);
    font-family:var(--wm-font-systeme); font-size:13px; line-height:1.5; white-space:pre-wrap; word-break:break-all; color:var(--wm-ink-soft); max-height:160px; overflow:auto; }
  /* Actions : cercles de 30 px empilés, 14 px d'écart (zones de 44 px sans chevauchement). */
  .cm-panel-item .cm-item-actions { flex:none; display:flex; flex-direction:column; align-items:center; gap:14px; }
  .cm-panel-item.cm-done .num { border-color:var(--wm-line); color:var(--wm-ink-soft); }
  .cm-panel-item.cm-done .txt { color:var(--wm-ink-soft); }
  /* Vignette de capture : 112 × 64 px, arrondi de 5 px ; au survol, la loupe dans un rond posé sur l'image. */
  .cm-ui .cm-vignette { position:relative; isolation:isolate; flex:none; display:block; width:112px; height:64px; margin:0; padding:0; border:0; border-radius:var(--wm-radius-champ); background:transparent; box-shadow:none; cursor:zoom-in; }
  .cm-panel-item .cm-vignette { margin-top:8px; }
  .cm-ui .cm-vignette-face { position:absolute; inset:0; display:block; overflow:hidden; border-radius:var(--wm-radius-champ); border:1px solid var(--wm-line-strong); background:var(--wm-surface-raised); }
  .cm-ui .cm-vignette img { display:block; width:100%; height:100%; max-width:none; margin:0; border:0; border-radius:0; object-fit:cover; background:none; }
  .cm-ui .cm-loupe { position:absolute; right:4px; bottom:4px; z-index:1; display:none; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:var(--wm-loupe-fond); color:var(--wm-encre-repere-claire); pointer-events:none; }
  .cm-ui .cm-vignette:hover .cm-loupe, .cm-ui .cm-vignette:focus-visible .cm-loupe { display:flex; }
  .cm-ui .cm-vignette:focus { outline:none; }
  .cm-ui .cm-vignette:focus-visible::after { content:''; position:absolute; left:-4px; top:-4px; right:-4px; bottom:-4px; z-index:2; background:none; border:2px solid var(--wm-ink); border-radius:calc(var(--wm-radius-champ) + 4px); pointer-events:none; }
  /* Capture en cours (fiche Etats) : zone en creux, CircleNotch centré, « capture… » à côté. */
  .cm-ui .cm-capture-en-cours { display:flex; align-items:center; gap:10px; margin-top:8px; font-size:13px; line-height:1.4; color:var(--wm-ink-soft); }
  .cm-ui .cm-capture-boite { flex:none; display:flex; align-items:center; justify-content:center; width:72px; height:42px; border-radius:var(--wm-radius-champ); background:var(--wm-surface-raised); border:1px solid var(--wm-line); color:var(--wm-ink-soft); }
  .cm-popup .cm-capture-boite { width:112px; height:64px; }
  /* Modification en place : champ arrondi (comme celui de la fenêtre), aide en dessous. */
  .cm-panel-item .cm-edit-bloc { margin-top:4px; }
  .cm-ui .cm-panel-item .wm-champ > textarea, .cm-ui .cm-feedback-box .wm-champ > textarea { display:block; width:100%; margin:0; resize:none; overflow-y:auto; border:1px solid var(--wm-line); border-radius:var(--wm-radius-champ);
    background:var(--wm-surface-raised); box-shadow:none; outline:none; letter-spacing:normal; text-transform:none; color:var(--wm-ink); }
  .cm-ui .cm-panel-item .wm-champ > textarea { min-height:48px; padding:9px 12px; font-family:var(--wm-font-systeme); font-size:15px; font-weight:400; line-height:1.45; }
  .cm-ui .cm-panel-item textarea.cm-inline-edit:not(.cm-inline-reply) { border-color:var(--wm-line-strong); }
  /* Modification en place (fiche Tiroir) : face du champ de la fenêtre (champ-fond), texte de la personne à 14 px comme la ligne. */
  .cm-ui .cm-panel-item .wm-champ > textarea.cm-inline-edit:not(.cm-inline-reply), .cm-ui .cm-panel-item .wm-champ > textarea.cm-inline-edit:not(.cm-inline-reply):focus { background:var(--wm-champ-fond); font-size:14px; }
  .cm-ui .cm-panel-item .wm-champ > textarea:focus, .cm-ui .cm-feedback-box .wm-champ > textarea:focus { border-color:var(--wm-line-strong); background:var(--wm-surface-raised); box-shadow:none; outline:none; }
  .cm-ui .cm-panel-item .wm-champ > textarea::placeholder, .cm-ui .cm-feedback-box .wm-champ > textarea::placeholder { font-family:var(--wm-font-systeme); font-size:13px; font-weight:400; line-height:1.5; color:var(--wm-ink-faint); opacity:1; }
  .cm-ui .cm-aide { display:flex; flex-wrap:wrap; align-items:center; gap:4px 5px; margin-top:6px; font-size:13px; line-height:1.4; color:var(--wm-ink-soft); }
  .cm-ui .cm-aide .wm-repere { margin:0; }
  /* Fil des messages : l'équipe en creux, toi en retrait de 16 px ; méta et messages en police système, messages entre « ». */
  .cm-panel-item .cm-thread { display:flex; flex-direction:column; gap:10px; margin-top:10px; }
  .cm-panel-item .cm-msg { font-size:13px; line-height:1.4; color:var(--wm-ink-soft); }
  .cm-panel-item .cm-msg-equipe, .cm-panel-item .cm-feedback { padding:8px 10px; border-radius:var(--wm-radius-champ); background:var(--wm-surface-raised); }
  .cm-panel-item .cm-msg-auteur, .cm-panel-item .cm-reply { margin-left:16px; }
  .cm-panel-item .cm-msg-who { display:block; font-size:13px; line-height:1.4; color:var(--wm-ink-soft); white-space:normal; }
  .cm-panel-item .cm-msg-who b { color:var(--wm-ink); font-weight:500; }
  .cm-panel-item .cm-msg-who .wm-icone { margin:0 5px 0 0; }
  .cm-panel-item .cm-msg-who .cm-sync-chip { vertical-align:baseline; margin-left:4px; }
  .cm-panel-item .cm-msg-who .cm-msg-drop { vertical-align:middle; }
  .cm-panel-item .cm-msg-texte { display:block; margin-top:3px; font-family:var(--wm-font-systeme); font-size:15px; font-weight:400; line-height:1.4; color:var(--wm-ink); white-space:pre-wrap; word-break:break-word; }
  .cm-panel-item .cm-msg-drop { margin-left:2px; }
  .cm-panel-item .cm-thread-actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:10px; margin-right:-42px; }
  /* -42 px : la rangée sous le fil passe sous la colonne des cercles (30 px + 12 px d'écart), pour que « ça ne convient pas ?
     rouvrir » garde ses marges intérieures à 380 et 375 px. En live, un retour envoyé n'a plus que son cercle du haut de ligne :
     rien ne se chevauche (relecture de Paula, lot 5). */
  .cm-ui .cm-panel-item .cm-thread-actions .wm-touche { font-size:13px; }   /* 13 px (minimum V2), comme les touches du rapport : « ça ne convient pas ? rouvrir » tient dans sa face à 380 px */
  /* Champ de réponse : libellé, champ, puis « annuler » à gauche et la touche secondaire à droite. */
  .cm-panel-item .cm-reponse-bloc { margin-top:10px; }
  .cm-panel-item .cm-reponse-libelle { display:flex; align-items:center; gap:5px; margin:0 0 6px; font-size:13px; line-height:1.4; color:var(--wm-ink-soft); }
  .cm-panel-item .cm-reponse-libelle .wm-icone { margin:0; }
  .cm-panel-item .cm-reponse-actions { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:8px; }
  .cm-ui .cm-panel-item .cm-reponse-actions .wm-texte { padding:0 6px 0 0; font-size:13px; }
  .cm-ui .cm-panel-item .cm-reponse-actions .wm-texte .wm-repere { margin-left:6px; }
  .cm-panel-item .cm-refus { display:flex; align-items:center; gap:6px; margin-top:6px; font-size:13px; line-height:1.4; color:var(--wm-ink); }
  .cm-panel-item .cm-refus[hidden] { display:none; }
  /* Phrases de la liste (état vide, tout terminé) et du nouveau ailleurs : 13 px, ink-soft, centrées. */
  .cm-panel-empty { padding:24px 16px; text-align:center; font-size:13px; line-height:1.5; color:var(--wm-ink-soft); }
  /* Encart « coller un retour » (fiche Rapport) : entre la liste et le pied. */
  .cm-feedback-box { flex:none; padding:12px 24px 14px 20px; border-top:1px solid var(--wm-line); border-bottom:1px solid var(--wm-line); }
  .cm-feedback-box[hidden] { display:none; }
  .cm-feedback-box .cm-feedback-title { display:flex; align-items:center; gap:6px; margin:0 0 8px; font-family:var(--wm-font-systeme); font-size:13px; font-weight:500; line-height:1.4; color:var(--wm-ink); }
  .cm-feedback-box .cm-feedback-title .wm-icone { margin:0; }
  .cm-ui .cm-feedback-box .wm-champ > textarea { min-height:76px; padding:8px 10px; font-family:var(--wm-font-systeme); font-size:13px; font-weight:400; line-height:1.5; }   /* fiche Rapport */
  .cm-feedback-box .cm-feedback-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-top:8px; }
  /* Pied : outils de la page et rapport (mode maquette, ou retour pas encore parti en live), puis « nouveau retour ». */
  .cm-panel-pied { flex:none; padding:12px 24px 22px 18px; border-top:1px solid var(--wm-line); }
  .cm-panel-pied.wm-outils-visibles { padding:10px 24px 22px 20px; }
  .cm-panel-foot { display:flex; flex-wrap:wrap; align-items:center; }
  .cm-panel-foot[hidden], .cm-panel-foot button[hidden], .cm-panel-foot label[hidden] { display:none; }
  .cm-panel-tools { gap:0 16px; }
  .cm-ui .cm-panel-tools .cm-outil { position:relative; display:inline-flex; align-items:center; gap:6px; height:32px; margin:0; padding:0; background:none; border:0; border-radius:var(--wm-radius-bouton); box-shadow:none;
    font-family:var(--wm-font-systeme); font-size:13px; font-weight:400; line-height:1; color:var(--wm-ink-soft); cursor:pointer; white-space:nowrap; text-transform:none; }
  .cm-ui .cm-panel-tools .cm-outil::before { content:''; position:absolute; left:0; right:0; top:-6px; bottom:-6px; }
  .cm-ui .cm-panel-tools .cm-outil:hover { color:var(--wm-ink); }
  .cm-ui .cm-panel-tools .cm-outil:focus { outline:none; }
  .cm-ui .cm-panel-tools .cm-outil:focus-visible { outline:2px solid var(--wm-ink); outline-offset:2px; }
  .cm-panel-report { gap:8px; margin-top:10px; padding-top:10px; border-top:1px solid var(--wm-line); }
  .cm-panel-report .cm-scope { position:relative; flex-basis:100%; display:flex; align-items:center; gap:6px; min-height:28px; font-size:13px; line-height:1.4; color:var(--wm-ink-soft); cursor:pointer; }
  .cm-panel-report .cm-scope input { position:absolute; left:0; top:50%; width:16px; height:16px; margin:-8px 0 0; padding:0; opacity:0; cursor:pointer; }
  .cm-panel-report .cm-scope input:focus-visible + .wm-case { outline:2px solid var(--wm-ink); outline-offset:2px; }
  .cm-panel-report .cm-scope .wm-case { pointer-events:none; }   /* la case dessinée laisse le clic à la vraie case */
  .cm-ui .cm-panel-report .wm-touche { font-size:13px; font-weight:400; }
  .cm-panel-new { flex-direction:column; align-items:stretch; }
  .cm-panel-pied.wm-outils-visibles .cm-panel-new { margin-top:14px; }
  .cm-ui .cm-new-btn { width:100%; justify-content:space-between; }
  .cm-panel-new .cm-new-aide { margin-top:8px; text-align:center; font-size:13px; line-height:1.4; color:var(--wm-ink-soft); }
  .cm-panel-new .cm-new-aide[hidden] { display:none; }
  .cm-panel-new .cm-new-aide .wm-repere { margin:0 1px; vertical-align:baseline; }

  /* Visionneuse (fiche Visionneuse) : fenêtre witmit centrée, sans voile ; le site reste visible autour.
     .cm-lightbox ne prend aucun clic (le clic à côté atteint la page, où il ferme la visionneuse). */
  .cm-lightbox { position:fixed; inset:0; z-index:990; display:flex; align-items:center; justify-content:center; padding:8px; pointer-events:none; background:none; }
  .cm-lightbox .cm-lightbox-fenetre { position:relative; display:flex; flex-direction:column; min-width:min(360px, calc(100vw - 16px)); max-width:min(92vw, calc(100vw - 16px)); max-height:86vh;
    pointer-events:auto; color:var(--wm-ink); font-family:var(--wm-font-systeme); font-size:13px; line-height:1.4; text-align:left; }
  .cm-lightbox .cm-lb-tete { position:relative; flex:none; padding:14px 14px 10px 22px; border-bottom:1px solid var(--wm-line); }
  .cm-lightbox .cm-lb-l1 { display:flex; align-items:center; gap:8px; margin:0 0 4px; }
  .cm-lightbox .cm-lb-titre { flex:1; min-width:0; font-family:var(--wm-font-systeme); font-size:15px; font-weight:600; line-height:1.3; color:var(--wm-ink); }
  .cm-lightbox .cm-lb-meta { font-size:13px; line-height:1.4; color:var(--wm-ink-soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .cm-lightbox .cm-lb-corps { position:relative; display:flex; flex-direction:column; min-height:0; padding:14px 24px 20px 20px; }
  .cm-lightbox .cm-lb-image { position:relative; isolation:isolate; display:flex; justify-content:center; min-height:0; }
  .cm-lightbox .cm-lb-face { position:relative; display:block; overflow:hidden; border-radius:var(--wm-radius-champ); border:1px solid var(--wm-line-strong); background:var(--wm-surface-raised); }
  .cm-lightbox img { display:block; max-width:100%; max-height:calc(86vh - 150px); width:auto; height:auto; margin:0; border:0; border-radius:0; object-fit:contain; }
  .cm-lightbox .cm-lightbox-hint { display:flex; align-items:center; gap:6px; margin-top:10px; font-size:13px; line-height:1.4; color:var(--wm-ink-soft); }
  .cm-lightbox .cm-lightbox-hint .wm-repere { margin:0; }
  /* Apparition en 160 ms portée par chaque couche de la fenêtre, jamais par un parent du verre (F9). */
  .cm-lightbox .cm-lightbox-fenetre > * { animation:wmApparait 160ms ease-out; }
  @keyframes wmApparait { from { opacity:0; } to { opacity:1; } }
  @media (prefers-reduced-motion:reduce) { .cm-lightbox .cm-lightbox-fenetre > *, .wm-tourne { animation:none; } }
  /* Message d'état (toast) : verre aux jetons (aspect intermédiaire ; fiche Etats au lot 7). */
  /* Message passager : petite fenêtre de verre sans coins witmit (fiche Etats). Le fondu de 200 ms porte
     sur chaque couche enfant, jamais sur .cm-status, qui contient le verre (F4, F9) ; visibility suit. */
  .cm-status { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:960; color:var(--wm-ink); font-family:var(--wm-font-systeme); font-size:13px; line-height:18px; min-height:40px; padding:11px 20px 11px 16px; pointer-events:none; width:max-content; max-width:min(420px, 90vw); white-space:normal; visibility:hidden; transition:visibility 0s linear 200ms; }
  .cm-status.show { visibility:visible; transition-delay:0s; }
  .cm-status > * { opacity:0; transition:opacity 200ms ease; }
  .cm-status.show > * { opacity:1; }
  .cm-status > .wm-contenu { position:relative; display:flex; align-items:flex-start; gap:8px; }
  .cm-status > .wm-contenu > svg.wm-icone { margin-top:1px; }
  @media (max-width:480px) { .cm-status { bottom:84px; } }   /* au-dessus du bouton witmit sur écran étroit (fiche Etats) */
  /* Entre 481 et 680 px, liste fermée, un message centré atteindrait les deux boutons du coin : il monte aussi à 84 px
     (fiche BoutonWitmit : les deux boutons restent toujours visibles). Liste ouverte : placerStatus(). */
  @media (min-width:481px) and (max-width:680px) { .cm-status { bottom:84px; } }
  @media (prefers-reduced-motion:reduce) { .cm-status, .cm-status > * { transition:none; } }
`;
  var HTML = `
<div class="cm-frame cm-ui" id="cmFrame"></div>

<div class="cm-pill cm-ui" id="cmPill" role="region" aria-label="witmit : mode annotation">
  <div class="wm-bandeau-corps">
    <span class="cm-drag-handle wm-poignee" title="glisse pour déplacer le bandeau">${icone('DotsSixVertical', 16)}</span>
    <span class="wm-bandeau-mode"><span class="wm-voyant" aria-hidden="true"></span>annotation</span>
    <span class="wm-filet" aria-hidden="true"></span>
    <span class="wm-gestes">${GESTES_HTML}</span>
    <button type="button" class="wm-touche wm-principale wm-petite wm-terminer" onclick="cmTerminer()" aria-keyshortcuts="Escape" title="terminer l'annotation · échap ou ${RACC_ANNOTER}">terminer<span class="wm-repere" aria-hidden="true">échap</span></button>
  </div>
</div>

<div class="cm-panel cm-ui" id="cmPanel" role="region" aria-label="witmit : tes retours sur cette page">
  <div class="cm-panel-head">
    <div class="cm-panel-head-row">
      <span class="cm-panel-titre">En marge de cette page</span>
      <span id="cmPanelCount" aria-label="0 retour sur cette page">0</span>
      <button type="button" class="wm-cercle cm-panel-fermer" onclick="cmTogglePanel(false)" aria-label="fermer" title="fermer">${icone('X', 14)}</button>
    </div>
    <div class="cm-panel-author" id="cmAuthor" hidden></div>
    <div class="cm-panel-sub" id="cmPanelSub"></div>
    <div class="cm-panel-ligne cm-panel-ailleurs" id="cmPanelAilleurs" hidden></div>
    <div class="cm-panel-filtres">
      <button type="button" class="cm-filtre cm-hide-done" role="checkbox" aria-checked="false" onclick="cmToggleHideDone()"><span class="wm-case" aria-hidden="true">${icone('Check', 12)}</span>masquer les terminés</button>
      <button type="button" class="cm-filtre cm-hide-widget" onclick="cmReveal(false)" id="cmHideBtn" title="cacher witmit sur ce site. pour le retrouver : ${RACC_DOUBLE_ALT}, ou ?witmit=on dans l'adresse" hidden>${icone('EyeSlash', 14)}masquer witmit${REPERE_DOUBLE_ALT}</button>
    </div>
  </div>
  <div class="cm-panel-list" id="cmList"></div>
  <div class="cm-feedback-box" id="cmFeedbackBox" hidden>
    <div class="cm-feedback-title">${icone('ClipboardText', 14)}coller un retour</div>
    <span class="wm-champ"><textarea aria-label="coller un retour" placeholder="witmit-retour R-…&#10;&lt;id&gt; pris_en_compte&#10;&lt;id&gt; resolu | ce qui a été fait&#10;&lt;id&gt; complement | question"></textarea></span>
    <div class="cm-feedback-actions"><button type="button" class="wm-texte" onclick="cmPasteFeedback(false)">annuler</button><button type="button" class="wm-touche wm-petite" onclick="cmApplyFeedback()">appliquer</button></div>
  </div>
  <div class="cm-panel-pied" id="cmPanelPied">
    <div class="cm-panel-foot cm-panel-tools" id="cmPanelTools">
      <button type="button" class="cm-outil" onclick="cmClearAll()" id="cmClearPageBtn">${icone('Trash', 14)}effacer (page)</button>
      <button type="button" class="cm-outil" onclick="cmClearSite()" id="cmClearSiteBtn">${icone('Broom', 14)}vider tout (site)</button>
      <button type="button" class="cm-outil" onclick="cmPasteFeedback()" id="cmPasteBtn">${icone('ClipboardText', 14)}coller un retour</button>
    </div>
    <div class="cm-panel-foot cm-panel-report" id="cmReportFoot">
      <label class="cm-scope" title="sans cette case : seulement les nouveautés (nouveaux retours et réponses aux compléments)"><input type="checkbox" id="cmFullReport"><span class="wm-case" aria-hidden="true">${icone('Check', 12)}</span>rapport complet</label>
      <button type="button" class="wm-touche wm-petite" onclick="cmExport()">${icone('DownloadSimple', 14)}télécharger</button>
      <button type="button" class="wm-touche wm-petite" onclick="cmCopy()">${icone('Copy', 14)}copier</button>
      <button type="button" class="wm-touche wm-petite" onclick="cmSendMail()">${icone('EnvelopeSimple', 14)}envoyer par email</button>
    </div>
    <div class="cm-panel-foot cm-panel-new">
      <button type="button" class="wm-touche wm-principale cm-new-btn" onclick="cmNouveauRetour()" id="cmNewBtn" aria-keyshortcuts="N" title="nouveau retour : N, ou ${RACC_ANNOTER} de n'importe où sur la page">nouveau retour<span class="wm-repere" aria-hidden="true">N</span></button>
      <div class="cm-new-aide" id="cmNewAide" hidden>ou ${REPERE_ANNOTER}, de n'importe où sur la page.</div>
    </div>
  </div>
</div>

<div class="cm-status cm-ui" id="cmStatus" role="status" aria-live="polite" aria-atomic="true"></div>
`;
  /* Signe du bouton witmit : le logo B1 calé à 28 px (fiche Identity, décision de François du 25/10/2026),
     tracé au pixel entier, repris tel quel de la fiche BoutonWitmit. Couleur du bouton (currentColor) : blanc cassé
     sur métal sombre, encre sur métal clair. Jamais agrandi ni réduit : il perdrait son calage. */
  var SIGNE_WITMIT = '<svg class="wm-logo" data-logo="B1" viewBox="0 0 28 28" width="28" height="28" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' +
    '<path d="M0,1 L9,1 L9,4 L3,4 L3,10 L0,10 Z M5,6 L9,6 L9,18 L12,18 L12,11 L16,11 L16,18 L19,18 L19,6 L20,6 L23,9 L23,22 L8,22 L5,19 Z M28,27 L19,27 L19,24 L25,24 L25,18 L28,18 Z"/></svg>';
  var BUTTONS_HTML = `
<button type="button" class="wm-bouton wm-bouton-mode cm-ui" onclick="cmToggle()" id="cmToggleBtn" aria-pressed="false" aria-label="mode annotation" aria-keyshortcuts="Alt+A">${icone('CrosshairSimple', 20)}</button>
<button type="button" class="wm-bouton wm-bouton-witmit cm-ui" onclick="cmTogglePanel()" id="cmPanelBtn" aria-expanded="false" aria-controls="cmPanel" aria-label="witmit"><span class="wm-signe">${SIGNE_WITMIT}</span><span class="cm-count-badge" id="cmCount" data-zero="1" aria-hidden="true"></span></button>
`;

  /* ---------- habillage des fenêtres (F2, F3) ----------
     habiller(el) pose en premiers enfants de el trois couches muettes (aria-hidden, sans clic) : l'ombre,
     le verre (qui porte aussi le bord) et le contour (les deux coins witmit ; vide, sansCoins, pour les
     messages passagers).
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
    var W = el.offsetWidth, H = el.offsetHeight;
    if (!W || !H) return;                                           // caché : retracé quand il apparaît
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    // Coins witmit (haut gauche, bas droit) : bras de 8,4 px depuis un coude posé à 8,4 px des bords, coude
    // arrondi en quart de cercle de 3 px (radius-coude ; même géométrie que la maquette V2). Le bord de la
    // fenêtre est porté par le verre (border-radius et box-shadow) : plus de contour tracé ici.
    var coins = svg.querySelectorAll('path');
    if (coins.length === 2) {
      coins[0].setAttribute('d', coinWitmit(8.4, 16.8, 8.4, 16.8));
      coins[1].setAttribute('d', coinWitmit(W - 8.4, H - 16.8, H - 8.4, W - 16.8));
    }
  }
  // Un coin witmit de (x, y1) à (x2, y2) par un coude en (x, y2), arrondi de 3 px. Coordonnées arrondies au
  // centième (pas de 331.59999999 dans le tracé).
  function coinWitmit(x, y1, y2, x2) {
    var r = 3, sy = y2 > y1 ? 1 : -1, sx = x2 > x ? 1 : -1, n = function (v) { return +v.toFixed(2); };
    return 'M' + n(x) + ' ' + n(y1) + 'V' + n(y2 - sy * r) + 'Q' + n(x) + ' ' + n(y2) + ' ' + n(x + sx * r) + ' ' + n(y2) + 'H' + n(x2);
  }
  function habiller(el, sansCoins) {
    if (!el || el.querySelector(':scope > .wm-verre')) return el;
    el.classList.add('wm-habille');
    el.insertAdjacentHTML('afterbegin',
      '<span class="wm-ombre" aria-hidden="true"><i></i></span><span class="wm-verre" aria-hidden="true"></span>' +
      '<svg class="wm-contour" aria-hidden="true" focusable="false">' + (sansCoins ? '' : '<path d=""></path><path d=""></path>') + '</svg>');
    habilles.push(el);
    if (el.isConnected) tracerContour(el);                         // sinon : tracé par l'observateur à l'insertion
    if (formeObs) formeObs.observe(el);
    return el;
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { habilles.slice().forEach(tracerContour); });
  // Réservé aux pages de test du dépôt (planche de la charte) : dessiner les touches et les icônes avec le vrai
  // code. Ce n'est pas une interface publique : elle peut changer sans prévenir.
  window.witmit._planche = { icone: icone, habiller: habiller, icones: Object.keys(ICONES), signe: SIGNE_WITMIT };

  /* Le widget injecte lui-même son style et son interface — la page hôte n'a rien à copier. */
  function injectUI() {
    var style = document.createElement('style');
    style.id = 'cmStyles';
    style.textContent = CSS;
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
    } else {
      // Boutons fournis par la page (C8) : adoptés tels quels, contenu compris ; seuls leurs attributs
      // d'état et leur nom accessible sont posés par witmit (majBoutons).
      ['cmToggleBtn', 'cmPanelBtn'].forEach(function (id) {
        var b = document.getElementById(id);
        if (b) b.setAttribute('data-wm-fourni', 'page');
      });
      var pb = document.getElementById('cmPanelBtn');
      if (pb) pb.setAttribute('aria-controls', 'cmPanel');
      var tb = document.getElementById('cmToggleBtn');
      if (tb) { tb.setAttribute('aria-label', 'mode annotation'); tb.setAttribute('aria-keyshortcuts', 'Alt+A'); }
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
  /* Modalité du focus (fiche Etats, « seulement au clavier ») : drapeau data-wm-clavier sur <body>, posé par une
     touche de déplacement (Tab ; flèches, début, fin, pages hors d'un champ de saisie, où elles déplacent le
     curseur) et retiré au premier appui du pointeur. Il ne sert qu'à l'anneau de focus des champs de witmit. */
  (function modaliteFocus() {
    var DEPLACEMENT = /^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown)$/;
    document.addEventListener('keydown', function (e) {
      var t = e.target, champ = t && t.nodeType === 1 && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (e.key === 'Tab' || (DEPLACEMENT.test(e.key) && !champ)) document.body.setAttribute('data-wm-clavier', '');
    }, true);
    document.addEventListener('pointerdown', function () { document.body.removeAttribute('data-wm-clavier'); }, true);
  })();
  renderAuthor();
  initTheme();

  /* ---------- thème : witmit prend le thème du site (V2) ----------
     On lit le premier fond opaque de <body>, puis de <html> ; luminance sous 128 = site sombre → titane
     sombre (« client-sombre ») ; sinon titane clair (« client-clair »). Sans fond opaque, on suit
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
    var t = hostIsDark() ? 'client-sombre' : 'client-clair';
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
     Révélé par le raccourci (⌥ deux fois / alt deux fois) ou par ?witmit=on dans l'URL, mémorisé dans le navigateur
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
    var hideBtn = document.getElementById('cmHideBtn');
    if (hideBtn) hideBtn.hidden = !LIVE;
  }
  /* Montrer (⌥ deux fois, ?witmit=on) : seuls les deux boutons apparaissent — liste fermée, mode éteint, aucune
     fenêtre (K1). Cacher (⌥ deux fois, « masquer witmit ») : tout se ferme et s'oublie, après un message qui dit
     comment revenir ; ce message reste lisible malgré le masquage (Léa 45). */
  window.cmReveal = function (on) {
    if (!LIVE) return;
    on = on !== false;
    try { if (on) localStorage.setItem(REVEAL_KEY, '1'); else localStorage.removeItem(REVEAL_KEY); } catch (e) {}
    closePopup(true); cmToggle(false); cmTogglePanel(false);
    if (!on) cmStatus('witmit est masqué. pour le retrouver : ' + RACC_DOUBLE_ALT + ", ou ?witmit=on dans l'adresse.", { masquage: true, duree: 6000 });   // 6 s, comme un échec (Léa)
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
          if (!r.ok) { var err = new Error(data.erreur || ('erreur ' + r.status)); err.status = r.status; throw err; }
          return data;
        });
      });
  }
  function sendComment(c) { return postGuichet('', payloadFor(c)); }
  /* Raisons d'échec en clair (Léa 3.11) et renvoi (décision E1 de Tom). Entrée : l'erreur reçue, ou ce qui en
     est gardé sur le retour ({ status, message }) ; message = true pour un message du fil (réponse, réouverture).
     Sortie : { raison, suite, renvoi, toast }. Plus de renvoi automatique après 409 et 413, sur le dépôt comme
     sur la réponse ; une réponse ou une réouverture en 500 n'est jamais renvoyée (elle a pu être publiée sur
     GitHub : un renvoi ferait un doublon) ; un dépôt en 500, un 429, une coupure réseau repartent. */
  function raisonEchec(err, message) {
    var st = err && err.status, brut = String((err && (err.message || err.error)) || '');
    var ton = message ? 'ton message' : 'ton retour';
    function r(raison, suite, renvoi) { return { raison: raison, suite: suite, renvoi: renvoi, toast: 'envoi impossible : ' + raison + '.' + (suite ? ' ' + suite : '') }; }
    if (!st && (/failed to fetch|networkerror|load failed|network|internet/i.test(brut) || navigator.onLine === false)) return r('pas de connexion', ton + ' est gardé ici et repartira tout seul.', true);
    if (st === 429 && /par jour/.test(brut)) return r('5 messages par jour au plus sur un même retour', 'ton message est gardé ici ; réessaie demain.', true);
    if (st === 429) return r("trop d'envois d'un coup", ton + ' est gardé ici ; réessaie dans quelques minutes.', true);
    if (st === 502 && message) return r("l'équipe ne peut pas recevoir de message pour l'instant", 'ton message est gardé ici et repartira tout seul.', true);
    if (st === 409 && /pris en charge/.test(brut)) return r("l'équipe l'a déjà pris en compte", "ta modification ne partira pas ; dis-la à l'équipe avec « répondre » quand elle t'aura écrit.", false);
    if (st === 413 && /capture/.test(brut)) return r('la capture de la zone est trop lourde', 'il ne repartira pas tel quel : ouvre le retour et réduis le cadre, il repartira avec une capture plus légère.', false);
    if (st === 413 && message && /message trop long/.test(brut)) return r('ton message dépasse 2\u00a0000 caractères', 'il ne repartira pas : abandonne-le (×) et écris-en un plus court.', false);
    if (st === 413 && /texte trop long/.test(brut)) return r('ton retour dépasse 5\u00a0000 caractères', "il ne repartira pas tel quel : raccourcis-le, il repartira dès que tu l'auras modifié.", false);
    if (st === 409 && message && /rouvert/.test(brut)) return r("ce retour n'est pas terminé", 'ton message ne repartira pas : abandonne-le (×) et écris-le avec « répondre ».', false);
    if (st === 409 && message && /suivi/.test(brut)) return r("ce retour n'a pas de suivi par l'équipe", "impossible d'y répondre ici : abandonne ce message (×).", false);
    if (st === 500 && message && /publié/.test(brut)) {
      var arrive = "ton message est bien arrivé à l'équipe, mais witmit n'a pas pu le garder dans ce fil. il ne sera pas renvoyé : × le retire d'ici.";
      return { raison: arrive.replace(/\.$/, ''), suite: '', renvoi: false, toast: arrive, arrive: true };
    }
    if (st === 500 && message) return r('witmit ne sait pas si ton message est parti', "il ne sera pas renvoyé, pour éviter un doublon : × le retire d'ici ; réécris-le plus tard si l'équipe ne t'a pas répondu.", false);
    // Autre 409 ou 413 (identifiant déjà pris, bloc technique trop gros…) : refusé, pas de renvoi (E1 ; Léa 3.11 complétée).
    if (st === 409 || st === 413) return message
      ? r('witmit a refusé ce message', 'il ne repartira pas : abandonne-le (×).', false)
      : r('witmit a refusé ce retour', 'il ne repartira pas : efface-le et écris-en un nouveau.', false);
    return r('le service witmit ne répond pas', ton + ' est gardé ici et repartira tout seul.', true);
  }
  // Ce que garde un retour ou un message refusé : la raison brute (console et diagnostic), le code, le renvoi permis.
  function noterEchec(err, message) {
    var e = raisonEchec(err, message);
    console.warn('witmit : envoi impossible —', (err && err.status) || 'réseau', (err && err.message) || err);   // la raison brute, jamais à l'écran (Léa 3.11)
    return { sync: { state: 'error', error: (err && err.message) || 'erreur', status: (err && err.status) || undefined, renvoi: e.renvoi, at: new Date().toISOString() }, echec: e };
  }
  function renvoiPermis(sync) { return !(sync && sync.state === 'error' && sync.renvoi === false); }
  // Info-bulle de « à renvoyer » (Léa 3.5) : la raison en clair ; « clique pour réessayer » seulement si le renvoi est permis.
  // Marque sans renvoi : ce n'est pas un bouton, son info-bulle n'est atteinte ni au clavier ni par un lecteur d'écran ;
  // la raison y est donc aussi écrite pour eux seuls (décision 22 de Léa).
  function raisonLue(sync, message) {
    return '<span class="wm-lu"> : ' + cmEsc(raisonEchec({ status: sync.status, message: sync.error }, message).raison) + '.</span>';
  }
  function titreARenvoyer(sync, message) {
    var e = raisonEchec({ status: sync.status, message: sync.error }, message);
    return e.raison + (e.renvoi ? '. clique pour réessayer.' : '.');
  }
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
        poserRecu(live);                                       // C9 : reçu par witmit, une fois pour toutes
        cmStatus("retour envoyé à l'équipe.", { type: 'fait' });
      }).catch(function (err) {
        var n = noterEchec(err, false);
        live.sync = n.sync;
        if (err && err.status === 409 && /pris en charge/.test(err.message || '')) poserRecu(live);   // « déjà pris en charge » : le retour est chez le guichet (C9)
        cmStatus(n.echec.toast, { type: 'echec' });
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
        if (data.avertissement) cmStatus("message envoyé à l'équipe, mais le retour n'a pas pu être rouvert. réessaie « rouvrir » plus tard.", { type: 'echec' });
        else cmStatus(data.rouvert ? "retour rouvert, l'équipe est prévenue." : "réponse envoyée à l'équipe.", { type: 'fait' });
      }).catch(function (err) {
        var n = noterEchec(err, true);
        lr.sync = n.sync;
        // « bien arrivé, mais pas gardé dans le fil » n'est pas un échec pour l'auteur : pas d'icône d'échec, mais 6 s pour le lire.
        cmStatus(n.echec.toast, n.echec.arrive ? { duree: 6000 } : { type: 'echec' });
      }).then(function () { persist(); renderList(); renderMarkers(); });
    });
  }
  window.cmRetryReply = function (id, rid) { var c = findComment(id), r = c && findReply(c, rid); if (r && renvoiPermis(r.sync)) { r.sync = null; scheduleReply(c, r); } };
  window.cmDropReply = function (id, rid) {
    var c = findComment(id), r = c && findReply(c, rid);
    // Message en erreur 500 (réponse ou réouverture) : il a pu arriver à l'équipe et ne sera jamais renvoyé ; « × » le
    // retire seulement d'ici (Léa 3.9 complétée au lot 8). Les autres gardent « il n'est pas parti ».
    var en500 = r && r.sync && r.sync.state === 'error' && r.sync.status === 500;
    if (!r || (r.sync && r.sync.state === 'pending') || !confirm(en500 ? "retirer ce message d'ici ? il ne sera pas renvoyé." : "abandonner ce message ? il n'est pas parti et sera effacé.")) return;
    c.replies = c.replies.filter(function (x) { return x !== r; });
    persist(); renderList();
    cmStatus('message abandonné.', { type: 'fait' });
  };
  // Renvoie tout ce qui n'est pas parti (hors ligne, quota, erreur) — à l'ouverture du tiroir, au chargement et au
  // retour de la connexion ; jamais ce qu'un refus définitif retient (E1 : 409, 413, réponse en 500).
  function flushPending() {
    if (!SYNC) return;
    allComments.forEach(function (c) {
      (c.replies || []).forEach(function (r) {
        if (!r.sync || (r.sync.state === 'error' && renvoiPermis(r.sync))) scheduleReply(c, r);
        else if (r.sync.state === 'pending' && Date.now() - Date.parse(r.sync.at) > 120000) { r.sync = null; scheduleReply(c, r); }
      });
      if (!isEditable(c)) return;
      if (!c.sync || (c.sync.state === 'error' && renvoiPermis(c.sync))) scheduleSync(c);
      else if (c.sync.state === 'pending' && Date.now() - Date.parse(c.sync.at) > 120000) { c.sync = null; scheduleSync(c); } // envoi interrompu (page fermée)
    });
  }
  // Le statut vu du serveur : nouveau → (rien) ; en_cours → « pris en compte » ; resolu → « résolu » ; repondu (issue
  // fermée « non prévue ») → terminé aussi, affiché « répondu » (c.repondu) ; avec le fil des messages (équipe / toi).
  // Un ticket terminé par le serveur puis rouvert (depuis witmit ou GitHub) redevient « pris en compte ».
  function refreshStatuses() {
    var premiere = vusAuChargement; vusAuChargement = false;   // C5 : la première relecture de la 0.2.0 n'allume rien
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
        poserRecu(c);                                          // le serveur le connaît : reçu (C9)
        // Voyant (C5) : l'équipe a changé le statut, écrit un message de retour ou un nouveau message du fil.
        var nbEquipe = function (fil) { return (fil || []).filter(function (m) { return m.de === 'equipe'; }).length; };
        var equipe = c.sync.statut !== row.statut || (row.message_retour || '') !== (c.feedbackMessage || '') || (thread && nbEquipe(thread) > nbEquipe(c.thread));
        if (equipe && !premiere) equipeAAgi(c);
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
    // En live (C9) : « effacer (page) » et « vider tout (site) » seulement s'il reste un retour supprimable.
    var effacer = document.getElementById('cmClearPageBtn'), vider = document.getElementById('cmClearSiteBtn');
    if (effacer) effacer.hidden = !pageComments().length || (LIVE && !pageComments().some(supprimable));   // rien sur la page : rien à effacer
    if (vider) vider.hidden = LIVE && !allComments.some(supprimable);
    var outils = document.getElementById('cmPanelTools');
    var outilsVus = outils && [effacer, vider, paste].some(function (b) { return b && !b.hidden; });
    if (outils) outils.hidden = !outilsVus;
    var pied = document.getElementById('cmPanelPied');
    if (pied) pied.classList.toggle('wm-outils-visibles', !!(outilsVus || (foot && !foot.hidden)));
  }

  // Marques d'envoi (Léa 2.3 et 3.5) : une icône et un mot en gras ; « à renvoyer » est le bouton du nouvel essai.
  function syncChip(c) {
    if (!SYNC || !c.sync) return SYNC && isEditable(c) ? '<span class="cm-sync-chip" title="pas encore parti : il partira tout seul">' + icone('CloudArrowUp', 14) + '<b>à envoyer</b></span>' : '';
    if (c.sync.state === 'sent') return '<span class="cm-sync-chip cm-sync-sent" title="reçu par witmit le ' + cmEsc(frDate(c.sync.at)) + '">' + icone('CloudCheck', 14) + '<b>envoyé</b></span>';
    if (c.sync.state === 'pending') return '<span class="cm-sync-chip" title="envoi en cours">' + icone('CircleNotch', 14, 'wm-tourne') + '<b>envoi en cours…</b></span>';
    // Refus définitif (E1) : la marque reste, mais ce n'est plus un bouton ; le retour repart quand on le modifie.
    if (!renvoiPermis(c.sync)) return '<span class="cm-sync-chip cm-sync-error wm-sans-renvoi" title="' + cmEsc(titreARenvoyer(c.sync, false)) + '">' + icone('WarningCircle', 14, 'wm-signal') + '<b>à renvoyer</b>' + raisonLue(c.sync, false) + '</span>';
    return '<button type="button" class="cm-sync-chip cm-sync-error" onmousedown="event.stopPropagation()" onclick="cmRetrySync(\'' + c.id + '\')" title="' + cmEsc(titreARenvoyer(c.sync, false)) + '">' + icone('WarningCircle', 14, 'wm-signal') + '<b>à renvoyer</b></button>';
  }
  window.cmRetrySync = function (id) { var c = findComment(id); if (c && renvoiPermis(c.sync)) { c.sync = null; scheduleSync(c); } };
  // Au retour de la connexion, ce qui attendait repart (E1).
  window.addEventListener('online', function () { flushPending(); });

  var DRAG_THRESHOLD = 10; // px avant de considérer que c'est un glisser plutôt qu'un clic
  var CLICK_DELAY = 250;   // ms d'attente d'un éventuel double-clic avant d'ouvrir la bulle du clic simple

  var allComments = [];    // TOUTES les pages
  var vusAuChargement = false;   // premier chargement de la 0.2.0 : la première relecture des statuts n'allume rien (C5)
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
    return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');   // sûr aussi dans un attribut
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
    // Premier chargement de la 0.2.0 (C5) : tout l'existant compte comme vu, y compris ce que la première relecture
    // des statuts va rapporter de l'équipe ; ensuite, seul ce qui arrive après allume le voyant.
    var VU_KEY = 'witmit_' + CONFIG.project + '_vu_0_2', aEcrire = false;
    try {
      if (!localStorage.getItem(VU_KEY)) {
        var maintenant = new Date().toISOString();
        allComments.forEach(function (c) { if (!c.vuLe) c.vuLe = maintenant; });
        vusAuChargement = aEcrire = allComments.length > 0;
        localStorage.setItem(VU_KEY, '1');
      }
    } catch (e) {}
    if (marquerRecusConnus() || aEcrire) persist();          // C9 : retours qui portent une trace du guichet
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

  /* ---------- dessin des repères (fiches Reperes, Epingle, Selection ; F6, F7, F10, T7) ---------- */
  var MARGE_CADRE = 16;      // cadre d'un élément visé : 16 px autour de l'élément (une zone encadrée : aucune)
  var COTE_MIN_TRAIT = 56;   // un côté du cadre plus court n'a pas de trait : il ne reste que les deux coins
  // Le fond derrière le repère d'un élément est celui de son parent (le cadre et l'épingle sont posés autour de
  // l'élément, pas dessus) ; derrière une zone encadrée, celui du conteneur qu'elle couvre.
  function fondSombreAutour(el) { return isDarkBehind((el && el.parentElement) || document.body); }
  function fondSombreSous(el) { return isDarkBehind(el || document.body); }
  // Épingle : le fond juste sous son centre, quand il est à l'écran (une épingle posée 22 px au-dessus d'un élément
  // peut sortir du bloc sombre qui le contient) ; sinon, comme son cadre.
  function fondSombreEpingle(pt, h, secours) {
    var cx = pt.x + (pt.texte ? h / 2 : -h / 2) - window.scrollX, cy = pt.y + (pt.dessous ? h / 2 : -h / 2) - window.scrollY;
    if (cx >= 0 && cy >= 0 && cx < window.innerWidth && cy < window.innerHeight) {
      var sous = pageElementAt(cx, cy);
      if (sous) return isDarkBehind(sous);
    }
    return secours;
  }
  // Taille du cadre (dessiné par son enfant .wm-cadre) et traits retirés sur un côté trop court.
  function dimensionnerCadre(box, x, y, w, h) {
    w = Math.max(w, 4); h = Math.max(h, 4);
    box.style.left = x + 'px'; box.style.top = y + 'px';
    box.style.width = w + 'px'; box.style.height = h + 'px';
    var m = (box.classList.contains('cm-box-outline') || box.classList.contains('cm-box-editing')) ? 2 * MARGE_CADRE : 0;
    box.classList.toggle('wm-court-h', w + m < COTE_MIN_TRAIT);
    box.classList.toggle('wm-court-v', h + m < COTE_MIN_TRAIT);
    box.classList.toggle('wm-prise-large', w > 88 && h > 88);   // poignées : prise de 44 px au-delà de 88 px
  }
  function assurerCadre(box) {
    if (box.querySelector(':scope > .wm-cadre')) return;
    var c = document.createElement('i');
    c.className = 'wm-cadre'; c.setAttribute('aria-hidden', 'true');
    box.insertBefore(c, box.firstChild);
  }
  /* Dessine un cadre (encadré enregistré, ou cadre de l'élément visé par une épingle) */
  function drawSavedBox(x, y, w, h, extraClass, id, sombre) {
    var box = document.createElement('div');
    box.className = 'cm-box cm-box-saved cm-ui ' + (extraClass || '') + (sombre ? ' wm-sur-sombre' : '');
    box.dataset.id = id;
    assurerCadre(box);
    dimensionnerCadre(box, x, y, w, h);
    document.body.appendChild(box);
  }
  /* Place de l'épingle (F6) : point = son coin bas droit, aligné sur le bord droit du cadre et 6 px au-dessus
     de lui ; sans place au-dessus (haut de la page), son coin haut droit 6 px sous le cadre. marge : 16 px pour
     un élément visé, 0 pour une zone encadrée. */
  function placeEpingle(r, marge, hauteur) {
    var droite = r.x + r.w + marge, haut = r.y - marge - 6;
    if (haut - hauteur < 0) return { x: droite, y: r.y + r.h + marge + 6, dessous: true };
    return { x: droite, y: haut, dessous: false };
  }
  function rectPage(el) {
    var b = el.getBoundingClientRect();
    return { x: b.left + window.scrollX, y: b.top + window.scrollY, w: b.width, h: b.height };
  }
  // Coins witmit du passage : sur le début du premier morceau et la fin du dernier ; une seule encre.
  function marquerPassage(marks, sombre) {
    (marks || []).forEach(function (m, k) {
      m.classList.toggle('wm-debut', k === 0);
      m.classList.toggle('wm-fin', k === marks.length - 1);
      m.classList.toggle('wm-sur-sombre', !!sombre);
    });
  }
  // Nom accessible de l'épingle (Léa 3.1) : « retour 3, {statut} », plus « , nouveau » si le voyant est allumé.
  function nomEpingle(c, n) {
    var parts = ['retour ' + n], st = statusLabel(c);
    if (st) parts.push(st);
    if (aDuNouveau(c)) parts.push('nouveau');
    return parts.join(', ');
  }
  /* Onde : un contour de 1 px qui part du bord du repère, s'écarte de 16 px et s'efface (2 × 600 ms). */
  function lancerOnde(el) {
    if (!el || !el.isConnected) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var r = rectPage(el), m = el.classList.contains('cm-box-outline') ? MARGE_CADRE : 0;
    var o = document.createElement('div');
    o.className = 'wm-onde cm-ui' + (el.classList.contains('wm-sur-sombre') ? ' wm-sur-sombre' : '');
    o.setAttribute('aria-hidden', 'true');
    o.style.left = (r.x - m) + 'px'; o.style.top = (r.y - m) + 'px';
    o.style.width = (r.w + 2 * m) + 'px'; o.style.height = (r.h + 2 * m) + 'px';
    document.body.appendChild(o);
    setTimeout(function () { o.remove(); }, 1300);
  }

  function renderMarkers() {
    // L'épingle qui a le focus (rendu par Échap, ou atteinte au clavier) le retrouve après le redessin, qui
    // recrée toutes les épingles (sans quoi le focus tombe sur la page).
    var actif = document.activeElement;
    var focusPin = actif && actif.classList && actif.classList.contains('cm-pin') && !actif.classList.contains('cm-pin-secondary') ? actif.dataset.id : null;
    // Un encadré en cours d'ajustement (poignées visibles) est conservé tel quel : le redessiner ferait
    // "lâcher" la souris en plein glisser.
    var old = document.querySelectorAll('.cm-pin, .cm-box.cm-box-saved:not(.cm-box-editable), #cmLinks');
    for (var i = 0; i < old.length; i++) old[i].remove();
    // Les passages marqués survivent au redessin : leurs états (actif, traité) sont recalculés plus bas.
    Object.keys(sessionMarks).forEach(function (id) { (sessionMarks[id] || []).forEach(function (m) { m.classList.remove('cm-focus', 'cm-done'); }); });
    pageComments().forEach(function (c, i) {
      if (hideDone() && isDone(c)) return;
      var anchorEl = null;
      // Sélection multiple : on ne garde que les cibles actuellement visibles ; l'épingle principale va sur la première.
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
      var boxGeom = null, sombre = false;
      if (c.type === 'box') {
        boxGeom = computeAbsoluteBox(c.anchor, c.fallback);
        sombre = fondSombreSous(anchorEl);
        if (!document.querySelector('.cm-box-editable[data-id="' + c.id + '"]')) drawSavedBox(boxGeom.x, boxGeom.y, boxGeom.w, boxGeom.h, '', c.id, sombre);
      }
      if (c.type === 'pin' && anchorEl) {
        // Cadre persistant autour de chaque objet visé (16 px de marge) : l'épingle seule "flotterait".
        (multi || [anchorEl]).forEach(function (el) {
          var ar = rectPage(el);
          drawSavedBox(ar.x, ar.y, ar.w, ar.h, 'cm-box-outline', c.id, fondSombreAutour(el));
        });
        sombre = fondSombreAutour(anchorEl);
      }
      if (c.type === 'text' && !(sessionMarks[c.id] && sessionMarks[c.id].length)) {
        // Après un rechargement, le passage n'est plus marqué : on retrouve le passage cité et on le marque de nouveau.
        var quote = c.quote || ((c.zone || '').indexOf('…') < 0 ? (c.zone || '').replace(/^«\s*|\s*»$/g, '') : '');
        var range = quote ? findTextRange(anchorEl || document.body, quote) : null;
        if (range) sessionMarks[c.id] = highlightRange(range);
      }
      if (c.type === 'text' && sessionMarks[c.id] && sessionMarks[c.id].length) {
        sombre = fondSombreAutour(sessionMarks[c.id][0]);
        marquerPassage(sessionMarks[c.id], sombre);
      }
      /* Ouvre la bulle d'édition de ce commentaire (toutes les épingles du groupe y mènent) */
      function openEditor(e) {
        e.stopPropagation();
        var outlineTarget = (c.type !== 'box' && c.anchor && c.anchor.path) ? resolveStablePath(c.anchor.path) : null;
        var editPt = computeAbsolutePoint(c.anchor, c.fallback);
        var editMeta = { type: c.type, existing: c, outlineEl: outlineTarget };
        if (multi) {
          editMeta.targets = [];
          c.targets.forEach(function (t) { var el = resolveStablePath(t.path); if (el) editMeta.targets.push({ el: el, label: t.label }); });
          editMeta.outlineEl = editMeta.targets.map(function (t) { return t.el; });
          editPt = cornerAnchorPoint(multi[0], editPt.x, editPt.y);
        }
        if (c.type === 'text' && sessionMarks[c.id]) { editMeta.marks = sessionMarks[c.id]; editMeta.outlineEl = null; }
        if (c.type === 'box') {
          editMeta.boxEl = document.querySelector('.cm-box-saved[data-id="' + c.id + '"]');
          editMeta.box = computeAbsoluteBox(c.anchor, c.fallback);
          editPt = { x: editMeta.box.x, y: editMeta.box.y + editMeta.box.h }; // sous l'encadré, pour laisser ses poignées accessibles
        }
        openPopup(editPt.x, editPt.y, c.zone, editMeta);
        epingleOuvreuse = c.id;   // Échap rendra le focus à cette épingle
      }
      function poserEpingle(pt, secondaire, sombrePin) {
        var p = document.createElement('div');
        p.className = 'cm-pin cm-ui' + (secondaire ? ' cm-pin-secondary' : '') + (sombrePin ? ' wm-sur-sombre' : '') + (pt.dessous ? ' wm-dessous' : '') + (pt.texte ? ' wm-pin-texte' : '');
        p.dataset.id = c.id;
        p.style.left = pt.x + 'px'; p.style.top = pt.y + 'px';
        p.innerHTML = '<span>' + (i + 1) + '</span>' + (!secondaire && aDuNouveau(c) ? '<i class="wm-voyant-epingle" aria-hidden="true"></i>' : '');
        p.title = c.text;
        p.setAttribute('role', 'button');
        p.setAttribute('aria-label', nomEpingle(c, i + 1));
        p.tabIndex = secondaire ? -1 : 0;   // une seule épingle par retour dans l'ordre du clavier
        if (secondaire) p.setAttribute('aria-hidden', 'true');   // annoncée une seule fois, par l'épingle principale
        p.onclick = openEditor;
        p.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditor(e); } };
        document.body.appendChild(p);
        return p;
      }
      function centre(el) { var r = rectPage(el); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }

      var pt, H = 24;
      if (multi || (c.type === 'pin' && anchorEl)) {
        pt = placeEpingle(rectPage(anchorEl), MARGE_CADRE, H);
      } else if (boxGeom) {
        pt = placeEpingle(boxGeom, 0, H);                               // coin haut droit de la zone encadrée
      } else if (c.type === 'text' && sessionMarks[c.id] && sessionMarks[c.id].length) {
        // Début du passage, au-dessus de son coin witmit : stable même sur plusieurs lignes.
        var mr = rectPage(sessionMarks[c.id][0]);
        pt = { x: mr.x - 4, y: mr.y - 8, texte: true };
      } else {
        // Sans élément retrouvé : le point d'ancrage enregistré (coin haut droit de l'élément, à 3 px près).
        var ap = computeAbsolutePoint(c.anchor, c.fallback);
        pt = placeEpingle({ x: ap.x + 3, y: ap.y - 3, w: 0, h: 0 }, MARGE_CADRE, H);
      }
      var pin = poserEpingle(pt, false, fondSombreEpingle(pt, H, sombre));
      if (multi) {
        // Épingles secondaires, même numéro, sur les autres éléments du groupe (+ liens pointillés si demandé)
        multi.slice(1).forEach(function (el) {
          var p2 = placeEpingle(rectPage(el), MARGE_CADRE, 20);
          var sp = poserEpingle(p2, true, fondSombreEpingle(p2, 20, fondSombreAutour(el)));
          if (CONFIG.multiLines) drawLink(centre(pin), centre(sp), c.id, pin.classList.contains('wm-sur-sombre'));
        });
      }
    });
    pageComments().forEach(function (c) {
      if (!isDone(c)) return;
      var els = document.querySelectorAll('.cm-box-saved[data-id="' + c.id + '"], .cm-pin[data-id="' + c.id + '"], #cmLinks line[data-id="' + c.id + '"]');
      for (var d = 0; d < els.length; d++) els[d].classList.add('cm-done');
      (sessionMarks[c.id] || []).forEach(function (m) { m.classList.add('cm-done'); });
    });
    if (focusedId) applyFocus(focusedId, true);
    if (flashId) applyFocus(flashId, true);
    // Survol d'une épingle : les cadres de son commentaire s'allument (utile pour un groupe d'éléments)
    var pins = document.querySelectorAll('.cm-pin');
    for (var k = 0; k < pins.length; k++) {
      pins[k].onmouseenter = function () { glow(this.dataset.id, true); };
      pins[k].onmouseleave = function () { glow(this.dataset.id, false); };
    }
    if (focusPin) {
      var rendue = document.querySelector('.cm-pin:not(.cm-pin-secondary)[data-id="' + focusPin + '"]');
      if (rendue) { try { rendue.focus({ preventScroll: true }); } catch (e) { rendue.focus(); } }
    }
  }
  function glow(id, on) {
    var frames = document.querySelectorAll('.cm-box-saved[data-id="' + id + '"], .cm-pin[data-id="' + id + '"]');
    for (var i = 0; i < frames.length; i++) {
      frames[i].classList.toggle('cm-glow', on);
      frames[i].classList.toggle('cm-glow-light', on && frames[i].classList.contains('wm-sur-sombre'));
    }
  }
  /* Lien pointillé du centre de l'épingle principale au centre d'une secondaire (option data-multi-lines) */
  function drawLink(a, b, id, sombre) {
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
    if (sombre) l.setAttribute('class', 'wm-sur-sombre');
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

  /* ---------- cycle de vie d'un retour ----------
       nouveau ──(rapport)──▶ signalé ──(retour)──▶ pris en compte ──▶ résolu
                                 │                        │
                                 └──(retour)──▶ complément demandé ──(réponse + rapport)──▶ signalé
       Un retour qui a quitté « nouveau » n'est plus modifiable (texte, cibles, catégorie) ; seul un
       « complément demandé » accepte une réponse, ajoutée au texte d'origine. Un « signalé » pas encore
       pris en compte peut être rouvert (il redevient nouveau et remplacera l'ancien au prochain rapport).
       Le ✓ manuel = « résolu par moi ».
     Statuts (C2, table de Léa 2.2) : seuls les LIBELLÉS changent ; les valeurs internes (nouveau, signale,
     pris_en_compte, complement, resolu), la clé de stockage et la forme des données ne bougent pas. */
  var STATUS = {
    nouveau:        { icon: '',             label: 'nouveau' },
    signale:        { icon: 'LockSimple',   label: 'signalé' },
    pris_en_compte: { icon: 'Eye',          label: 'pris en compte' },
    complement:     { icon: 'Question',     label: 'complément demandé' },
    resolu:         { icon: 'CheckCircle',  label: 'résolu' }   // même icône pour résolu, répondu et résolu par moi (décision du 29/09)
  };
  function isDone(c) { return c.status === 'resolu'; }
  function isEditable(c) { return !c.status || c.status === 'nouveau'; }
  function frDate(iso) { try { return new Date(iso).toLocaleDateString('fr-FR'); } catch (e) { return ''; } }
  function deuxChiffres(n) { return (n < 10 ? '0' : '') + n; }
  function dateCourte(iso) { var d = new Date(iso); return isNaN(d) ? '' : deuxChiffres(d.getDate()) + '/' + deuxChiffres(d.getMonth() + 1); }
  // Date du retour dans la liste (Léa 3.4) : « à l'instant », « 12 min », « 2 h », « hier », « 24/10 », « 24/10/2025 ».
  function dateRelative(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var now = new Date(), min = Math.floor((now - d) / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return min + ' min';
    var jour = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
    var ecart = Math.round((jour(now) - jour(d)) / 86400000);
    if (ecart <= 0) return Math.floor(min / 60) + ' h';
    if (ecart === 1) return 'hier';
    return dateCourte(iso) + (d.getFullYear() === now.getFullYear() ? '' : '/' + d.getFullYear());
  }
  // Nom du statut (Léa 2.1 et 2.2), en minuscules, sans date ; rien pour « nouveau » (la marque d'envoi en tient lieu).
  function statusLabel(c) {
    if (c.status === 'resolu') return c.resolvedBy === 'moi' ? 'résolu par moi' : c.repondu ? 'répondu' : 'résolu';
    return c.status && c.status !== 'nouveau' && STATUS[c.status] ? STATUS[c.status].label : '';
  }
  // La date du statut passe en info-bulle : « résolu le 24/10/2026 ».
  function dateStatut(c) {
    return c.status === 'signale' ? c.signaledAt : c.status === 'resolu' ? c.resolvedAt : c.status === 'pris_en_compte' ? c.ackAt : c.status === 'complement' ? c.complementAt : null;
  }
  function titreStatut(c) { var d = dateStatut(c); return statusLabel(c) + (d ? ' le ' + frDate(d) : ''); }
  // Le statut précédé de son icône, le mot en gras (méta de la liste).
  function statusHtml(c) {
    var st = STATUS[c.status] || STATUS.nouveau;
    return (st.icon ? icone(st.icon, 14) : '') + '<b>' + cmEsc(statusLabel(c)) + '</b>';
  }
  function pushHistory(c, entry) { (c.history = c.history || []).push(entry); }
  var HIDE_DONE_KEY = 'witmit_hide_done';
  function hideDone() { try { return localStorage.getItem(HIDE_DONE_KEY) === '1'; } catch (e) { return false; } }
  function findComment(id) { return allComments.filter(function (x) { return x.id === id; })[0]; }

  /* ---------- voyant « l'équipe a écrit » (décision B du 25/10, option 1 ; C5) ----------
     Deux champs facultatifs sur chaque retour, dans le même objet du navigateur : equipeLe, le moment où witmit
     a vu l'équipe agir (un message, un statut changé par le serveur, un retour collé en maquette), et vuLe, la
     dernière fois que la personne l'a vu dans la liste. Du nouveau = equipeLe après vuLe. Ce que la personne
     fait elle-même (écrire, modifier, répondre, rouvrir) ne le pose jamais. Le voyant s'éteint quand elle
     ferme la liste après l'avoir vu. Au premier chargement de la 0.2.0, tout l'existant compte comme vu.
     Rien ne part au serveur. */
  function aDuNouveau(c) { return !!(c.equipeLe && (!c.vuLe || c.equipeLe > c.vuLe)); }
  function equipeAAgi(c) { c.equipeLe = new Date().toISOString(); }
  function marquerVus() {
    var now = new Date().toISOString(), n = 0;
    pageComments().forEach(function (c) {
      if (aDuNouveau(c)) { c.vuLe = now; n++; }       // affiché dans la liste, même terminé (voir renderList) : vu
    });
    if (n) { persist(); renderList(); renderMarkers(); }   // le voyant de l'épingle s'éteint avec celui de la liste
  }

  /* ---------- « reçu par witmit » et suppressions en live (décision C du 25/10, option 1 ; C9, Léa 50) ----------
     recuLe : date de la première réponse 201 du guichet (ou d'un 409 « déjà pris en charge », qui prouve que le
     retour est chez lui), posée une fois et jamais effacée : une modification ou un renvoi remettent c.sync à
     zéro, c.sync ne peut donc pas le dire. En live avec guichet, un retour se supprime seulement s'il n'a jamais
     été reçu et n'est pas « envoi en cours ». Live sans guichet : rien n'est jamais reçu, tout se supprime.
     Maquette : inchangée, tout se supprime. */
  function supprimable(c) {
    if (!SYNC) return true;
    return !c.recuLe && !(c.sync && c.sync.state === 'pending');
  }
  function poserRecu(c) { if (c && !c.recuLe) c.recuLe = new Date().toISOString(); }
  // Retours qui portent une trace du guichet (identifiant, fil, statut venu du serveur) : reçus, même sans recuLe
  // (retours écrits avant la 0.2.0). Appliqué à chaque chargement : ne pose que ce qui manque.
  function marquerRecusConnus() {
    var n = 0;
    allComments.forEach(function (c) {
      if (c.recuLe) return;
      if ((c.sync && c.sync.id) || (c.thread && c.thread.length) || c.resolvedBy === 'serveur' || (SYNC && c.status === 'pris_en_compte')) { poserRecu(c); n++; }
    });
    return n;
  }

  /* ✓ manuel : résolu par moi (depuis n'importe quel statut sauf résolu) */
  window.cmResolve = function (id) {
    var c = findComment(id);
    if (!c || isDone(c)) return;
    if (pendingPopup && pendingPopup._meta && pendingPopup._meta.existing === c) closePopup(true);
    c.status = 'resolu'; c.resolvedAt = new Date().toISOString(); c.resolvedBy = 'moi';
    pushHistory(c, { date: c.resolvedAt, status: 'resolu', source: 'moi' });
    persist(); renderList(); renderMarkers();
    cmStatus('marqué résolu par toi.' + (LIVE ? " l'équipe n'est pas prévenue." : ''), { type: 'fait' });
  };
  /* Rouvrir un retour signalé pas encore pris en compte : redevient nouveau, modifiable ; le prochain
     rapport le renverra avec la mention « remplace la version du … » */
  window.cmReopen = function (id) {
    var c = findComment(id);
    if (!c || c.status !== 'signale') return;
    c.supersedes = c.signaledAt;
    c.status = 'nouveau'; delete c.signaledAt;
    pushHistory(c, { date: new Date().toISOString(), status: 'nouveau', source: 'moi', message: 'rouvert' });
    persist(); renderList(); renderMarkers();
    cmStatus('rouvert : tu peux le modifier, il repartira dans le prochain rapport.', { type: 'fait' });
  };
  window.cmToggleHideDone = function () {
    try { localStorage.setItem(HIDE_DONE_KEY, hideDone() ? '0' : '1'); } catch (e) {}
    renderList(); renderMarkers();
  };

  /* ---------- le fil d'un retour (fiche FilDeMessages ; Léa 3.4 et 3.6) ----------
     Messages de l'équipe en creux, les tiens en retrait ; méta et texte de la personne en police système, ce dernier entre « ».
     Live : le fil du serveur, puis tes messages pas encore partis ; dessous, « répondre » (si l'équipe a écrit
     au moins une fois) et « ça ne convient pas ? rouvrir » (retour résolu ou répondu par l'équipe).
     Maquette : complément demandé, message de l'équipe collé, tes réponses en attente du prochain rapport. */
  function canReply(c) { return !!(SYNC && c.sync && c.sync.id && (c.thread || []).some(function (m) { return m.de === 'equipe'; })); }
  function canReopen(c) {
    return !!(SYNC && c.sync && c.sync.id && (c.sync.statut === 'resolu' || c.sync.statut === 'repondu') && c.status === 'resolu' && c.resolvedBy === 'serveur' &&
      !(c.replies || []).some(function (r) { return r.rouvrir; }));
  }
  function messageHtml(cls, qui, texte) {
    return '<div class="cm-msg ' + cls + '"><span class="cm-msg-who">' + qui + '</span>' +
      (texte ? '<span class="cm-msg-texte cm-voix">' + cmEsc(texte) + '</span>' : '') + '</div>';
  }
  function filHtml(c) {
    var msgs = [];
    if (!SYNC) {
      if (c.status === 'complement' && c.complementMessage) msgs.push(messageHtml('cm-feedback cm-feedback-q', icone('Question', 14) + '<b>complément demandé</b>' + (c.complementAt ? ' · ' + cmEsc(dateCourte(c.complementAt)) : ''), c.complementMessage));
      else if (c.feedbackMessage) msgs.push(messageHtml('cm-feedback', icone('ChatCircleText', 14) + '<b>équipe</b>', c.feedbackMessage));
      (c.replies || []).forEach(function (r) {
        msgs.push(messageHtml('cm-msg-auteur cm-reply', icone('ArrowBendDownRight', 14) + '<b>toi</b> · ' + cmEsc(dateCourte(r.date)) + (r.sentIn ? '' : ' · pour le prochain rapport'), r.text));
      });
      return msgs.length ? '<div class="cm-thread">' + msgs.join('') + '</div>' : '';
    }
    if (c.feedbackMessage && !(c.thread && c.thread.length)) msgs.push(messageHtml('cm-msg-equipe cm-feedback', icone('ChatCircleText', 14) + '<b>équipe</b>', c.feedbackMessage));
    (c.thread || []).forEach(function (m) {
      var equipe = m.de === 'equipe';
      var qui = equipe ? icone('ChatCircleText', 14) + '<b>équipe</b>' : (m.rouvre ? icone('ArrowCounterClockwise', 14) + '<b>tu as rouvert ce retour</b>' : icone('ArrowBendDownRight', 14) + '<b>toi</b>');
      msgs.push(messageHtml(equipe ? 'cm-msg-equipe' : 'cm-msg-auteur', qui + ' · ' + cmEsc(frDate(m.cree_le)), m.texte));
    });
    (c.replies || []).forEach(function (r) {
      var err = r.sync && r.sync.state === 'error';
      // Refus définitif ou réponse en 500 (E1) : plus de bouton de renvoi, seul « × abandonner » reste.
      var marque = err
        ? (renvoiPermis(r.sync)
            ? '<button type="button" class="cm-sync-chip cm-sync-error" onclick="cmRetryReply(\'' + c.id + '\', \'' + r.id + '\')" title="' + cmEsc(titreARenvoyer(r.sync, true)) + '">' + icone('WarningCircle', 14, 'wm-signal') + '<b>à renvoyer</b></button>'
            : '<span class="cm-sync-chip cm-sync-error wm-sans-renvoi" title="' + cmEsc(titreARenvoyer(r.sync, true)) + '">' + icone('WarningCircle', 14, 'wm-signal') + '<b>à renvoyer</b>' + raisonLue(r.sync, true) + '</span>') +
          '<button type="button" class="cm-msg-drop wm-cercle wm-cercle-24" onclick="cmDropReply(\'' + c.id + '\', \'' + r.id + '\')" title="abandonner ce message" aria-label="abandonner ce message">' + icone('X', 12) + '</button>'
        : '<span class="cm-sync-chip" title="envoi en cours">' + icone('CircleNotch', 14, 'wm-tourne') + 'envoi en cours…</span>';
      var qui = r.rouvrir ? icone('ArrowCounterClockwise', 14) + '<b>tu rouvres ce retour</b>' : icone('ArrowBendDownRight', 14) + '<b>toi</b>';
      msgs.push(messageHtml('cm-msg-auteur cm-msg-pending', qui + ' · ' + cmEsc(frDate(r.date)) + ' ' + marque, r.text));
    });
    var acts = [];
    if (canReply(c)) acts.push('<button type="button" class="cm-reply-btn wm-touche wm-petite" onclick="cmReplyLive(\'' + c.id + '\', false)">' + icone('ArrowBendUpLeft', 14) + 'répondre</button>');
    if (canReopen(c)) acts.push('<button type="button" class="cm-reopen-btn wm-touche wm-petite" onclick="cmReplyLive(\'' + c.id + '\', true)">' + icone('ArrowCounterClockwise', 14) + 'ça ne convient pas ? rouvrir</button>');
    return (msgs.length ? '<div class="cm-thread" onmousedown="event.stopPropagation()">' + msgs.join('') + '</div>' : '') +
      (acts.length ? '<div class="cm-thread-actions" onmousedown="event.stopPropagation()">' + acts.join('') + '</div>' : '');
  }
  // Ouvre le champ de réponse sous le fil (même champ que la réponse à un complément en mode maquette).
  window.cmReplyLive = function (id, rouvrir) {
    var c = findComment(id);
    var item = document.querySelector('.cm-panel-item[data-id="' + id + '"]');
    if (!c || !item || item.querySelector('textarea') || (rouvrir ? !canReopen(c) : !canReply(c))) return;
    replyInList(item, c, {
      libelle: rouvrir ? icone('ArrowCounterClockwise', 14) + 'rouvrir ce retour' : icone('ArrowBendUpLeft', 14) + 'répondre',
      placeholder: rouvrir ? "qu'est-ce qui ne va pas ? (obligatoire)" : "ta réponse à l'équipe…",
      touche: rouvrir ? 'rouvrir' : 'envoyer',
      required: rouvrir ? 'dis ce qui ne va pas pour rouvrir ce retour.' : '',
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

  /* ---------- une ligne de la liste (fiche Tiroir) ----------
     Numéro dans son carré ; corps : élément visé, texte entre « », vignette, méta (verrou, statut ou marque
     d'envoi en gras, voyant « nouveau », prénom, date), catégorie et détails techniques, puis le fil ;
     actions : ✓ résolu par moi, ↩ rouvrir (maquette), corbeille (live : retour jamais reçu, C9). */
  var capturesEnCours = {};   // id → vrai pendant la capture d'une zone (fiche Etats : « capture… »)
  function captureEnCoursHtml() {
    return '<div class="cm-capture-en-cours"><span class="cm-capture-boite">' + icone('CircleNotch', 16, 'wm-tourne') + '</span><span>capture…</span></div>';
  }
  function ligneHtml(c, i) {
    var cat = categoryOf(c.category), modifiable = isEditable(c);
    var etat = '';
    if (SYNC && c.status === 'nouveau') etat = syncChip(c);               // la marque d'envoi tient lieu de statut
    else if (c.status && c.status !== 'nouveau') {
      var verrou = !modifiable && c.status !== 'signale' ? '<span class="cm-verrou" title="non modifiable">' + icone('LockSimple', 14) + '</span>' : '';
      etat = verrou + '<span class="cm-status-chip cm-st-' + c.status + '" title="' + cmEsc(titreStatut(c) + (c.status === 'signale' ? ' · non modifiable' : '')) + '">' + statusHtml(c) + '</span>';
    }
    var meta = [];
    if (etat) meta.push('<span class="cm-mi">' + etat + '</span>');
    if (aDuNouveau(c)) meta.push('<span class="cm-nouveau"><span class="wm-voyant" aria-hidden="true"></span>nouveau</span>');
    var suite = [];
    if (c.author) suite.push(cmEsc(c.author));
    suite.push(cmEsc(dateRelative(c.date)));
    suite.forEach(function (s) { meta.push('<span>' + (meta.length ? '· ' : '') + s + '</span>'); });
    var vignette = c.shot && c.shot.dataUrl
      ? '<button type="button" class="cm-vignette" title="agrandir la capture" aria-label="agrandir la capture" onmousedown="event.stopPropagation()" onclick="event.stopPropagation(); cmShowShot(\'' + c.id + '\', this)">' +
          '<span class="cm-vignette-face"><img class="cm-shot" alt="capture de la zone" src="' + c.shot.dataUrl + '"></span><span class="cm-loupe" aria-hidden="true">' + icone('MagnifyingGlassPlus', 14) + '</span></button>'
      : capturesEnCours[c.id] ? captureEnCoursHtml() : '';
    var multi = c.targets && c.targets.length > 1;
    return '<div class="cm-panel-item' + (c.id === focusedId ? ' cm-current' : '') + (isDone(c) ? ' cm-done' : '') + (aDuNouveau(c) ? ' cm-a-du-nouveau' : '') + '" data-id="' + c.id + '">' +
      '<div class="num">' + (i + 1) + '</div>' +
      '<div class="body" onmousedown="cmFocusDown(event, \'' + c.id + '\')" title="' + (modifiable ? 'voir sur la page et modifier' : 'voir sur la page') + '">' +
        '<div class="zone" title="' + cmEsc(c.zone) + '">' + icone(multi ? 'SelectionPlus' : c.type === 'box' ? 'BoundingBox' : c.type === 'text' ? 'TextT' : 'CursorClick', 14) + '<span class="zone-txt">' + cmEsc(c.zone) + '</span></div>' +
        '<div class="txt">' + cmEsc(c.text) + '</div>' +
        vignette +
        '<div class="cm-meta">' + meta.join('') + '</div>' +
        '<div class="cm-meta cm-meta2"><span class="cm-cat-chip" title="catégorie">' + icone(cat.icon, 14) + cmEsc(nomCategorie(c.category)) + '</span>' +
          (c.tech ? '<details class="cm-tech" onmousedown="event.stopPropagation()"><summary>' + icone('CaretRight', 14, 'wm-ferme') + icone('CaretDown', 14, 'wm-ouvert') + 'détails techniques</summary><pre>' + cmEsc(techSummary(c.tech)) + '</pre></details>' : '') +
        '</div>' +
        filHtml(c) +
      '</div>' +
      '<div class="cm-item-actions">' +
        (!isDone(c)
          ? '<button type="button" class="st wm-cercle" onclick="cmResolve(\'' + c.id + '\')" title="' + cmEsc('marquer résolu par moi : rangé dans tes terminés, non modifiable' + (LIVE ? " · l'équipe n'est pas prévenue" : '')) + '" aria-label="marquer résolu par moi">' + icone('Check', 15) + '</button>'
          : '<span class="st cm-st-locked wm-cercle wm-inactif" title="terminé, non modifiable">' + icone('CheckCircle', 15) + '</span>') +
        (c.status === 'signale' ? '<button type="button" class="reopen wm-cercle" onclick="cmReopen(\'' + c.id + '\')" title="rouvrir pour corriger : il repartira dans le prochain rapport" aria-label="rouvrir pour corriger">' + icone('ArrowCounterClockwise', 15) + '</button>' : '') +
        (supprimable(c) ? '<button type="button" class="del wm-cercle" onclick="cmDeleteById(\'' + c.id + '\')" aria-label="supprimer ce retour" title="supprimer ce retour">' + icone('Trash', 15) + '</button>' : '') +
      '</div></div>';
  }

  function renderList() {
    var pc = pageComments();
    var remaining = pc.filter(function (c) { return !isDone(c); });
    var done = pc.length - remaining.length;
    var list = document.getElementById('cmList');
    // Voyant du bouton witmit et son nom accessible (C5) : les retours de cette page où l'équipe a écrit ou changé
    // le statut depuis ta dernière visite.
    var surLaPage = {};
    pc.forEach(function (c) { surLaPage[c.id] = true; });
    nbNouveaux = pc.filter(aDuNouveau).length;
    var cmCountEl = document.getElementById('cmCount');
    if (cmCountEl) { cmCountEl.textContent = nbNouveaux || ''; cmCountEl.dataset.zero = nbNouveaux ? '0' : '1'; }
    majBoutons();
    var panelCountEl = document.getElementById('cmPanelCount');
    if (panelCountEl) {
      panelCountEl.textContent = pc.length;
      panelCountEl.setAttribute('aria-label', pc.length + (pc.length > 1 ? ' retours' : ' retour') + ' sur cette page');
    }
    // Ligne de compte (Léa 3.3) : « 2 à suivre · 1 terminé — 12 retours sur 5 pages du site, dont 9 à suivre ».
    var subEl = document.getElementById('cmPanelSub');
    if (subEl) {
      var nPages = {};
      allComments.forEach(function (c) { nPages[c.page] = true; });
      var nP = Object.keys(nPages).length, total = allComments.length;
      var siteRemaining = allComments.filter(function (c) { return !isDone(c); }).length;
      subEl.textContent = total ? remaining.length + ' à suivre' + (done ? ' · ' + done + (done > 1 ? ' terminés' : ' terminé') : '') +
        ' — ' + total + (total > 1 ? ' retours' : ' retour') + ' sur ' + nP + (nP > 1 ? ' pages' : ' page') + ' du site' +
        (nP > 1 && siteRemaining !== total ? ', dont ' + siteRemaining + ' à suivre' : '') : '';   // « dont » : seulement s'il y a d'autres pages
      subEl.hidden = !total;
    }
    // Du nouveau sur d'autres pages du site (décision B) : leurs titres.
    var ailleursEl = document.getElementById('cmPanelAilleurs');
    if (ailleursEl) {
      var titres = [];
      allComments.forEach(function (c) {
        if (surLaPage[c.id] || !aDuNouveau(c)) return;
        var t = c.pageTitle || c.page;
        if (titres.indexOf(t) < 0) titres.push(t);
      });
      ailleursEl.textContent = titres.length ? 'du nouveau aussi sur : ' + titres.join(', ') : '';
      ailleursEl.hidden = !titres.length;
    }
    var caseEl = document.querySelector('#cmPanel .cm-hide-done');
    if (caseEl) { caseEl.hidden = !pc.length; caseEl.setAttribute('aria-checked', hideDone() ? 'true' : 'false'); }
    var aide = document.getElementById('cmNewAide');
    if (aide) aide.hidden = !!pc.length;
    if (!pc.length) {
      list.innerHTML = "<div class=\"cm-panel-empty\">aucun retour sur cette page pour l'instant.</div>";
      majPiedsTiroir();
      return;
    }
    var html = '';
    pc.forEach(function (c, i) {
      // « masquer les terminés » cache un retour terminé, sauf s'il a du nouveau : il reste affiché avec « nouveau »
      // jusqu'à la fermeture de la liste, où il compte comme vu ; le filtre le cache à l'ouverture suivante (C5).
      if (hideDone() && isDone(c) && !aDuNouveau(c)) return;
      html += ligneHtml(c, i);
    });
    if (!html) html = '<div class="cm-panel-empty">tous les retours de cette page sont terminés.</div>';
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
      var olaClass = scrollEl.classList.contains('wm-sur-sombre') ? 'cm-ola-light' : 'cm-ola';
      var ondes = targets.length ? targets.slice(0, 1) : [];      // une onde par repère (le cadre, ou le passage)
      if (!ondes.length && pin) ondes = [pin];
      targets.forEach(function (el) {
        el.classList.remove('cm-ola', 'cm-ola-light');
        el.classList.add(olaClass);
        setTimeout(function () { el.classList.remove(olaClass); }, 1300);
      });
      // L'onde part une fois le défilement doux arrivé, pour qu'on la voie.
      setTimeout(function () { ondes.forEach(lancerOnde); }, 350);
    } else {
      cmStatus("repère introuvable ici : ouvre l'onglet ou l'étape où tu l'avais posé.");
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
    cmStatus('réponse enregistrée : elle partira dans le prochain rapport.', { type: 'fait' });
    return true;
  }
  /* Le champ de réponse, ouvert en place sous le fil (fiche FilDeMessages) : libellé, champ arrondi, puis
     « annuler » (échap) à gauche et la touche secondaire (envoyer, rouvrir, enregistrer ↵) à droite.
     opts (mode live, répondre / rouvrir) : libelle, placeholder, touche, required (phrase sous le champ si vide :
     le champ reste ouvert), keepOnBlur (cliquer ailleurs n'envoie rien : un message publié ne doit pas partir
     par mégarde), onSave(texte). Sans opts : réponse à un complément demandé (mode maquette). */
  function replyInList(item, c, opts) {
    opts = opts || {};
    var body = item.querySelector('.body');
    var acts = item.querySelector('.cm-thread-actions');
    var bloc = document.createElement('div');
    bloc.className = 'cm-reponse-bloc';
    var repereEntree = '<span class="wm-repere" aria-hidden="true">' + icone('ArrowElbowDownLeft', 12) + '</span>';
    bloc.innerHTML =
      '<div class="cm-reponse-libelle">' + (opts.libelle || icone('ArrowBendDownRight', 14) + 'ta réponse au complément') + '</div>' +
      '<span class="wm-champ"><textarea class="cm-inline-edit cm-inline-reply"></textarea></span>' +
      '<div class="cm-refus" role="status" hidden>' + icone('Info', 14) + '<span></span></div>' +
      '<div class="cm-reponse-actions"><button type="button" class="wm-texte cm-rep-annuler">annuler<span class="wm-repere" aria-hidden="true">échap</span></button>' +
      '<button type="button" class="wm-touche wm-petite cm-rep-envoyer">' + (opts.touche || 'enregistrer') + repereEntree + '</button></div>';
    var ta = bloc.querySelector('textarea');
    ta.placeholder = opts.placeholder || 'ta réponse…';
    ta.setAttribute('aria-label', bloc.querySelector('.cm-reponse-libelle').textContent);
    var refus = bloc.querySelector('.cm-refus');
    refus.querySelector('span').textContent = opts.required || '';
    // Un appui dans le bloc ne sélectionne pas la ligne ; sur une touche, il garde le focus dans le champ.
    bloc.addEventListener('mousedown', function (e) { e.stopPropagation(); if (e.target.closest && e.target.closest('button')) e.preventDefault(); });
    if (acts) acts.hidden = true;
    body.appendChild(bloc);
    ta.focus();
    var finished = false;
    function finish(save) {
      if (finished) return;
      var v = ta.value.trim();
      if (save && !v && opts.required) { refus.hidden = false; ta.focus(); return; }
      finished = true;
      bloc.remove();
      if (acts) acts.hidden = false;
      if (save && v) { if (opts.onSave) opts.onSave(v); else addReply(c, v); }
    }
    ta.addEventListener('input', function () { if (ta.value.trim()) refus.hidden = true; });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    ta.addEventListener('blur', function () { if (!opts.keepOnBlur) finish(true); });
    bloc.querySelector('.cm-rep-annuler').onclick = function (e) { e.stopPropagation(); finish(false); };
    bloc.querySelector('.cm-rep-envoyer').onclick = function (e) { e.stopPropagation(); finish(true); };
  }

  /* Modification du texte directement dans la liste (fiche Tiroir, « en modification ») : champ arrondi en
     place, aide « ↵ envoyer · échap annuler » dessous. Entrée = enregistrer, Maj+Entrée = nouvelle ligne,
     Échap = annuler, clic ailleurs = enregistrer (comportement inchangé). */
  function editInList(id) {
    var item = document.querySelector('.cm-panel-item[data-id="' + id + '"]');
    if (!item || item.querySelector('textarea')) return;
    var c = findComment(id);
    if (!c) return;
    if (c.status === 'complement') { replyInList(item, c); return; }
    if (!isEditable(c)) { cmStatus(statusLabel(c) + ' : non modifiable.'); return; }
    var txt = item.querySelector('.txt');
    var bloc = document.createElement('div');
    bloc.className = 'cm-edit-bloc';
    bloc.innerHTML = '<span class="wm-champ"><textarea class="cm-inline-edit" aria-label="modifier ce retour"></textarea></span>' +
      '<div class="cm-aide"><span class="wm-repere" aria-hidden="true">' + icone('ArrowElbowDownLeft', 12) + '</span><span>' + (LIVE ? 'envoyer' : 'enregistrer') + ' ·</span>' +
      '<span class="wm-repere" aria-hidden="true">échap</span><span>annuler</span></div>';
    var ta = bloc.querySelector('textarea');
    ta.value = c.text;
    txt.replaceWith(bloc);
    ta.style.height = Math.max(ta.scrollHeight + 2, 48) + 'px';
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    var finished = false;
    function finish(save) {
      if (finished) return;
      finished = true;
      var v = ta.value.trim();
      if (save && v && v !== c.text) { c.text = v; persist(); cmStatus(SYNC ? 'retour modifié, envoi en cours.' : 'retour modifié.', { type: SYNC ? 'encours' : 'fait' }); c.sync = null; scheduleSync(c); }
      // On remet le texte en place SANS redessiner la liste : un clic en cours sur un autre item
      // (qui a provoqué ce blur) doit atteindre sa cible.
      var div = document.createElement('div');
      div.className = 'txt';
      div.textContent = c.text;
      bloc.replaceWith(div);
      if (save && v && v === c.text) renderMarkers(); // met à jour l'info-bulle des pastilles
    }
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight + 2, 48) + 'px'; });
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
      (sessionMarks[id] || []).forEach(function (m) { m.classList.remove('cm-focus'); });
      var cadre = document.querySelector('.cm-box-saved[data-id="' + id + '"]');
      var premier = cadre || (sessionMarks[id] || [])[0] || document.querySelector('.cm-pin[data-id="' + id + '"]');
      lancerOnde(premier);
      setTimeout(function () {
        var done = document.querySelectorAll('.cm-box-saved[data-id="' + id + '"]');
        for (var j = 0; j < done.length; j++) done[j].classList.remove('cm-ola', 'cm-ola-light');
      }, 1300);
    }, 1000);
  }

  /* Commentaire "actif" (bulle ouverte ou sélectionné dans la liste) : ses cadres, pastilles et lignes changent de couleur */
  var focusedId = null;
  function applyFocus(id, on) {
    var els = document.querySelectorAll('.cm-box-saved[data-id="' + id + '"], .cm-pin[data-id="' + id + '"], #cmLinks line[data-id="' + id + '"]');
    for (var i = 0; i < els.length; i++) {
      els[i].classList.toggle('cm-focus', on);
      els[i].classList.toggle('cm-focus-light', on && els[i].classList.contains('wm-sur-sombre'));
    }
    (sessionMarks[id] || []).forEach(function (m) { m.classList.toggle('cm-focus', on); });   // passage : 3 px et coins de 10 px
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

  /* Suppressions (Léa 3.9 et 3.10 ; C9). En live, seuls les retours jamais reçus par witmit s'effacent :
     cmDeleteById, cmClearAll et cmClearSite refusent eux-mêmes un retour reçu, même appelés directement. */
  function effacerRetours(ids) {
    allComments.forEach(function (c) { if (ids[c.id] && sessionMarks[c.id]) { unwrapMarks(sessionMarks[c.id]); delete sessionMarks[c.id]; } });
    allComments = allComments.filter(function (c) { return !ids[c.id]; });
    persist(); renderMarkers(); renderList();
  }
  window.cmDeleteById = function (id) {
    var c = findComment(id);
    if (!c || !supprimable(c)) return;
    var ids = {}; ids[id] = true;
    effacerRetours(ids);
  };
  function nRetours(n, pasPartis) { return n + (n > 1 ? ' retours' : ' retour') + (pasPartis ? (n > 1 ? ' pas encore partis' : ' pas encore parti') : ''); }
  window.cmClearAll = function () {
    var pc = pageComments().filter(supprimable);
    if (!pc.length) return;
    var question = SYNC
      ? 'effacer ' + (pc.length > 1 ? 'les ' + nRetours(pc.length, true) : 'le retour pas encore parti') + " de cette page ? c'est définitif. tes retours envoyés restent."
      : 'effacer ' + (pc.length > 1 ? 'les ' + nRetours(pc.length) : 'le retour') + " de cette page ? c'est définitif.";
    if (!window.confirm(question)) return;
    var ids = {}; pc.forEach(function (c) { ids[c.id] = true; });
    effacerRetours(ids);
    cmStatus(SYNC ? 'retours pas encore partis effacés.' : 'retours de cette page effacés.', { type: 'fait' });
  };
  /* Vide le stockage PARTAGÉ (toutes les pages/fichiers du site, pas seulement celle-ci) —
     utile pour repartir propre quand d'anciens fichiers de test (noms différents) ont laissé
     des retours orphelins dans le rapport du site. En live, seulement les retours jamais reçus. */
  window.cmClearSite = function () {
    var cibles = allComments.filter(supprimable);
    if (!cibles.length) { if (!SYNC) cmStatus('rien à effacer : aucun retour sur ce site.'); return; }
    var nPages = {};
    cibles.forEach(function (c) { nPages[c.page] = true; });
    var nP = Object.keys(nPages).length;
    var pages = nP > 1 ? ' des ' + nP + ' pages du site, pas seulement celle-ci' : ' du site';
    var question = SYNC
      ? 'effacer ' + (cibles.length > 1 ? 'les ' + nRetours(cibles.length, true) : 'le retour pas encore parti') + pages + " ? c'est définitif. tes retours envoyés restent."
      : 'effacer ' + (cibles.length > 1 ? 'les ' + nRetours(cibles.length) : 'le retour') + pages + " ? c'est définitif.";
    if (!window.confirm(question)) return;
    var ids = {}; cibles.forEach(function (c) { ids[c.id] = true; });
    effacerRetours(ids);
    cmStatus(SYNC ? 'retours pas encore partis du site effacés.' : 'tous les retours du site sont effacés.', { type: 'fait' });
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
    return label || 'élément de la page';
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
      return { label: 'zone générale de la page', el: null };
    }

    var atomic = el.closest && el.closest(ATOMIC_SELECTOR);
    if (atomic && !atomic.classList.contains('cm-ui') && !(atomic.matches && atomic.matches(CARD_SELECTOR))) {
      var atomicLabel =
        (atomic.getAttribute && (atomic.getAttribute('aria-label') || atomic.getAttribute('title'))) ||
        textExcerpt(atomic, 60);
      if (!atomicLabel && atomic.tagName) {
        var tag = atomic.tagName.toLowerCase();
        atomicLabel = tag === 'input' ? ('champ ' + (atomic.getAttribute('placeholder') || atomic.type || '')).trim() : 'élément (' + tag + ')';
      }
      return { label: atomicLabel || 'élément de la page', el: atomic };
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
      ? 'zone encadrée : ' + names.join(', ') + (extra ? ' (+' + extra + ')' : '')
      : 'zone encadrée ' + (container ? 'dans : ' + detectZone(container).label : 'dans la page');
    return { label: label, el: container };
  }

  /* Libellé d'une sélection de plusieurs éléments : « 3 éléments : A, B, C (+n) » (Léa 3.8) */
  function multiLabel(targets) {
    if (targets.length === 1) return targets[0].label;
    var names = targets.slice(0, 3).map(function (t) { return t.label; });
    return targets.length + ' éléments : ' + names.join(', ') + (targets.length > 3 ? ' (+' + (targets.length - 3) + ')' : '');
  }

  /* Icône par type de cible, dans la fenêtre et la liste (fiche Icones) : élément, zone, passage de texte,
     plusieurs éléments. */
  function typeIcon(type, multi) {
    return icone(multi ? 'SelectionPlus' : type === 'box' ? 'BoundingBox' : type === 'text' ? 'TextT' : 'CursorClick', 14, 'wm-devant');
  }
  // Type de cible dans le rapport Markdown (C3, Léa 3.12) : « élément », « zone » ou « texte », sans émoji.
  function typeRapport(type) {
    return type === 'box' ? 'zone' : type === 'text' ? 'texte' : 'élément';
  }

  /* Contour PERSISTANT qui confirme visuellement l'objet visé par le commentaire en cours de saisie —
     reste affiché tant que le popup est ouvert (jusqu'à Enregistrer, Annuler ou un clic ailleurs), et
     se recale si la page est redimensionnée pendant ce temps. */
  var editOutlines = []; // [{ el, box }] — un contour par élément visé (plusieurs en sélection multiple)

  function positionEditOutline() {
    editOutlines.forEach(function (o) {
      var r = rectPage(o.el);
      dimensionnerCadre(o.box, r.x, r.y, r.w, r.h);
    });
  }
  function showEditOutline(els) {
    hideEditOutline();
    (Array.isArray(els) ? els : [els]).forEach(function (el) {
      if (!el) return;
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      var box = document.createElement('div');
      // Cadre de sélection, état actif (fiche Reperes) : 16 px de marge, coins et traits pleins.
      box.className = 'cm-box cm-ui cm-box-editing' + (fondSombreAutour(el) ? ' wm-sur-sombre cm-focus-light' : '');
      assurerCadre(box);
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
    dimensionnerCadre(el, b.x, b.y, b.w, b.h);
  }
  function makeBoxEditable(boxEl, meta) {
    if (!boxEl || boxEl.classList.contains('cm-box-editable')) return;
    boxEl.classList.add('cm-box-editable');
    document.body.classList.add('wm-zone-en-edition');   // la zone de 44 px des épingles laisse passer les poignées
    assurerCadre(boxEl);
    applyBoxStyle(boxEl, meta.box || { x: boxEl.offsetLeft, y: boxEl.offsetTop, w: boxEl.offsetWidth, h: boxEl.offsetHeight });
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
    document.body.classList.remove('wm-zone-en-edition');
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

  var epingleOuvreuse = null;   // id du retour dont l'épingle a ouvert la fenêtre en cours
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
    epingleOuvreuse = null;
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
    // Élément visé : son cadre s'écarte de 16 px (F7) ; la fenêtre ne doit recouvrir ni le cadre ni l'épingle.
    var R = null;
    if (meta.targets && meta.targets.length > 1) R = unionRect(meta.targets.map(function (t) { return t.el; }));
    else if (meta.outlineEl) R = unionRect(Array.isArray(meta.outlineEl) ? meta.outlineEl : [meta.outlineEl]);
    if (R) { R.x -= MARGE_CADRE; R.y -= MARGE_CADRE; R.w += 2 * MARGE_CADRE; R.h += 2 * MARGE_CADRE; }
    return R;
  }
  function placePopup(pop, R, fallbackX, fallbackY) {
    var vx = window.scrollX, vy = window.scrollY;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    // Règle de largeur (M1) : 380 px, jamais plus que l'écran moins 8 px de chaque côté (barre de défilement
    // comprise, que 100vw ne retire pas).
    if (pop.offsetWidth > vw - 16) pop.style.width = Math.max(0, vw - 16) + 'px';
    var W = pop.offsetWidth, Hh = pop.offsetHeight, gap = 10, pinRoom = 48; // place de l'épingle (F6 : 24 px, à 22 px au-dessus)
    function clampX(x) { return Math.max(vx + 8, Math.min(x, vx + vw - W - 8)); }
    function apply(x, y) { pop.style.left = x + 'px'; pop.style.top = y + 'px'; }
    if (!R) { apply(clampX(fallbackX), Math.max(vy + 8, Math.min(fallbackY + 10, vy + vh - Hh - 8))); return; }
    // Épingle posée sous le cadre faute de place au-dessus (F6 : 6 px + 24 px) : la fenêtre passe sous elle.
    var pinDessous = R.y - 30 < 0;
    var cands = [
      { x: R.x, y: R.y + R.h + gap + (pinDessous ? 30 : 0) },
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
  /* La fenêtre a grandi (catégories dépliées, texte long) : elle remonte pour ne pas sortir par le bas. */
  function recalerFenetre(pop) {
    var vy = window.scrollY, vh = window.innerHeight, top = pop.offsetTop, H = pop.offsetHeight;
    if (top + H > vy + vh - 8) pop.style.top = Math.max(vy + 8, vy + vh - 8 - H) + 'px';
  }

  /* La fenêtre se déplace en la prenant par sa tête entière (titre et élément visé), sauf la croix. */
  function makePopupDraggable(pop, handle) {
    handle.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('button')) return;
      e.stopPropagation(); e.preventDefault();
      var offX = e.pageX - pop.offsetLeft, offY = e.pageY - pop.offsetTop;
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      function onMove(ev) { pop.style.left = (ev.pageX - offX) + 'px'; pop.style.top = (ev.pageY - offY) + 'px'; }
      function onUp() { handle.removeEventListener('pointermove', onMove); handle.removeEventListener('pointerup', onUp); }
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  }

  /* ---------- fenêtre de saisie : textes et morceaux (fiche Fenetre ; Léa 3.7 et 3.8) ---------- */
  function nomCategorie(key) { return categoryOf(key).label.toLowerCase(); }
  // Nom du statut dans la ligne de verrou (Léa 2.1 et 2.2) : en minuscules, sans date. (supprimable(c) : C9, plus haut.)
  function nomStatut(c) { return statusLabel(c); }
  // Nombre d'éléments visés par une fenêtre « plusieurs éléments » (0 sinon).
  function nbCibles(meta) {
    if (!meta || meta.type !== 'pin') return 0;
    if (meta.targets && meta.targets.length > 1) return meta.targets.length;
    var ex = meta.existing;
    return ex && ex.targets && ex.targets.length > 1 && !(meta.targets && meta.targets.length) ? ex.targets.length : 0;
  }
  // Titre de la fenêtre selon la cible (Léa 3.7) : bouton, lien, champ, texte, zone, N éléments, élément.
  function titreFenetre(meta) {
    var n = nbCibles(meta);
    if (n > 1) return 'Ton retour sur ces ' + n + ' éléments';
    if (meta && meta.type === 'box') return 'Ton retour sur cette zone';
    if (meta && meta.type === 'text') return 'Ton retour sur ce texte';
    var el = meta && meta.targets && meta.targets.length ? meta.targets[0].el : meta && meta.outlineEl;
    if (Array.isArray(el)) el = el[0];
    if (el && el.nodeType === 1) {
      if (el.matches('input[type="button"], input[type="submit"], input[type="reset"], input[type="image"]') || el.closest('button, [role="button"], summary')) return 'Ton retour sur ce bouton';
      if (el.closest('a[href], [role="link"]')) return 'Ton retour sur ce lien';
      if (el.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="searchbox"], [role="combobox"]')) return 'Ton retour sur ce champ';
    }
    return 'Ton retour sur cet élément';
  }
  // Tête : titre, élément visé (poignée, icône du type, libellé sur une ligne, complet en info-bulle) et,
  // pour plusieurs éléments, la ligne d'aide « ⌘+clic : ajouter ou retirer un élément ».
  function majTete(pop, meta, zone) {
    var n = nbCibles(meta);
    pop.querySelector('.cm-titre').textContent = titreFenetre(meta);
    pop.querySelector('.cm-zone').innerHTML =
      '<span class="cm-poignee" aria-hidden="true">' + icone('DotsSixVertical', 14) + '</span>' +
      icone(n > 1 ? 'SelectionPlus' : meta && meta.type === 'box' ? 'BoundingBox' : meta && meta.type === 'text' ? 'TextT' : 'CursorClick', 14, 'cm-type') +
      '<span class="cm-zone-txt"></span>';
    var txt = pop.querySelector('.cm-zone-txt');
    txt.textContent = zone || '';
    txt.title = zone || '';
    var aide = pop.querySelector('.cm-aide-multi');
    aide.hidden = !(n > 1 && !pop.classList.contains('cm-locked'));
  }
  var AIDE_MULTI = '<span class="wm-repere">' + (IS_MAC ? icone('Command', 12) + '<span class="wm-lu">cmd</span>' : 'ctrl') + '</span>' +
    '<span>+clic : ajouter ou retirer un élément</span>';

  function openPopup(x, y, zone, meta) {
    closePopup(true); // (efface aussi la couleur "actif" de la bulle précédente)
    applyTheme();     // le fond du site a pu changer sans que rien ne le signale
    var isEdit = !!(meta && meta.existing);
    var locked = isEdit && !isEditable(meta.existing);           // signalé / pris en compte / complément / résolu : lecture seule
    var askReply = isEdit && meta.existing.status === 'complement'; // … sauf qu'on peut répondre à un complément
    var ex = isEdit ? meta.existing : null;
    setFocused(isEdit ? ex.id : null);
    if (meta && meta.outlineEl) showEditOutline(meta.outlineEl);
    if (isEdit && meta.type === 'box') meta.boxEl = document.querySelector('.cm-box-saved[data-id="' + ex.id + '"]'); // (re)trouvé après un éventuel re-rendu
    if (!locked && meta && meta.type === 'box' && meta.boxEl && meta.box) makeBoxEditable(meta.boxEl, meta);
    var libelleTouche = askReply ? 'enregistrer la réponse' : LIVE ? 'envoyer' : 'enregistrer';
    var repere = '<span class="wm-repere" aria-hidden="true">' + icone('ArrowElbowDownLeft', 12) + '</span>';
    var shot = isEdit && ex.shot && ex.shot.dataUrl ? ex.shot : null;
    var enCapture = isEdit && !shot && capturesEnCours[ex.id];   // fiche Etats, Léa 3.7 : « capture… » pendant la capture
    var vignette = shot ? '<div class="cm-vignette-ligne"><button type="button" class="cm-vignette" title="agrandir la capture" aria-label="agrandir la capture">' +
      '<span class="cm-vignette-face"><img alt="capture de la zone"></span></button><span class="cm-vignette-meta">capture de la zone · ' +
      (shot.width || '?') + ' × ' + (shot.height || '?') + ' · ' + Math.max(1, Math.round(shot.dataUrl.length * 0.75 / 1024)) + ' ko</span></div>' : enCapture ? captureEnCoursHtml() : '';
    var corps;
    if (askReply) {
      // Complément demandé (mode maquette) : le retour, la question de l'équipe en creux, le champ de réponse.
      corps = '<div class="cm-texte-lu">« ' + cmEsc(ex.text) + ' »</div>' +
        '<div class="cm-feedback cm-feedback-q"><div class="cm-feedback-titre">' + icone('Question', 14) + '<b>complément demandé :</b></div>' +
        '<div class="cm-feedback-msg">« ' + cmEsc(ex.complementMessage || 'Peux-tu préciser ?') + ' »</div></div>' +
        '<span class="wm-champ cm-champ-reponse"><textarea class="cm-reply-ta" placeholder="ta réponse… (entrée : enregistrer)"></textarea></span>';
    } else if (locked) {
      // Lecture seule : verrou, texte entre « », catégorie en méta ; une seule action, « fermer ».
      corps = '<div class="cm-lock-line">' + icone('LockSimple', 14) + '<b>' + cmEsc(nomStatut(ex)) + '</b> <span>· non modifiable</span></div>' +
        '<div class="cm-texte-lu">« ' + cmEsc(ex.text) + ' »</div>' + vignette +
        '<div class="cm-meta-lu" title="catégorie">' + icone(categoryOf(ex.category).icon, 14) + '<span>' + cmEsc(nomCategorie(ex.category)) + '</span></div>';
    } else {
      corps = '<span class="cm-libelle" id="cmLibChamp">ce que tu as remarqué</span>' +
        '<span class="wm-champ"><textarea aria-labelledby="cmLibChamp" placeholder="ta remarque, ta question ou ta critique… (maj+entrée : nouvelle ligne)">' + (isEdit ? cmEsc(ex.text) : '') + '</textarea></span>' +
        '<div class="cm-refus" role="status" hidden>' + icone('Info', 14) + '<span>' + (LIVE ? "écris ton retour avant d'envoyer." : "écris ton retour avant d'enregistrer.") + '</span></div>' +
        vignette +
        '<span class="cm-libelle cm-libelle-cat" id="cmCatLibelle">catégorie</span>' +
        '<div class="cm-cat-bloc"><button type="button" class="cm-cat wm-touche" aria-expanded="false" aria-controls="cmCatListe" title="catégorie : proposée d\'après ton texte, à changer si besoin">' +
          '<span class="cm-cat-ico" aria-hidden="true"></span><span class="cm-cat-nom"></span><span class="cm-cat-auto" title="proposée automatiquement">auto</span><span class="cm-cat-caret" aria-hidden="true"></span></button>' +
        '<div class="cm-cat-liste" id="cmCatListe" role="group" aria-labelledby="cmCatLibelle" hidden>' +
          CATEGORIES.map(function (cat) {
            return '<button type="button" class="cm-cat-choix wm-touche" data-cat="' + cat.key + '" aria-pressed="false">' + icone(cat.icon, 14) + '<span>' + cmEsc(cat.label.toLowerCase()) + '</span></button>';
          }).join('') + '</div></div>';
    }
    var avecCorbeille = isEdit && !locked && supprimable(ex);
    var pop = document.createElement('div');
    pop.className = 'cm-popup cm-ui' + (locked ? ' cm-locked' : '');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-labelledby', 'cmTitreFenetre');
    pop.innerHTML =
      '<div class="cm-tete" title="glisse pour déplacer la fenêtre">' +
        '<div class="cm-tete-l1"><span class="cm-titre" id="cmTitreFenetre"></span>' +
        '<button type="button" class="cm-fermer wm-cercle" aria-label="annuler" title="annuler">' + icone('X', 14) + '</button></div>' +
        '<div class="cm-zone"></div><div class="cm-aide-multi" hidden>' + AIDE_MULTI + '</div>' +
      '</div>' +
      '<div class="cm-corps">' + corps +
        '<div class="cm-popup-actions">' +
        (avecCorbeille ? '<button type="button" class="cm-delete wm-cercle" title="supprimer ce retour" aria-label="supprimer ce retour">' + icone('Trash', 15) + '</button>' : '') +
        '<button type="button" class="cm-cancel wm-texte">' + (locked && !askReply ? 'fermer' : 'annuler') + '</button>' +
        (locked && !askReply ? '' : '<button type="button" class="cm-save wm-touche wm-principale" disabled>' + libelleTouche + repere + '</button>') +
        '</div>' +
      '</div>';
    majTete(pop, meta, zone);
    if (shot && pop.querySelector('.cm-vignette')) {               // (pas de vignette dans la fenêtre d'un complément)
      pop.querySelector('.cm-vignette img').src = shot.dataUrl;
      pop.querySelector('.cm-vignette').onclick = function (e) { e.stopPropagation(); window.cmShowShot(ex.id, this); };
    }
    habiller(pop);
    document.body.appendChild(pop);
    tracerContour(pop);                                             // tout de suite, sans attendre l'observateur
    placePopup(pop, targetRectOf(meta), x, y);
    pop._meta = meta;
    makePopupDraggable(pop, pop.querySelector('.cm-tete'));
    var fermer = function (e) { e.stopPropagation(); closePopup(true); };
    pop.querySelector('.cm-fermer').onclick = fermer;
    pop.querySelector('.cm-cancel').onclick = fermer;
    var ta = locked ? null : pop.querySelector('textarea');
    var save = pop.querySelector('.cm-save');
    // Le champ grandit avec le texte (sans poignée), jusqu'à 240 px, puis défile.
    function ajuster(t) { t.style.height = 'auto'; t.style.height = Math.min(240, Math.max(64, t.scrollHeight + 2)) + 'px'; }
    if (askReply) {
      var rta = pop.querySelector('.cm-reply-ta');
      rta.focus();
      var majReponse = function () { save.disabled = !rta.value.trim(); };
      rta.addEventListener('input', majReponse);
      rta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (addReply(ex, rta.value.trim())) closePopup(true); }
      });
      save.onclick = function (e) { e.stopPropagation(); if (addReply(ex, rta.value.trim())) closePopup(true); };
    }
    if (locked) { pendingPopup = pop; return; }

    ta.focus();
    if (isEdit) { var vlen = ta.value.length; ta.setSelectionRange(vlen, vlen); ajuster(ta); }
    var refus = pop.querySelector('.cm-refus');
    function majTouche() {
      save.disabled = !ta.value.trim();
      if (ta.value.trim()) refus.hidden = true;                    // la phrase disparaît dès la première lettre
    }
    majTouche();

    // Catégorie (I4) : proposée pendant la frappe tant que la personne ne l'a pas choisie elle-même.
    var catBtn = pop.querySelector('.cm-cat'), catListe = pop.querySelector('.cm-cat-liste');
    var choix = Array.prototype.slice.call(pop.querySelectorAll('.cm-cat-choix'));
    var catTouched = !!(isEdit && ex.categoryManual);
    var catVal = isEdit && ex.category ? ex.category : categorize(ta.value);
    function majCategorie() {
      var cat = categoryOf(catVal), nom = nomCategorie(catVal);
      catBtn.dataset.cat = cat.key;
      catBtn.querySelector('.cm-cat-ico').innerHTML = icone(cat.icon, 16);
      catBtn.querySelector('.cm-cat-nom').textContent = nom;
      catBtn.querySelector('.cm-cat-auto').hidden = catTouched;
      catBtn.setAttribute('aria-label', 'catégorie : ' + nom + (catTouched ? '' : ', proposée automatiquement'));
      choix.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-cat') === cat.key ? 'true' : 'false'); });
    }
    function deplier(ouvert, focusChoix) {
      catListe.hidden = !ouvert;
      catBtn.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
      catBtn.querySelector('.cm-cat-caret').innerHTML = icone(ouvert ? 'CaretUp' : 'CaretDown', 14);
      if (ouvert) {
        recalerFenetre(pop);
        if (focusChoix) (pop.querySelector('.cm-cat-choix[aria-pressed="true"]') || choix[0]).focus();
      }
    }
    majCategorie(); deplier(false);
    catBtn.onclick = function (e) { e.stopPropagation(); deplier(catListe.hidden, false); };
    catBtn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); deplier(true, true); }
    });
    choix.forEach(function (b, i) {
      b.onclick = function (e) {
        e.stopPropagation();
        catVal = b.getAttribute('data-cat'); catTouched = true;
        majCategorie(); deplier(false); catBtn.focus();
      };
      b.addEventListener('keydown', function (e) {
        var k = e.key, j = null;
        if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % choix.length;
        else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + choix.length) % choix.length;
        else if (k === 'Home') j = 0;
        else if (k === 'End') j = choix.length - 1;
        else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); deplier(false); catBtn.focus(); return; } // referme les catégories, pas la fenêtre
        if (j !== null) { e.preventDefault(); choix[j].focus(); }
      });
    });

    ta.addEventListener('input', function () {
      if (!catTouched) { catVal = categorize(ta.value); majCategorie(); }
      majTouche(); ajuster(ta); recalerFenetre(pop);
    });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (save.disabled) { refus.hidden = false; return; }     // rien ne part, la fenêtre reste ouverte (Léa 3.7)
        save.click();
      }
    });

    if (avecCorbeille) {
      pop.querySelector('.cm-delete').onclick = function (e) {
        e.stopPropagation();
        endBoxEdit(meta);
        setFocused(null);
        window.cmDeleteById(ex.id);
        hideEditOutline();
        pop.remove();
        pendingPopup = null;
      };
    }
    save.onclick = function (e) {
      e.stopPropagation();
      var text = ta.value.trim();
      if (!text) { refus.hidden = false; return; }
      endBoxEdit(meta);
      var savedId = null;
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
        savedId = ex.id;
        ex.text = text;
        ex.category = catVal;
        ex.categoryManual = catTouched;
        if (desc) { ex.zone = desc.label; ex.anchor = desc.anchor; ex.fallback = meta.box; (function (c2, bx) { setTimeout(function () { captureFor(c2, bx, function () { c2.sync = null; scheduleSync(c2); }); }, 60); })(ex, meta.box); }
        if (multi) { ex.zone = multi.zone; ex.anchor = multi.anchor; ex.fallback = multi.fallback; ex.targets = multi.targets; }
        if (desc || multi) { var prev = ex.tech || {}; ex.tech = captureTech(ex); ex.tech.date = prev.date || ex.tech.date; ex.tech.consoleErrors = prev.consoleErrors || []; }
        cmStatus(SYNC ? 'retour modifié, envoi en cours.' : 'retour modifié.', { type: SYNC ? 'encours' : 'fait' });
        if (!desc) { ex.sync = null; scheduleSync(ex); } // encadré ajusté : renvoyé après la nouvelle capture
      } else {
        var id = uid();
        savedId = id;
        var c = { id: id, type: meta.type, status: 'nouveau', page: PAGE_FILE, path: location.pathname, pageTitle: document.title || PAGE_TITLE, zone: desc ? desc.label : zone, text: text, date: new Date().toISOString() };
        c.vuLe = c.date;   // un retour tout juste écrit n'a rien de nouveau (C5)
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
        c.category = catVal;
        c.categoryManual = catTouched;
        c.tech = captureTech(c);
        if (AUTHOR) c.author = AUTHOR;   // l'auteur du moment, gravé sur le ticket
        allComments.push(c);
        cmStatus(SYNC ? 'retour enregistré, envoi en cours.' : 'retour enregistré.', { type: SYNC ? 'encours' : 'fait' });
        if (meta.type === 'box') { if (meta.boxEl) meta.boxEl.classList.remove('cm-box-editable'); setTimeout(function () { captureFor(c, c.fallback, function () { scheduleSync(c); }); }, 60); }
        else scheduleSync(c);
      }
      persist(); renderMarkers(); renderList();
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
    // Clic sur un autre élément pendant la saisie : il remplacerait la fenêtre ouverte. Confirmation si son
    // texte n'est pas parti (décision d'Enzo du 25/10) ; refusée, le clic ne fait rien. ⌘/ctrl+clic ajoute
    // un élément à la fenêtre en cours sans la fermer : pas de question.
    var ajoutMulti = (e.metaKey || e.ctrlKey) && pendingPopup && pendingPopup._meta && pendingPopup._meta.type === 'pin';
    if (!ajoutMulti && fenetreModifiee()) {
      e.preventDefault(); dragging = false;
      if (!confirmerAbandon()) return;
      closePopup(true);
    }
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
      // En tracé : rectangle de 1 px en pointillés, à l'encre du fond sous le point de départ (T7).
      dragBoxEl.className = 'cm-box cm-ui' + (fondSombreSous(pageElementAt(dragStart.x - window.scrollX, dragStart.y - window.scrollY)) ? ' wm-sur-sombre' : '');
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
    if (meta.existing && !isEditable(meta.existing)) { cmStatus(statusLabel(meta.existing) + ' : non modifiable.'); return; }
    var zone = detectZone(target);
    if (!zone.el) return;
    meta.targets = meta.targets || [];
    var idx = -1;
    meta.targets.forEach(function (t, i) { if (t.el === zone.el) idx = i; });
    if (idx >= 0) { if (meta.targets.length === 1) return; meta.targets.splice(idx, 1); }
    else meta.targets.push({ el: zone.el, label: zone.label });
    meta.targetsChanged = true;
    showEditOutline(meta.targets.map(function (t) { return t.el; }));
    majTete(pendingPopup, meta, multiLabel(meta.targets));
    tracerContour(pendingPopup);
    cmStatus(meta.targets.length > 1 ? meta.targets.length + ' éléments sélectionnés · ' + (MULTI_KEY === '⌘' ? '⌘' : 'ctrl') + '+clic pour en ajouter ou en retirer' : '1 élément sélectionné');
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

  /* Une fenêtre dont le texte n'est pas parti (nouveau texte, texte modifié, réponse commencée). */
  function fenetreModifiee() {
    if (!pendingPopup) return false;
    var meta = pendingPopup._meta || {};
    var ta = pendingPopup.querySelector('textarea:not(.cm-reply-ta)');
    var rep = pendingPopup.querySelector('textarea.cm-reply-ta');
    var avant = meta.existing ? String(meta.existing.text || '').trim() : '';
    var texte = ta && !ta.readOnly ? ta.value.trim() : '';
    return !!(texte && texte !== avant) || !!(rep && rep.value.trim());
  }
  /* Confirmation de Léa (3.9, décision 34) quand un geste qui vise autre chose ferme une fenêtre au texte
     non parti : bouton witmit, bouton du mode, ⌥+A, ⌥ deux fois, « terminer », clic sur un autre élément pendant
     la saisie (décision d'Enzo du 25/10). Jamais pour échap ni « annuler ». */
  function confirmerAbandon() {
    return !fenetreModifiee() || window.confirm("fermer quand même ? ce que tu viens d'écrire n'est pas parti et sera perdu.");
  }
  function listeOuverte() {
    var panel = document.getElementById('cmPanel');
    return !!(panel && panel.classList.contains('show'));
  }
  /* État des deux boutons (C6, Léa 3.1) : bouton du mode enfoncé = mode actif (aria-pressed), bouton witmit
     enfoncé = liste ouverte (aria-expanded), quel que soit le geste qui a changé l'état. */
  function majBoutons() {
    var tb = document.getElementById('cmToggleBtn');
    if (tb) {
      tb.setAttribute('aria-pressed', active ? 'true' : 'false');
      tb.classList.toggle('cm-on', active);
      tb.title = active ? "terminer l'annotation · " + RACC_ANNOTER + ' ou échap' : 'mode annotation · ' + RACC_ANNOTER;
      // Boutons fournis par une maquette : leurs deux faces (💬 / ✕) suivent le mode, s'ils les ont.
      var off = tb.querySelector('.cm-btn-off'), on = tb.querySelector('.cm-btn-on');
      if (off) off.style.display = active ? 'none' : 'inline';
      if (on) on.style.display = active ? 'inline' : 'none';
    }
    var pb = document.getElementById('cmPanelBtn');
    if (pb) {
      var ouverte = listeOuverte();
      pb.setAttribute('aria-expanded', ouverte ? 'true' : 'false');
      pb.removeAttribute('aria-pressed');
      pb.classList.toggle('cm-on', ouverte);
      pb.title = 'witmit : tes retours sur cette page';
      pb.setAttribute('aria-label', nomBoutonWitmit());
    }
  }
  /* Nom accessible du bouton witmit (Léa 3.1) : « witmit », ou « witmit, 2 nouveaux retours ». */
  var nbNouveaux = 0;
  function nomBoutonWitmit() {
    if (!nbNouveaux) return 'witmit';
    return 'witmit, ' + nbNouveaux + (nbNouveaux > 1 ? ' nouveaux retours' : ' nouveau retour');
  }

  /* Mode annotation. cmToggle(true | false) : réglage direct (clic sur une ligne de la liste, révélation,
     Échap…). cmToggle() sans argument : le geste du bouton du mode et de ⌥+A (K1) — lancer le mode ferme
     la liste ; l'arrêter ferme la fenêtre, après confirmation si son texte n'est pas parti. */
  window.cmToggle = function (force) {
    var geste = typeof force !== 'boolean';
    var cible = geste ? !active : force;
    if (geste && !cible && !confirmerAbandon()) return;
    if (geste && cible && listeOuverte()) cmTogglePanel(false);
    active = cible;
    document.body.classList.toggle('cm-active', active);
    document.getElementById('cmFrame').classList.toggle('show', active);
    document.getElementById('cmPill').classList.toggle('show', active);
    placerBandeau();
    // Les repères ne se dessinent qu'en mode annotation : les épingles sont replacées d'après la page telle
    // qu'elle est maintenant (elle a pu bouger pendant que les repères étaient cachés).
    if (active) renderMarkers();
    if (!active) {
      clearTimeout(clickTimer);
      closePopup(true);
      if (dragBoxEl) { dragBoxEl.remove(); dragBoxEl = null; }
      dragging = false;
      var s = window.getSelection(); if (s) s.removeAllRanges();
    }
    majBoutons();
  };
  /* « terminer » du bandeau : arrête le mode (confirmation si la fenêtre a un texte non parti). */
  window.cmTerminer = function () {
    if (!confirmerAbandon()) return;
    cmToggle(false);
  };
  /* Touche « nouveau retour » et touche N (liste ouverte) : ferme la liste et lance le mode, ne l'arrête jamais. */
  window.cmNouveauRetour = function () {
    if (listeOuverte()) cmTogglePanel(false);
    if (!active) cmToggle(true);
  };

  /* Liste. cmTogglePanel() sans argument : le geste du bouton witmit — il ouvre ou ferme la liste, rien
     d'autre (le mode actif continue) ; ouvrir ferme la fenêtre, après confirmation si son texte n'est pas
     parti. Liste ouverte, les deux boutons passent à sa gauche, toujours visibles et cliquables. */
  window.cmTogglePanel = function (force) {
    var panel = document.getElementById('cmPanel');
    var show = (typeof force === 'boolean') ? force : !panel.classList.contains('show');
    if (typeof force !== 'boolean' && show && !confirmerAbandon()) return;
    if (show) {
      applyTheme();
      // Ouvrir le tiroir abandonne une bulle non enregistrée (et un clic simple encore en attente)
      clearTimeout(clickTimer); clickTimer = null;
      closePopup(true);
      flushPending(); refreshStatuses();
    }
    var etaitOuverte = panel.classList.contains('show');
    panel.classList.toggle('show', show);
    if (!show && !pendingPopup) setFocused(null);
    if (!show && etaitOuverte) marquerVus();                      // le voyant s'éteint quand on ferme la liste après l'avoir vue (C5)
    // Mode « pousser » au-dessus de 480 px (C7) ; en dessous, la liste couvre l'écran sans pousser la page (M1).
    var etroit = window.matchMedia && window.matchMedia('(max-width:480px)').matches;
    if (CONFIG.drawer === 'push') pushPage(show && !etroit ? panel.offsetWidth : 0);
    placerBoutons();
    placerBandeau();
    placerStatus();
    majBoutons();
  };
  function placerBoutons() {
    var fab = document.querySelector('.cm-fab');
    if (!fab) return;
    var panel = document.getElementById('cmPanel');
    if (!listeOuverte()) { fab.style.right = ''; fab.style.bottom = ''; fab.classList.remove('wm-decale'); return; }
    var etroit = window.matchMedia && window.matchMedia('(max-width:480px)').matches;
    var base = etroit ? 16 : 24;   // marge de la fiche (M1 sous 480 px)
    var vw = document.documentElement.clientWidth;
    // Sous 480 px, la liste couvre l'écran (M1) : les boutons montent au-dessus de son pied, pour ne pas cacher « nouveau retour ».
    var pied = document.getElementById('cmPanelPied');
    fab.style.bottom = etroit && pied ? (pied.offsetHeight + 12) + 'px' : '';
    // À 24 px à gauche de la liste ; sur un écran trop étroit, au plus près du bord gauche, par-dessus la liste.
    var right = Math.min(panel.offsetWidth + base, vw - fab.offsetWidth - 16);
    fab.style.right = Math.max(base, right) + 'px';
    fab.classList.add('wm-decale');
  }
  window.addEventListener('resize', placerBoutons);
  /* Message passager, liste ouverte sur ordinateur : il monte à 84 px du bas (au-dessus des deux boutons, décalés à
     gauche de la liste) et se centre dans l'espace libre à gauche de la liste, comme le bandeau (placeLibreBandeau).
     Liste fermée ou écran étroit : la règle CSS (20 px, ou 84 px sous 680 px). */
  function placerStatus() {
    var el = document.getElementById('cmStatus');
    if (!el) return;
    var etroit = window.matchMedia && window.matchMedia('(max-width:480px)').matches;
    if (!listeOuverte() || etroit) { el.style.bottom = ''; el.style.left = ''; el.style.maxWidth = ''; return; }
    var libre = placeLibreBandeau();
    el.style.bottom = '84px';
    el.style.left = Math.round(libre / 2) + 'px';
    el.style.maxWidth = 'min(420px, ' + Math.max(200, libre - 16) + 'px)';
  }
  window.addEventListener('resize', placerStatus);

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
      if (el.closest('#cmPanel, #cmFrame, #cmPill, #cmStatus, #cmLinks, .cm-popup, .cm-pin, .cm-box, .cm-fab, .cm-lightbox')) continue; // (les boutons de witmit : placerBoutons)
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
  window.addEventListener('resize', function () {
    if (!pushWidth) return;
    var panel = document.getElementById('cmPanel');
    pushPage(window.matchMedia && window.matchMedia('(max-width:480px)').matches ? 0 : (panel ? panel.offsetWidth : pushWidth));
  });

  // Un clic en dehors du tiroir "Commentaires" le referme — et ne fait QUE ça : il ne crée pas
  // d'annotation (ce listener est enregistré avant onMouseDown, il passe donc en premier).
  var swallowClick = false;
  document.addEventListener('mousedown', function (e) {
    var panel = document.getElementById('cmPanel');
    if (!panel || !panel.classList.contains('show')) return;
    if (panel.contains(e.target)) return;
    if (e.target.closest && e.target.closest('#cmPanelBtn, .cm-lightbox')) return;   // la visionneuse s'ouvre par-dessus la liste
    cmTogglePanel(false);
    swallowClick = active && !inUi(e.target);
  }, true);

  /* ---------- bandeau du mode annotation : place, deux lignes, déplacement (fiche Bandeau) ----------
     Centré sur la place libre, à 12 px sous la barre de navigation (CSS). Liste ouverte (au-dessus de 480 px), la
     place libre s'arrête à la liste : le bandeau se centre à sa gauche et ne la recouvre pas, comme les deux
     boutons qui passent à sa gauche (relecture du lot 1). S'il ne tient pas sur une ligne dans cette place, il
     passe sur deux lignes. Déplacé par la poignée, il garde sa position (witmit_pill_pos), ramenée dans la place
     libre sans l'écraser. */
  var PILL_POS_KEY = 'witmit_pill_pos';
  var posBandeau = null;
  try {
    var posLue = JSON.parse(localStorage.getItem(PILL_POS_KEY) || 'null');
    if (posLue && typeof posLue.left === 'number' && typeof posLue.top === 'number') posBandeau = posLue;
  } catch (e) {}
  function placeLibreBandeau() {
    var vw = document.documentElement.clientWidth || window.innerWidth;
    var panel = document.getElementById('cmPanel');
    var etroit = window.matchMedia && window.matchMedia('(max-width:480px)').matches;
    var libre = vw;
    if (listeOuverte() && !etroit && panel) libre = vw - panel.offsetWidth - 8;
    return libre < 360 ? vw : libre;   // trop peu de place à côté de la liste : par-dessus, comme avant
  }
  function placerBandeau() {
    var pill = document.getElementById('cmPill');
    if (!pill || !pill.classList.contains('show')) return;
    var libre = placeLibreBandeau();
    pill.style.maxWidth = (libre - 16) + 'px';
    pill.classList.remove('wm-deux-lignes');
    pill.style.left = '0px'; pill.style.transform = 'none';
    var deux = pill.offsetWidth > libre - 32;
    pill.classList.toggle('wm-deux-lignes', deux);
    var w = pill.offsetWidth, h = pill.offsetHeight;
    var left, top = null;
    if (posBandeau) {
      left = Math.max(4, Math.min(posBandeau.left, libre - w - 4));
      top = Math.max(4, Math.min(posBandeau.top, window.innerHeight - h - 4));
    } else left = Math.max(8, Math.round((libre - w) / 2));
    pill.style.left = left + 'px';
    pill.style.top = top === null ? '' : top + 'px';
  }
  window.addEventListener('resize', placerBandeau);
  // Une police du système peut finir de se charger après coup : la largeur du bandeau change.
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', placerBandeau);

  (function initPillDrag() {
    var pill = document.getElementById('cmPill');
    if (!pill) return;
    var dragOffset = null;
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
      var left = Math.max(4, Math.min(e.clientX - dragOffset.x, window.innerWidth - pill.offsetWidth - 4));
      var top = Math.max(4, Math.min(e.clientY - dragOffset.y, window.innerHeight - pill.offsetHeight - 4));
      pill.style.left = left + 'px'; pill.style.top = top + 'px'; pill.style.transform = 'none';
    });
    function endDrag() {
      if (!dragOffset) return;
      dragOffset = null;
      pill.classList.remove('cm-dragging');
      var r = pill.getBoundingClientRect();
      posBandeau = { left: r.left, top: r.top };
      try { localStorage.setItem(PILL_POS_KEY, JSON.stringify(posBandeau)); } catch (err) {}
    }
    pill.addEventListener('pointerup', endDrag);
    pill.addEventListener('pointercancel', endDrag);
  })();

  /* ---------- raccourcis (K1 à K6) ----------
     ⌥ deux fois / alt deux fois (live) montre et cache witmit (décision de François du 25/10 après-midi, à
     la place de l'ancien raccourci avec la lettre W, voisin de ⌘+W qui ferme l'onglet) ; ⌥+A / alt+A lance et arrête le mode annotation (witmit
     caché : rien, la touche reste au site) ; N, liste ouverte, ferme la liste et lance le mode ; Échap ferme
     une couche à la fois. Pour ⌥+A, on lit la LETTRE produite par la touche (e.key), pas sa position : sur un
     clavier AZERTY, la position « KeyA » est celle du Q. Sur Mac, ⌥ change la lettre : table ci-dessous ; un
     caractère relevé en plus s'ajoute en une ligne. Repli par la position (e.code) seulement si e.key n'est
     pas une lettre (symbole hors table, touche morte). Jamais pendant la saisie dans un champ, du site ou
     de witmit ; preventDefault seulement quand witmit agit (jamais sur alt seule), jamais stopPropagation. */
  var LETTRES = {
    a: ['a', 'å', 'æ']    // Windows/Linux · Mac QWERTY (⌥+A) · Mac AZERTY (⌥+A : « Æ », relevé le 25/10, ou « æ » ; comparé en minuscules)
  };
  var CARTE = null;       // position → lettre de base de la touche (navigateurs Chromium : Chrome, Edge…)
  function lireCarte() {
    try { navigator.keyboard.getLayoutMap().then(function (m) { CARTE = m; }, function () {}); } catch (e) {}
  }
  lireCarte(); window.addEventListener('focus', lireCarte);
  function lettreDuRaccourci(e) {
    var k = (e.key || '').toLowerCase();
    for (var l in LETTRES) if (LETTRES[l].indexOf(k) >= 0) return l;
    if (k.length === 1 && k.toUpperCase() !== k) return null;        // une autre lettre (Ω, Â, œ) : une autre touche
    if (CARTE) { var b = CARTE.get(e.code); return b === 'a' ? b : null; }
    if (k === 'dead' || k === 'unidentified') return { KeyA: 'a', KeyQ: 'a' }[e.code] || null;
    return null;
  }
  // La saisie : l'élément qui a vraiment reçu la touche (composedPath : un champ dans un shadow DOM compte).
  function enSaisie(e) {
    var el = (e.composedPath && e.composedPath()[0]) || e.target;
    if (!el || el.nodeType !== 1) el = e.target;
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;
    return /^(textbox|searchbox|combobox)$/.test(el.getAttribute('role') || '');
  }
  /* Double ⌥ : deux appuis sur alt seule (e.key 'Alt' ; 'AltGraph' exclu), chacun relâché, sans autre touche
     ni clic entre les deux, en moins de DOUBLE_ALT_MS du premier appui au second ; l'effet part au second
     relâchement. Annulé par : une autre touche (⌥+A tapé deux fois ne fait donc rien ici), ctrl, ⌘ ou maj
     avec alt (ctrl+alt = AltGr sous Windows), une touche maintenue (e.repeat), un appui dans un champ, un
     clic, la perte du focus de la fenêtre. Aucun preventDefault : sous Windows, alt sert aussi au menu du
     navigateur. */
  var DOUBLE_ALT_MS = 400;
  var altAppui = null;    // appui sur alt en cours : { t: heure du keydown, net: aucune autre touche depuis }
  var altPremier = 0;     // heure du premier appui net et relâché ; 0 : aucun en attente
  function annulerDoubleAlt() { altPremier = 0; if (altAppui) altAppui.net = false; }
  function altSeule(e) { return e.key === 'Alt' && !e.ctrlKey && !e.metaKey && !e.shiftKey; }
  function suivreDoubleAlt(e) {
    if (e.key !== 'Alt' || e.repeat || e.isComposing || !altSeule(e) || enSaisie(e)) { annulerDoubleAlt(); return; }
    if (altPremier && e.timeStamp - altPremier >= DOUBLE_ALT_MS) altPremier = 0;
    altAppui = { t: e.timeStamp, net: true };
  }
  document.addEventListener('keyup', function (e) {
    if (e.key !== 'Alt') return;
    var appui = altAppui;
    altAppui = null;
    if (!appui || !appui.net || !altSeule(e)) { altPremier = 0; return; }
    if (altPremier && appui.t - altPremier < DOUBLE_ALT_MS) { altPremier = 0; basculerWitmit(); }
    else altPremier = appui.t;
  });
  window.addEventListener('pointerdown', annulerDoubleAlt, true);
  window.addEventListener('blur', function () { altAppui = null; altPremier = 0; });
  // Montrer ou cacher (live), comme « masquer witmit » et ?witmit=on ; en maquette, rien (Léa 44).
  function basculerWitmit() {
    if (!LIVE) return;
    var cache = document.body.classList.contains('cm-concealed');
    if (!cache && !confirmerAbandon()) return;
    cmReveal(cache);
  }
  document.addEventListener('keydown', function (e) {
    suivreDoubleAlt(e);
    if (e.key === 'Alt') return;                                      // alt seule : rien d'autre, touche laissée au navigateur
    if (e.isComposing) return;
    // Échap, de la couche la plus proche à la plus lointaine : la fenêtre, la visionneuse, la liste, le mode.
    // (Dans un champ du tiroir — réponse, modification — Échap annule d'abord ce champ, sans aller plus loin.)
    if (e.key === 'Escape') {
      if (visionneuse) { e.preventDefault(); fermerVisionneuse(); }   // au-dessus de tout, fenêtre comprise
      else if (pendingPopup) {
        e.preventDefault();
        var ouvreuse = epingleOuvreuse;
        closePopup(true);
        // Comme la visionneuse : le focus revient à l'épingle qui avait ouvert la fenêtre.
        var pinOuvreuse = ouvreuse && document.querySelector('.cm-pin:not(.cm-pin-secondary)[data-id="' + ouvreuse + '"]');
        if (pinOuvreuse) pinOuvreuse.focus();
      }
      else if (listeOuverte()) { e.preventDefault(); cmTogglePanel(false); }
      else if (active) { e.preventDefault(); cmToggle(false); }
      return;
    }
    if (e.repeat || enSaisie(e)) return;
    var cache = LIVE && document.body.classList.contains('cm-concealed');
    // N : liste ouverte, sans aucune touche de modification.
    if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key || '').toLowerCase() === 'n') {
      if (cache || !listeOuverte()) return;
      e.preventDefault();
      cmNouveauRetour();
      return;
    }
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;   // alt seule (ctrl+alt = AltGr sous Windows)
    var lettre = lettreDuRaccourci(e);
    if (lettre === 'a') {
      if (cache) return;                                              // witmit caché : la touche reste au site (Léa 43)
      e.preventDefault();
      cmToggle();
    }
  });
  majBoutons();

  var statusTimer = null;
  var masquageTimer = null;
  var attenteTimer = null, toastEnAttente = null, echecJusqua = 0;
  var ICONE_TOAST = { fait: ['Check'], encours: ['CircleNotch', 'wm-tourne'], echec: ['WarningCircle', 'wm-signal'] };
  /* Message passager (fiche Etats ; Léa 3.9). opts.type : 'fait' (Check), 'encours' (CircleNotch), 'echec'
     (WarningCircle en signal, la phrase reste à l'encre) ; sans type : simple renseignement, sans icône.
     Durée : 2,4 s ; un échec reste au moins 6 s (opts.duree pour une autre durée). Un échec n'est pas effacé
     avant la fin de ses 6 s par un message qui n'en est pas un (« capture impossible » ne doit pas disparaître
     sous « retour envoyé ») : ce message attend la fin de l'échec. opts.masquage : le message de masquage,
     seul exempté du masquage de witmit (classe wm-toast-masquage), jusqu'à la fin de son fondu. */
  function cmStatus(msg, opts) {
    opts = opts || {};
    var echec = opts.type === 'echec';
    var maintenant = Date.now();
    if (!echec && !opts.masquage && maintenant < echecJusqua) {
      toastEnAttente = [msg, opts];
      clearTimeout(attenteTimer);
      attenteTimer = setTimeout(function () { var a = toastEnAttente; toastEnAttente = null; if (a) cmStatus(a[0], a[1]); }, echecJusqua - maintenant + 20);
      return;
    }
    var duree = opts.duree || (echec ? 6000 : 2400);
    echecJusqua = echec ? maintenant + duree : 0;
    if (echec || opts.masquage) { clearTimeout(attenteTimer); toastEnAttente = null; }   // un message plus ancien que l'échec ne revient pas après lui
    var el = document.getElementById('cmStatus');
    var txt = el.querySelector(':scope > .wm-contenu');
    if (!txt) { txt = document.createElement('span'); txt.className = 'wm-contenu'; el.appendChild(txt); }
    var ic = ICONE_TOAST[opts.type];
    txt.innerHTML = (ic ? icone(ic[0], 16, ic[1]) : '') + '<span class="wm-toast-texte"></span>';
    txt.lastChild.textContent = msg;
    clearTimeout(masquageTimer);
    el.classList.toggle('wm-toast-masquage', !!opts.masquage);
    el.classList.toggle('wm-toast-echec', echec);
    el.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      el.classList.remove('show');
      if (opts.masquage) masquageTimer = setTimeout(function () { el.classList.remove('wm-toast-masquage'); }, 250);
    }, duree);
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
    cmStatus('capture de la zone…', { type: 'encours' });
    capturesEnCours[c.id] = true; renderList();
    captureBox(box).then(function (img) {
      var live = findComment(c.id);
      if (!live) return;
      live.shot = { dataUrl: img.dataUrl, width: img.width, height: img.height, at: new Date().toISOString() };
      enforceImageBudget();
      persist(); renderList();
      cmStatus('capture enregistrée (' + Math.round(img.dataUrl.length / 1024) + ' ko).', { type: 'fait' });
    }).catch(function (err) {
      console.warn('witmit : capture impossible —', (err && err.message) || err);   // la raison brute, jamais à l'écran (Léa 3.11)
      cmStatus('capture impossible : ton retour est bien enregistré, sans image.', { type: 'echec' });
    }).then(function () { delete capturesEnCours[c.id]; renderList(); if (done) done(); });
  }
  /* Visionneuse (fiche Visionneuse ; Léa 3.9) : une fenêtre witmit centrée, sans voile ; la capture en grand.
     Fermée par la croix, Échap ou un clic à côté (ce clic ne fait rien d'autre) ; le clic sur l'image ne ferme
     plus. À l'ouverture, le focus va sur la croix ; à la fermeture, il revient à la vignette. */
  var visionneuse = null;
  function fermerVisionneuse() {
    if (!visionneuse) return;
    var v = visionneuse; visionneuse = null;
    window.removeEventListener('mousedown', v._aCote, true);
    v.el.remove();
    if (v.retour && v.retour.isConnected) { try { v.retour.focus({ preventScroll: true }); } catch (e) { v.retour.focus(); } }
  }
  window.cmShowShot = function (id, vignette) {
    var c = findComment(id);
    if (!c || !c.shot || !c.shot.dataUrl) return;
    fermerVisionneuse();
    var n = pageComments().indexOf(c) + 1;
    var type = c.type === 'box' ? 'zone' : c.type === 'text' ? 'texte' : 'élément';
    var ov = document.createElement('div');
    ov.className = 'cm-lightbox cm-ui';
    ov.innerHTML = '<div class="cm-lightbox-fenetre" role="dialog" aria-labelledby="cmLbTitre">' +
      '<div class="cm-lb-tete"><div class="cm-lb-l1"><span class="cm-lb-titre" id="cmLbTitre">Capture de la zone</span>' +
      '<button type="button" class="wm-cercle cm-lb-fermer" aria-label="fermer" title="fermer">' + icone('X', 14) + '</button></div>' +
      '<div class="cm-lb-meta"></div></div>' +
      '<div class="cm-lb-corps"><div class="cm-lb-image"><span class="cm-lb-face"><img alt="capture de la zone commentée"></span></div>' +
      '<div class="cm-lightbox-hint"><span class="wm-repere" aria-hidden="true">échap</span><span>ou clic à côté : fermer</span></div></div></div>';
    var fen = ov.firstChild;
    var meta = (n > 0 ? 'retour ' + n + ' · ' : '') + type + ' · ' + (c.zone || '') + ' · ' + dateCourte(c.date);
    fen.querySelector('.cm-lb-meta').textContent = meta;
    fen.querySelector('.cm-lb-meta').title = meta;
    var img = fen.querySelector('img');
    img.src = c.shot.dataUrl;
    // Largeur : celle de l'image + 44 px, au moins 360 px, au plus 92vw (et l'écran moins 16 px).
    if (c.shot.width) fen.style.width = 'min(' + Math.max(360, c.shot.width + 46) + 'px, 92vw, calc(100vw - 16px))';
    habiller(fen);
    document.body.appendChild(ov);
    tracerContour(fen);
    var aCote = function (e) {
      if (fen.contains(e.target)) return;
      e.preventDefault(); e.stopPropagation();                 // le clic à côté ferme, et ne fait rien d'autre
      window.addEventListener('click', function avaler(ev) { ev.preventDefault(); ev.stopPropagation(); window.removeEventListener('click', avaler, true); }, true);
      fermerVisionneuse();
    };
    window.addEventListener('mousedown', aCote, true);
    visionneuse = { el: ov, retour: vignette || null, _aCote: aCote };
    fen.querySelector('.cm-lb-fermer').onclick = function (e) { e.stopPropagation(); fermerVisionneuse(); };
    fen.querySelector('.cm-lb-fermer').focus();
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
      categorie: nomCategorie(c.category), statut: c.status,
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
    L.push('Généré le ' + new Date().toLocaleString('fr-FR') + ' · ' + items.length + (items.length > 1 ? ' retours' : ' retour') + ' sur ' + order.length + (order.length > 1 ? ' pages' : ' page') + ' · périmètre : ' + (full ? 'complet (tous statuts)' : 'nouveautés'));
    L.push('');
    var n = 0;
    order.forEach(function (page) {
      var grp = byPage[page];
      L.push('## Page : ' + grp.title + ' (`' + page + '`)');
      L.push('');
      grp.items.forEach(function (c) {
        n++;
        var st = c.status === 'nouveau' ? 'nouveau' : statusLabel(c);
        L.push('### #' + n + ' · ' + typeRapport(c.type) + ' : ' + c.zone + ' — ' + nomCategorie(c.category) + ' · ' + st + (c.supersedes ? ' · remplace la version du ' + frDate(c.supersedes) : ''));
        L.push('');
        if (c.author) { L.push('_Signalé par ' + c.author + '_'); L.push(''); }
        L.push(c.text);
        L.push('');
        if (c.complementMessage) { L.push('> Complément demandé' + (c.complementAt ? ' le ' + frDate(c.complementAt) : '') + ' : ' + c.complementMessage); }
        (c.replies || []).forEach(function (r) { L.push('> Réponse du ' + frDate(r.date) + ' : ' + r.text); });
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
    L.push('Termine ton traitement par un bloc de ce format (une ligne par retour, séparateur `|` avant un message facultatif). Il se colle dans witmit : bouton witmit → « coller un retour », en bas de la liste.');
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
    if (!items.length) { cmStatus(full ? 'aucun retour sur ce site.' : 'rien de nouveau à signaler. coche « rapport complet » pour tout exporter.'); return null; }
    var id = nextReportId();
    var md = buildReportMd(items, id, full);
    var toMark = items.filter(function (c) { return c.status === 'nouveau' || hasPendingReply(c); }).length;
    var marked = 0;
    if (toMark) {
      if (window.confirm('marquer ' + (toMark > 1 ? toMark + ' retours comme signalés' : '1 retour comme signalé') + ' dans le rapport ' + id + ' ? ' + (toMark > 1 ? 'ils ne seront plus modifiables' : 'il ne sera plus modifiable') + '. annuler : le rapport est créé ' + (toMark > 1 ? 'sans les marquer' : 'sans le marquer') + '.')) marked = markReported(items, id);
    }
    return { id: id, md: md, items: items, marked: marked };
  }
  function signales(n) { return n > 1 ? n + ' retours signalés' : '1 retour signalé'; }
  window.cmExport = function () {
    var r = prepareReport();
    if (!r) return;
    var blob = new Blob([r.md], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'witmit-' + CONFIG.project + '-' + r.id + '.md';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    cmStatus('rapport ' + r.id + ' téléchargé' + (r.marked ? ' · ' + signales(r.marked) : '') + '.', { type: 'fait' });
  };
  window.cmCopy = function () {
    var r = prepareReport();
    if (!r) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(r.md).then(function () {
        cmStatus('rapport ' + r.id + ' copié' + (r.marked ? ' · ' + signales(r.marked) : '') + '. colle-le à Claude.', { type: 'fait' });
      }).catch(function () { cmStatus('copie impossible : utilise « télécharger ».', { type: 'echec' }); });
    } else cmStatus('ce navigateur ne permet pas la copie : utilise « télécharger ».', { type: 'echec' });
  };
  window.cmSendMail = function () {
    if (!EMAIL_TO) { cmStatus('aucune adresse d\'envoi prévue pour ce site : utilise « télécharger » ou « copier ».', { type: 'echec' }); return; }
    var r = prepareReport();
    if (!r) return;
    var subject = CONFIG.project + ' — Rapport de retours ' + r.id + ' (' + r.items.length + ')';
    var mailto = 'mailto:' + EMAIL_TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(r.md);
    if (mailto.length > 1900) { cmStatus('rapport trop long pour un email : utilise « télécharger » ou « copier ».', { type: 'echec' }); return; }
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
      equipeAAgi(c);                                            // voyant (C5) : l'équipe a changé le statut
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
    var acc = function (n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); };
    cmStatus(acc(res.applied, 'retour mis à jour', 'retours mis à jour') + (res.unknown ? ' · ' + acc(res.unknown, 'identifiant inconnu', 'identifiants inconnus') : '') + (res.ignored ? ' · ' + acc(res.ignored, 'ligne ignorée', 'lignes ignorées') : ''), { type: 'fait' });
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
