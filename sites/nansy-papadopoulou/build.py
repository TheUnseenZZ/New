"""Build deliverables for the Nansy Papadopoulou site.

dist/nansy-papadopoulou-standalone.html  one file, fonts and images inlined (offline demo, screen share)
dist/nansy-papadopoulou-netlify.zip      nansy-papadopoulou/index.html + assets, for Netlify Drop

Run: python3 build.py
"""
import base64
import pathlib
import re
import zipfile

ROOT = pathlib.Path(__file__).parent
DIST = ROOT / "dist"
# every font and image in the site folder (longest paths first, so no path is a prefix of another)
ASSETS = sorted((str(p.relative_to(ROOT)) for d in ("fonts", "img") for p in (ROOT / d).iterdir()
                 if p.suffix in (".woff2", ".jpg", ".webp", ".png")), key=len, reverse=True)
MIME = {".woff2": "font/woff2", ".jpg": "image/jpeg", ".webp": "image/webp", ".png": "image/png"}


def data_uri(rel: str) -> str:
    p = ROOT / rel
    return f"data:{MIME[p.suffix]};base64," + base64.b64encode(p.read_bytes()).decode()


def standalone(html: str) -> str:
    html = re.sub(r'\s*<link rel="preload"[^>]*>', "", html)
    # one copy of the big hero image is enough offline
    html = re.sub(r' srcset="[^"]*" sizes="[^"]*"', "", html)
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
        z.writestr("nansy-papadopoulou/index.html", html)
        z.write(ROOT / "privacy.html", "nansy-papadopoulou/privacy.html")
        z.write(ROOT / "site.webmanifest", "nansy-papadopoulou/site.webmanifest")
        for rel in ASSETS:
            if rel in html or rel.startswith(("fonts/manrope", "img/icon-")):
                z.write(ROOT / rel, f"nansy-papadopoulou/{rel}")


def main() -> None:
    DIST.mkdir(exist_ok=True)
    build("index.html", "nansy-papadopoulou")
    for f in sorted(DIST.iterdir()):
        print(f"{f.name}: {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
