"""Build deliverables for the Elina Kosmidou site.

dist/elina-kosmidou-standalone.html  one file, fonts and images inlined (offline demo, screen share)
dist/elina-kosmidou-netlify.zip      elina-kosmidou/index.html + assets, for Netlify Drop

Run: python3 build.py
"""
import base64
import pathlib
import re
import zipfile

ROOT = pathlib.Path(__file__).parent
DIST = ROOT / "dist"
ASSETS = ["fonts/literata.woff2", "fonts/commissioner.woff2", "img/elina.jpg", "img/elina-800.jpg", "img/desk.jpg",
          "img/room-main.jpg", "img/room-second.jpg", "img/door.jpg", "img/hourglass.jpg"]
MIME = {".woff2": "font/woff2", ".jpg": "image/jpeg"}


def data_uri(rel: str) -> str:
    p = ROOT / rel
    return f"data:{MIME[p.suffix]};base64," + base64.b64encode(p.read_bytes()).decode()


def standalone(html: str) -> str:
    html = re.sub(r'\s*<link rel="preload"[^>]*>', "", html)
    # one copy of the big hero image is enough offline
    html = html.replace(' srcset="img/elina-800.jpg 800w, img/elina.jpg 1600w" sizes="(max-width: 1100px) 100vw, 60vw"', "")
    html = html.replace(' loading="lazy"', "")
    for rel in ASSETS:
        if rel in html:
            html = html.replace(rel, data_uri(rel))
    left = re.findall(r'(?:src|href|url\()\s*=?\s*"?((?:fonts|img)/[^")\s]+)', html)
    assert not left, f"unresolved asset references: {left}"
    return html


def main() -> None:
    DIST.mkdir(exist_ok=True)
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    out = DIST / "elina-kosmidou-standalone.html"
    out.write_text(standalone(html), encoding="utf-8")
    with zipfile.ZipFile(DIST / "elina-kosmidou-netlify.zip", "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("elina-kosmidou/index.html", html)
        for rel in ASSETS:
            z.write(ROOT / rel, f"elina-kosmidou/{rel}")
    for f in sorted(DIST.iterdir()):
        print(f"{f.name}: {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
