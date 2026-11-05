# Generates the icon concepts as SVG (1024x1024). Run: python3 make.py
GOLD = '''<linearGradient id="gold" x1="0" y1="0" x2="0.35" y2="1">
  <stop offset="0" stop-color="#fff0c2"/><stop offset=".28" stop-color="#f1c65a"/>
  <stop offset=".62" stop-color="#c58d26"/><stop offset="1" stop-color="#7c4f10"/></linearGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#f1c65a" stop-opacity=".35"/><stop offset="1" stop-color="#f1c65a" stop-opacity="0"/></radialGradient>
<radialGradient id="coin" cx=".38" cy=".32" r=".75">
  <stop offset="0" stop-color="#fff4cf"/><stop offset=".35" stop-color="#f3c85c"/>
  <stop offset=".75" stop-color="#c08624"/><stop offset="1" stop-color="#83530f"/></radialGradient>'''

# The letter noon: heavy bowl, thin rising right arm, nib-cut left end.
BOWL = ('M 250 540 C 248 680 352 744 506 744 C 668 744 778 650 774 480 L 760 330 '
        'Q 742 322 728 338 L 724 470 C 722 600 640 664 506 664 C 404 664 336 620 334 572 Z')
DOT = (506, 438, 64)          # sits in the bowl's mouth, between the two arm heights
SHIFT = 'translate(0 -25)'    # centres the mark's box on the canvas

def dot(cx, cy, r, ring=True):
    s = ''
    if ring:
        s += f'<circle cx="{cx}" cy="{cy}" r="{r*2.4:.0f}" fill="url(#glow)"/>'
    s += (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#coin)"/>'
          f'<circle cx="{cx}" cy="{cy}" r="{r*0.78:.1f}" fill="none" stroke="#7c4f10" stroke-opacity=".35" stroke-width="3"/>'
          f'<ellipse cx="{cx-r*0.3:.1f}" cy="{cy-r*0.38:.1f}" rx="{r*0.36:.1f}" ry="{r*0.2:.1f}" fill="#fff" fill-opacity=".55" transform="rotate(-28 {cx-r*0.3:.1f} {cy-r*0.38:.1f})"/>')
    return s

def svg(defs, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs>{GOLD}{defs}</defs>{body}</svg>'

# A — dark: gold noon on warm darkness, the dot is a live coin
a = svg('''<radialGradient id="bgA" cx=".42" cy=".3" r=".9"><stop offset="0" stop-color="#2b2111"/><stop offset=".55" stop-color="#0e0b07"/><stop offset="1" stop-color="#050403"/></radialGradient>
<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>''',
  '<rect width="1024" height="1024" fill="url(#bgA)"/><rect width="1024" height="1024" fill="url(#sheen)"/>'
  f'<g transform="translate(0 -25)"><path d="{BOWL}" fill="url(#gold)"/>'
  f'<path d="{BOWL}" fill="none" stroke="#fff3cf" stroke-opacity=".35" stroke-width="3"/>{dot(*DOT)}</g>')

# B — minted coin: the whole icon is a gold coin, noon struck into it
ticks = ''.join(f'<rect x="510" y="150" width="4" height="26" rx="2" fill="#7c4f10" fill-opacity=".45" transform="rotate({i*3} 512 512)"/>' for i in range(120))
b = svg('''<radialGradient id="bgB" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#1d170c"/><stop offset="1" stop-color="#060504"/></radialGradient>
<radialGradient id="face" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#f7d57c"/><stop offset=".6" stop-color="#d7a23a"/><stop offset="1" stop-color="#a06c18"/></radialGradient>''',
  '<rect width="1024" height="1024" fill="url(#bgB)"/>'
  '<circle cx="512" cy="530" r="372" fill="#000" fill-opacity=".5"/>'
  '<circle cx="512" cy="512" r="372" fill="url(#coin)"/>' + ticks +
  '<circle cx="512" cy="512" r="318" fill="url(#face)"/>'
  '<circle cx="512" cy="512" r="318" fill="none" stroke="#fff4cf" stroke-opacity=".5" stroke-width="3"/>'
  f'<g transform="translate(512 512) scale(.66) translate(-512 -512) translate(0 -25)">'
  f'<path d="{BOWL}" fill="#fff3cf" fill-opacity=".55" transform="translate(-5 -6)"/>'
  f'<path d="{BOWL}" fill="#8a5a12"/>'
  '<circle cx="501" cy="432" r="64" fill="#fff3cf" fill-opacity=".55"/><circle cx="506" cy="438" r="64" fill="#8a5a12"/></g>')

# C — light: same mark on warm ivory glass, for a calm home screen
c = svg('''<linearGradient id="bgC" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#efe3c8"/></linearGradient>''',
  '<rect width="1024" height="1024" fill="url(#bgC)"/>'
  f'<g transform="translate(0 -25)"><path d="{BOWL}" fill="#000" fill-opacity=".10" transform="translate(0 14)"/>'
  f'<path d="{BOWL}" fill="url(#gold)"/>{dot(*DOT, ring=False)}</g>')

for name, s in (('A-dark', a), ('B-coin', b), ('C-light', c)):
    open(f'icon-{name}.svg', 'w').write(s)
print('ok')


# ---------- final (concept A) ----------
# Square icon: the mark at 110%. Android adaptive layers are 108dp with only the middle 72dp visible,
# so the foreground mark is 110% x 72/108 to look the same size as on iOS.
BG_A = '''<radialGradient id="bgA" cx=".42" cy=".3" r=".9"><stop offset="0" stop-color="#2b2111"/><stop offset=".55" stop-color="#0e0b07"/><stop offset="1" stop-color="#050403"/></radialGradient>
<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>'''
BG = '<rect width="1024" height="1024" fill="url(#bgA)"/><rect width="1024" height="1024" fill="url(#sheen)"/>'
def mark(scale):
    return (f'<g transform="translate(512 512) scale({scale}) translate(-512 -512) translate(0 -25)">'
            f'<path d="{BOWL}" fill="url(#gold)"/><path d="{BOWL}" fill="none" stroke="#fff3cf" stroke-opacity=".35" stroke-width="3"/>{dot(*DOT)}</g>')
open('icon.svg', 'w').write(svg(BG_A, BG + mark(1.1)))
open('android-background.svg', 'w').write(svg(BG_A, BG))
open('android-foreground.svg', 'w').write(svg('', mark(round(1.1 * 72 / 108, 3))))
open('mark.svg', 'w').write(svg('', mark(1.5)))
print('final ok')
