# Regenerates the app icons (pixel art). Needs Python 3 and rsvg-convert:
#   python3 tools/make-icons.py
import subprocess, os
here = os.path.dirname(os.path.abspath(__file__)); icons = os.path.join(here, '..', 'icons')
art = [
"................................", "................................", "................................",
"......C.........................", "......CC........................", "......CWC.......................",
"......CWWC......................", "......CWWWC.....................", "......CWWWWC....................",
"......CWWWWWC...................", "......CWWWWWWC..................", "......CWWWCCCC..................",
"......CWCWC.....................", "......CC.CWC....................", "......C...CC....................",
"................................",
"...............kkkk..kkkk.......", ".......kkkk..RRRRRRRRRRRRk......", ".....RRRRRRRRRRRRRRRRRRRRRR.....",
"....RRRRRRyyRRRRgggggRRRRRRR....", "....RRRRRRRRRRRggggggRRRRRRhh...", "....tRRRRRRRRRRgggggggRRRRRhh...",
"....RRRRRRyyRRRggggggRRRRRRR....", ".....RRRRRRRRRRRgggggRRRRRR.....", ".......kkkk..RRRRRRRRRRRRk......",
"...............kkkk..kkkk.......",
"................................", "................................", "................................",
"................................", "................................", "................................",
]
pal = {'C': '#3ff0ff', 'W': '#ffffff', 'R': '#ff4d5e', 'y': '#ffd43b', 'g': '#5a8fb8', 'k': '#1a1a22', 'h': '#fff3bf', 't': '#ff2a1a'}
def svg(scale, full):
    o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" shape-rendering="crispEdges">',
         '<defs><radialGradient id="g" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#3a2f7a"/><stop offset="1" stop-color="#120f22"/></radialGradient>',
         '<clipPath id="c"><rect width="512" height="512" rx="%d"/></clipPath></defs><g clip-path="url(#c)">' % (0 if full else 112),
         '<rect width="512" height="512" fill="url(#g)"/>']
    s = 16 * scale; off = (512 - 32 * s) / 2
    o.append(f'<rect x="0" y="{off + 27 * s:.1f}" width="512" height="{3 * s:.1f}" fill="#ffd37a" opacity="0.18"/>')
    o.append(f'<ellipse cx="{off + 16 * s:.1f}" cy="{off + 26.2 * s:.1f}" rx="{12 * s:.1f}" ry="{2.2 * s:.1f}" fill="#000" opacity="0.35"/>')
    for j, row in enumerate(art):
        for i, ch in enumerate(row):
            if ch in pal: o.append(f'<rect x="{off + i * s:.1f}" y="{off + j * s:.1f}" width="{s + 0.6:.1f}" height="{s + 0.6:.1f}" fill="{pal[ch]}"/>')
    o.append('</g></svg>')
    return '\n'.join(o)
open(os.path.join(icons, 'icon.svg'), 'w').write(svg(1.0, False))
open(os.path.join(here, 'maskable-source.svg'), 'w').write(svg(0.76, True))
r = lambda src, w, out: subprocess.run(['rsvg-convert', '-w', str(w), '-h', str(w), src, '-o', os.path.join(icons, out)], check=True)
r(os.path.join(icons, 'icon.svg'), 512, 'icon-512.png'); r(os.path.join(icons, 'icon.svg'), 192, 'icon-192.png')
r(os.path.join(here, 'maskable-source.svg'), 512, 'maskable-512.png'); r(os.path.join(here, 'maskable-source.svg'), 180, 'apple-touch-icon.png')
print('icons written')
