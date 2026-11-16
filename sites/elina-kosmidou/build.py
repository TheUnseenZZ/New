"""Build deliverables for the Elina Kosmidou site.

dist/elina-kosmidou-standalone.html  one file, fonts and images inlined (offline demo, screen share)
dist/elina-kosmidou-netlify.zip      elina-kosmidou/index.html + assets, for Netlify Drop
dist/elina-kosmidou-draft-*          the same two files for draft.html (the "professional" proposal)

Run: python3 build.py
"""
import base64
import pathlib
import re
import zipfile

ROOT = pathlib.Path(__file__).parent
DIST = ROOT / "dist"
ASSETS = ["fonts/literata.woff2", "fonts/commissioner.woff2", "fonts/manrope.woff2",
          "img/elina.jpg", "img/elina-800.jpg", "img/desk.jpg",
          "img/room-main.jpg", "img/room-second.jpg", "img/door.jpg", "img/hourglass.jpg"] + [
          f"img/topic-{t}.jpg" for t in ("anx", "mood", "self", "rel", "teen", "trauma", "food", "women")]
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


def build(page: str, name: str) -> None:
    html = (ROOT / page).read_text(encoding="utf-8")
    (DIST / f"{name}-standalone.html").write_text(standalone(html), encoding="utf-8")
    with zipfile.ZipFile(DIST / f"{name}-netlify.zip", "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("elina-kosmidou/index.html", html)
        z.write(ROOT / "privacy.html", "elina-kosmidou/privacy.html")
        for rel in ASSETS:
            if rel in html or rel == "fonts/manrope.woff2":
                z.write(ROOT / rel, f"elina-kosmidou/{rel}")


def main() -> None:
    DIST.mkdir(exist_ok=True)
    build("index.html", "elina-kosmidou")
    build("draft.html", "elina-kosmidou-draft")
    for f in sorted(DIST.iterdir()):
        print(f"{f.name}: {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
