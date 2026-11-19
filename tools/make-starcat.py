# Packs the Yale Bright Star Catalogue (5th ed., public domain; JSON by Bretton Wade, MIT:
# https://github.com/brettonw/YaleBrightStarCatalog) into the STAR_DATA string in index.html.
# 6 bytes per star, base64: RA uint16 (360/65536 deg), Dec uint16 ((dec+90)/180*65535),
# V uint8 ((V+2)*25), colour temperature uint8 (K/150).
# Usage: python3 -I tools/make-starcat.py path/to/bsc5-short.json index.html
import json, re, sys, struct, base64
cat, html = sys.argv[1], sys.argv[2]
def ra_deg(s):
    h, m, sec = re.match(r"(\d+)h\s*(\d+)m\s*([\d.]+)s", s).groups(); return (int(h) + int(m) / 60 + float(sec) / 3600) * 15
def dec_deg(s):
    sg, d, m, sec = re.match(r"([+-])(\d+)°\s*(\d+)′\s*([\d.]+)″", s).groups()
    v = int(d) + int(m) / 60 + float(sec) / 3600; return -v if sg == '-' else v
out = bytearray(); n = 0; mx = 0
for s in json.load(open(cat)):
    try: V = float(s['V'])
    except (KeyError, ValueError): continue
    if V > 6.5: continue
    K = float(s.get('K') or 6000)
    out += struct.pack('<HHBB', round(ra_deg(s['RA']) / 360 * 65536) % 65536, round((dec_deg(s['Dec']) + 90) / 180 * 65535),
                       max(0, min(255, round((V + 2) * 25))), max(1, min(255, round(K / 150))))
    n += 1; mx = max(mx, K)
b64 = base64.b64encode(bytes(out)).decode()
s = open(html).read()
s, k = re.subn(r"const STAR_DATA = '[^']*';", f"const STAR_DATA = '{b64}';", s); assert k == 1
open(html, 'w').write(s)
print(f'{n} stars, {len(b64)} chars, max K {mx}')
