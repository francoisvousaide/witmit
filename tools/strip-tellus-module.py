#!/usr/bin/env python3
"""Fabrique une copie d'une maquette TellUs SANS le module commentaires intégré (CSS + HTML + JS),
remplacé par une seule balise <script src=".../annotate.js" data-project="tellus">.
Usage : python3 tools/strip-tellus-module.py <maquette.html> <destination.html> <chemin_relatif_annotate.js>
Ne modifie jamais le fichier d'origine."""
import re, sys, pathlib

src, dst, js_rel = sys.argv[1], sys.argv[2], sys.argv[3]
html = pathlib.Path(src).read_text()

# 1) bloc CSS : de la ligne "MODULE COMMENTAIRES" jusqu'à juste avant </style>
html, n = re.subn(r"\n[ \t]*/\* ===== MODULE COMMENTAIRES v1 \(voir[^\n]*\n.*?(?=</style>)", "\n", html, count=1, flags=re.S)
assert n == 1, "bloc CSS introuvable"
# 2) fragment HTML : du cadre jusqu'à la div de statut incluse
html, n = re.subn(r'\n<div class="cm-frame cm-ui" id="cmFrame"></div>.*?<div class="cm-status cm-ui" id="cmStatus"></div>\n', "\n", html, count=1, flags=re.S)
assert n == 1, "fragment HTML introuvable"
# 3) bloc JS : le <script> contenant le module
html, n = re.subn(r"<script>\n/\* ===== MODULE COMMENTAIRES v1 — voir[^\n]*\n.*?</script>\n", "", html, count=1, flags=re.S)
assert n == 1, "bloc JS introuvable"
# 4) une seule ligne à la place
tag = '<script src="%s" data-project="tellus"></script>\n</body>' % js_rel
html, n = re.subn(r"</body>", tag, html, count=1)
assert n == 1, "</body> introuvable"

pathlib.Path(dst).write_text(html)
print("OK ->", dst)
