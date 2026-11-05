# Renders the SVGs with headless Chrome at 1024px and writes every icon size the apps use.
# Run from design/logo after make.py: python3 export.py
import subprocess, tempfile, pathlib
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RES = ROOT / 'android/app/src/main/res'
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

def render(svg):
    out = pathlib.Path(tempfile.mkdtemp()) / 'r.png'
    subprocess.run(['google-chrome', '--headless=new', '--disable-gpu', '--hide-scrollbars',
                    '--default-background-color=00000000', '--window-size=1024,1024',
                    f'--screenshot={out}', (HERE / svg).as_uri()], check=True, capture_output=True)
    im = Image.open(out).convert('RGBA')
    assert im.size == (1024, 1024), im.size
    return im

def save(im, path, px):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.resize((px, px), Image.LANCZOS).save(path, optimize=True)

def circle(im):
    m = Image.new('L', im.size, 0)
    from PIL import ImageDraw
    ImageDraw.Draw(m).ellipse((0, 0, *im.size), fill=255)
    out = im.copy(); out.putalpha(m); return out

icon, bg, fg = render('icon.svg'), render('android-background.svg'), render('android-foreground.svg')
for name, px in (('icon-192.png', 192), ('icon-512.png', 512), ('maskable-512.png', 512), ('apple-touch-icon.png', 180)):
    save(icon, ROOT / 'public/icons' / name, px)
for d, k in DENS.items():
    save(icon, RES / f'mipmap-{d}/ic_launcher.png', round(48 * k))
    save(circle(icon), RES / f'mipmap-{d}/ic_launcher_round.png', round(48 * k))
    save(fg, RES / f'mipmap-{d}/ic_launcher_foreground.png', round(108 * k))
    save(bg, RES / f'mipmap-{d}/ic_launcher_background.png', round(108 * k))
icon.save(HERE / 'icon-1024.png', optimize=True)
print('exported')
