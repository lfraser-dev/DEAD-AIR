#!/usr/bin/env python3
"""Builds the locked copy of DEAD AIR in docs/ (what GitHub Pages publishes), the same way as The Semi-Finals.

docs/index.html (and 404.html) is tools/gate.html: a copy of GitHub's "There isn't a GitHub Pages site here." page.
Typing the secret word anywhere fades in the password screen, and only the password unscrambles the game: the whole
game (index.html + every module in src/) is gzipped and encrypted with AES-256-GCM into docs/g.bin, with a key made
from the password (PBKDF2-SHA256, 600,000 rounds). Only a hash of the word is in the page, and nothing of the password.

The password comes from DA_PASS or .sealpass, the word from DA_WORD or .sealword (both git-ignored, never committed).
GitHub Pages must be set to serve the /docs folder (Settings > Pages > Branch: main, folder: /docs).

Run after changing the game:  python3 tools/seal.py         (re-seal)
                               python3 tools/seal.py --new   (new salt: every device has to type the password again)
"""
import base64, gzip, hashlib, json, os, posixpath, re, secrets, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg_path = os.path.join(root, 'tools', 'seal.json')

def secret(env, fname):
    v = os.environ.get(env)
    if not v and os.path.exists(os.path.join(root, fname)):
        v = open(os.path.join(root, fname)).read()
    return re.sub(r'\s+', '', (v or '').strip().lower())

pw = secret('DA_PASS', '.sealpass')
if not pw:
    sys.exit('seal: no password (set DA_PASS or write it to .sealpass)')
word = secret('DA_WORD', '.sealword')
if not word:
    sys.exit('seal: no secret word (set DA_WORD or write it to .sealword)')

cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else None
if cfg is None or '--new' in sys.argv:
    cfg = {'salt': base64.b64encode(secrets.token_bytes(16)).decode(), 'iter': 600000}
    json.dump(cfg, open(cfg_path, 'w'), indent=1)
bits = hashlib.pbkdf2_hmac('sha256', pw.encode(), base64.b64decode(cfg['salt']), cfg['iter'], 64)

# every module, with relative imports rewritten to '@sf/<path>' (the gate maps those to in-memory copies)
imp = re.compile(r"""((?:\bfrom|\bimport)\s*)(['"])(\.\.?/[^'"]+)\2""")
def rewrite(code, here):
    return imp.sub(lambda m: m.group(1) + m.group(2) + '@sf/' + posixpath.normpath(posixpath.join(here, m.group(3).split('?')[0])) + m.group(2), code)
mods = {}
for d, _, files in os.walk(os.path.join(root, 'src')):
    for f in sorted(files):
        if f.endswith('.js'):
            rel = os.path.relpath(os.path.join(d, f), root).replace(os.sep, '/')
            mods[rel] = rewrite(open(os.path.join(d, f), encoding='utf-8').read(), posixpath.dirname(rel))

html = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
html = rewrite(html, '')
html = html.replace('<a href="mech.html">the old mech sketch</a>', '')
ver = secrets.token_hex(4)

payload = gzip.compress(json.dumps({'html': html, 'mods': mods}, separators=(',', ':')).encode(), 9, mtime=0)
iv = secrets.token_bytes(12)
blob = iv + AESGCM(bits[:32]).encrypt(iv, payload, None)

gate = open(os.path.join(root, 'tools', 'gate.html'), encoding='utf-8').read()
word_h = hashlib.sha256(('sf-word:' + word).encode()).hexdigest()
gate = gate.replace('%SALT%', cfg['salt']).replace('%ITER%', str(cfg['iter'])).replace('%VER%', ver).replace('%WORDH%', word_h).replace('%WORDL%', str(len(word)))
out = os.path.join(root, 'docs')
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'g.bin'), 'wb').write(blob)
for name in ('index.html', '404.html'):                     # any other address shows the same "404"
    open(os.path.join(out, name), 'w', encoding='utf-8').write(gate)
open(os.path.join(out, 'robots.txt'), 'w').write('User-agent: *\nDisallow: /\n')
open(os.path.join(out, '.nojekyll'), 'w').write('')
print('sealed', ver, len(mods), 'modules,', len(blob) // 1024, 'KB')
