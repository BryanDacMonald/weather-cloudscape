# turns calibrate.js JSON output into the COVER_CAL table in index.html
import json, re, sys
data = json.loads([l for l in open(sys.argv[1]) if l.startswith('{')][-1])
def clean(rows):
    rows = sorted(rows, key=lambda r: r[1])
    z = max(c for f, c in rows if f == 0)            # last knob value with no cloud
    o = min(c for f, c in rows if f >= 0.999)        # first knob value with full cover
    mid = [(f, c) for f, c in rows if z < c < o]
    out, last = [[0, z]], 0
    for f, c in mid:
        if f > last: out.append([f, c]); last = f
    out.append([1, o])
    return out
tabs = {k: clean(v) for k, v in data.items()}
txt = 'const COVER_CAL = {\n' + ''.join(f'  {k}: {json.dumps(v)},\n' for k, v in tabs.items()) + '};'
p = 'index.html'; s = open(p).read()
s, n = re.subn(r'const COVER_CAL = \{.*?\n\};', txt, s, flags=re.S); assert n == 1
open(p, 'w').write(s); print(txt)
