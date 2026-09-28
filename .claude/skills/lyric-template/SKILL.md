---
name: lyric-template
description: Create or remix an animated lyric-caption template for Lyric Studio (lyric-studio/). Use when the user asks for a new lyric/caption style, animation, font look, or "a template like <song/artist/vibe/reference video>".
---

# Make a Lyric Studio template

Templates are pure JSON in `lyric-studio/src/templates/<id>.json`. The app picks every file up automatically, so there's no code to change.

## Steps

1. Read `lyric-studio/TEMPLATES.md` (the format and every allowed value) and skim 2–3 existing templates in
   `lyric-studio/src/templates/` closest to the requested vibe.
2. Turn the request into concrete choices. Pick a **Google Fonts** family that really exists and has the chosen
   weight (e.g. Anton 400 only; Montserrat 100–900; Playfair Display 400–900 + italic). Then pick:
   - layout mode: `line`, `chunk` or `word`
   - reveal: `all`, `word` or `char`
   - enter/exit animations, active-word treatment, fx and frame effects

   Match the energy: fast/rap → `word` + `slam` + `shake` + `punchZoom`. Ballad/sad → serif/handwritten, `blur`, `dim`.
   Glitch/Y2K → mono/pixel, `glitch`, `rgbSplit`, `grain`.
3. Readability on TikTok matters more than novelty:
   - white or light text needs a `stroke`, `shadow` or `frame.dim`
   - avoid font sizes under ~52
   - keep `timing.hold` ≤ 0.4 for `word` mode
4. Write `lyric-studio/src/templates/<id>.json`, where `id` is kebab-case and matches the file name. Include a short `vibe` line.
5. Run `cd lyric-studio && npm run validate-templates` and fix anything it reports.
6. Tell the user the template name. Say they can run `npm run dev` and pick it in the gallery (hover the thumbnail to see it animate).
   If they're using the hosted app, give them the JSON to paste via **+ Template** instead.

If the user describes something the schema can't express (e.g. per-letter 3D rotation, masks, particle effects),
say so, get as close as the schema allows, and suggest it as a renderer feature (`src/lib/render.ts` + `src/lib/anim.ts`).
