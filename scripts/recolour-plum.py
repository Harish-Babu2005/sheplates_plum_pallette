#!/usr/bin/env python3
"""One-off codemod: moves the app from the orange kit palette to the plum palette (design/colors.css).
Run from the repo root: python3 scripts/recolour-plum.py [--dry]"""
import glob, re, sys

DRY = '--dry' in sys.argv
HEX = {
    '#ff7b00': '#753b50', '#e86f00': '#602d40', '#fff0e0': '#f7edf0', '#ffddb8': '#e8cbd5', '#b34d00': '#653046',
    '#ffe3c4': '#efd9e0', '#ffe3c7': '#efd9e0', '#fffaf4': '#fcf8f9', '#8f3d00': '#4f2438',
    '#0a0a0a': '#292124', '#404040': '#4c4246', '#333333': '#3a3034', '#66666b': '#71676b', '#70707a': '#766b70', '#b6b6b7': '#b9afb3',
    '#f4f4f4': '#faf6f4', '#eaeaec': '#f0e8e7', '#e7e7ea': '#e8dfe1', '#d4d4d8': '#d8cfd2', '#d8d8dc': '#ddd4d7',
    '#1c1c1e': '#382d32', '#262628': '#4a3b42',
    '#03cf03': '#26834a', '#0a7a2a': '#21683b', '#e3f8e3': '#eaf5ec', '#bfeebf': '#cde6d3', '#086b25': '#1b5a33', '#065a1f': '#164a2a',
    '#c20000': '#b42332', '#ffe9e9': '#fdecef', '#f3b8b8': '#f0c3c9', '#ff0e0e': '#d63a4a', '#a50000': '#8f1c29', '#8a0000': '#8f1c29', '#ffd9dc': '#f8d4da',
    '#035bf3': '#285fba', '#e6eefe': '#edf3fd', '#0a44b8': '#285fba', '#0a3a99': '#1f4f9e', '#c3d6fb': '#cbdaf3', '#d9e6ff': '#dde8fa',
    '#7a5a00': '#795900',
}
RGBA = {'255, 123, 0': '117, 59, 80', '255,123,0': '117,59,80', '10, 10, 10': '41, 33, 36', '10,10,10': '41,33,36', '232, 111, 0': '96, 45, 64'}
LIT = re.compile(r'`[^`]*`|"[^"\n]*"|\'[^\'\n]*\'')


def flip_on_brand_ts(src):
    def fix(m):
        s = m.group(0)
        if re.search(r'(?<![\w:-])bg-\[#ff7b00\]', s, re.I) and re.search(r'(?<![\w:-])text-\[#0a0a0a\]', s, re.I):
            s = re.sub(r'(?<![\w:-])text-\[#0a0a0a\]', 'text-white', s, flags=re.I)
        return s
    return LIT.sub(fix, src)


ON_FILL = re.compile(r'background(?:-color)?:\s*(?:var\(--o\)|#ff7b00|var\(--primary\)|var\(--o-d\)|#e86f00)', re.I)


def flip_on_brand_css(src, always_add):
    def fix(m):
        sel, body = m.group(1), m.group(2)
        if not ON_FILL.search(body):
            return m.group(0)
        col = re.search(r'(?<![-\w])color:\s*(var\(--ink\)|#0a0a0a)(\s*!important)?', body, re.I)
        if col:
            body = body[:col.start()] + 'color: var(--on-brand)' + (col.group(2) or '') + body[col.end():]
        elif always_add and not re.search(r'(?<![-\w])color:', body):
            body = body.rstrip() + ' color: var(--on-brand); '
        return sel + '{' + body + '}'
    return re.sub(r'([^{}]+)\{([^{}]*)\}', fix, src)


def remap(src):
    src = re.sub(r'#[0-9a-fA-F]{6}\b', lambda m: HEX.get(m.group(0).lower(), m.group(0)), src)
    for a, b in RGBA.items():
        src = re.sub(r'rgba\(\s*' + re.escape(a) + r'\s*,', 'rgba(' + b + ',', src)
    return src


changed = 0
files = [f for pat in ('components/**/*.tsx', 'components/*.tsx', 'app/**/*.tsx', 'app/*.tsx', 'lib/**/*.ts', 'lib/*.ts', 'app/*.css', 'public/manifest.webmanifest') for f in glob.glob(pat, recursive=True)]
for f in sorted(set(files)):
    if f.endswith('app/theme-2.css') is False and f.endswith('.css') is False:
        pass
    src = open(f).read()
    out = src
    if f.endswith(('.tsx', '.ts')):
        out = flip_on_brand_ts(out)
    elif f.endswith('.css') and f.split('/')[-1] in ('theme-2.css', 'design-kit.css', 'shell-kit.css', 'staff-kit.css'):
        out = flip_on_brand_css(out, always_add=True)
    if f.endswith('manifest.webmanifest'):
        out = out.replace('#F7F5EF', '#faf6f4').replace('#151813', '#753b50')
    out = remap(out)
    if out != src:
        changed += 1
        if not DRY:
            open(f, 'w').write(out)
print(('would change' if DRY else 'changed'), changed, 'files')
