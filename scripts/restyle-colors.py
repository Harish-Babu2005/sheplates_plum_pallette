#!/usr/bin/env python3
"""One-off codemod for the 2.0 redesign: re-points arbitrary-hex Tailwind colour utilities (bg-[#5ba400] etc.)
at the Delifood palette. Run from the repo root: python3 scripts/restyle-colors.py [--dry]"""
import colorsys, os, re, sys, collections

ORANGE, ORANGE_D, TINT, TINT2, OT, INK, SURF, ERR, INFO = '#FF7B00', '#E86F00', '#FFF0E0', '#FFDDB8', '#B34D00', '#0A0A0A', '#F4F4F4', '#C20000', '#035BF3'
ERROR = {'#ef3d3d', '#d92f2f', '#d83d30'}
BRAND = {'#5ba400', '#5f8f2d', '#6cab1b', '#4c8c00', '#477f00', '#50772a', '#5b9417', '#237a45', '#238247', '#1b6e3b', '#168a4a', '#11733d',
         '#356747', '#91c747', '#a8db69', '#bfe58f', '#a9dc67', '#c8e6ac', '#d6ead7', '#e94b3c', '#e0194f', '#c62653', '#c4123f', '#e0455f',
         '#ff4d7a', '#e55a41', '#ff7969', '#ff4d18', '#ff845e', '#ff7aa0', '#f4a3b9', '#8f2943', '#8f1238', '#fbd0dc', '#f4d8df', '#fff0f4'}
BLUEPURPLE_DARK = {'#5a1a31', '#4b27c9', '#6d3df5', '#7847b8', '#4520c5', '#4f28c8', '#164a6e', '#10263b', '#1f7aa8'}
KEEP = {'#e3a008', '#f5a524', '#c98a00', '#a67c00', '#8a5a00', '#f0d9a8', '#c1651f', '#7a4a14', '#3b2410', '#4a211b', '#fdf3e2', '#fff9ec'}  # warning/amber family


def hls(h):
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hh, l, s = colorsys.rgb_to_hls(r, g, b)
    return hh * 360, l, s, (max(r, g, b) - min(r, g, b)) * 255


NEW_PALETTE = {'#ff7b00', '#e86f00', '#fff0e0', '#ffddb8', '#b34d00', '#0a0a0a', '#f4f4f4', '#c20000', '#035bf3', '#e3f8e3', '#ffe9e9', '#e6eefe', '#fff4cf', '#0a7a2a', '#7a5a00', '#0a44b8', '#66666b', '#70707a', '#e7e7ea', '#eaeaec', '#404040'}


def mapped(util, hexv):
    x = hexv.lower()
    if x in NEW_PALETTE:
        return None
    if x in KEEP:
        return None
    h, l, s, chroma = hls(x)
    if x in ERROR:
        return ERR
    if x == '#2f6fa8':
        return INFO
    if x in BLUEPURPLE_DARK:
        return INK
    if l < 0.2:
        return INK
    if x in BRAND or (l > 0.9 and chroma >= 12):
        if l < 0.3:
            return INK
        if l > 0.9:  # soft brand tint
            return TINT if util in ('bg', 'from', 'to', 'via') else TINT2
        if util == 'text':
            return ORANGE if l > 0.65 else OT
        if util in ('border', 'ring', 'outline', 'divide'):
            return TINT2 if l > 0.78 else ORANGE
        return ORANGE
    if l > 0.9:
        return SURF
    return None


PAT = re.compile(r'(?<![\w-])((?:[a-z0-9\-\[\]&>_:]+:)*)(bg|text|border|from|to|via|ring|fill|stroke|outline|divide|decoration|accent|caret)-\[(#[0-9a-fA-F]{3,8})(/\d+)?\]')
LIT = re.compile(r'`[^`]*`|"[^"\n]*"|\'[^\'\n]*\'')
unmapped = collections.Counter()
changed = 0


def fix_lit(m):
    s = m.group(0)
    if 'bg-' not in s and 'text-' not in s and 'border-' not in s and 'from-' not in s and 'ring-' not in s:
        return s

    def sub(mm):
        pre, util, hx, alpha = mm.group(1), mm.group(2), mm.group(3), mm.group(4) or ''
        n = mapped(util, hx)
        if n is None:
            unmapped[(util, hx.lower())] += 1
            return mm.group(0)
        return '%s%s-[%s%s]' % (pre, util, n, alpha)
    out = PAT.sub(sub, s)
    # orange fills carry dark text: a literal that now has an orange base fill must not keep white text
    if re.search(r'(?<![\w:-])bg-\[#FF7B00\]', out) and re.search(r'(?<![\w:-])text-white(?![\w-])', out):
        out = re.sub(r'(?<![\w:-])text-white(?![\w-])', 'text-[#0A0A0A]', out)
    if re.search(r'(?<![\w:-])bg-primary(?![\w/-])', out) and re.search(r'(?<![\w:-])text-white(?![\w-])', out):
        out = re.sub(r'(?<![\w:-])text-white(?![\w-])', 'text-primary-foreground', out)
    return out


dry = '--dry' in sys.argv
files = 0
for root in ('components', 'app'):
    for dp, _, fs in os.walk(root):
        for f in fs:
            if not f.endswith(('.tsx', '.ts')) or f == 'icons.tsx':
                continue
            p = os.path.join(dp, f)
            s = open(p).read()
            t = LIT.sub(fix_lit, s)
            if t != s:
                files += 1
                if not dry:
                    open(p, 'w').write(t)
print('files changed:', files)
print('left alone:', sorted(unmapped.items(), key=lambda x: -x[1]))
