# Template format

A template is one JSON file in `src/templates/`. Every file there shows up in the app automatically.
You can also paste JSON into the app with **+ Template**; those are saved in your browser only.

Coordinates are in pixels on a **1080×1920** frame. The renderer keeps all text inside the TikTok safe zone
(top 160px, bottom 480px, right 150px and left 60px are off limits) and shrinks the font if it has to.

## Full example

```json
{
  "id": "pop-karaoke",
  "name": "Pop Karaoke",
  "vibe": "Bold white caps, the sung word pops in yellow",
  "tags": ["karaoke", "bold"],
  "font": { "family": "Montserrat", "weight": 900, "size": 92, "lineHeight": 1.08, "letterSpacing": 0, "case": "upper" },
  "color": {
    "fill": "#FFFFFF",
    "gradient": ["#FFFFFF", "#AAB4FF"],
    "palette": ["#FFFFFF", "#FF2D55"],
    "stroke": { "color": "#000000", "width": 9 },
    "shadow": { "color": "rgba(0,0,0,0.45)", "blur": 0, "x": 0, "y": 8 },
    "glow": { "color": "#7DF9FF", "blur": 28 }
  },
  "layout": { "mode": "chunk", "maxWords": 3, "anchor": "lower", "align": "center", "maxWidth": 0.9, "maxLines": 3 },
  "reveal": "all",
  "upcoming": { "opacity": 0.5 },
  "active": { "mode": "color", "color": "#FFE600", "boxColor": "#8B5CF6", "boxPadding": 16, "boxRadius": 18, "scale": 1.12 },
  "enter": { "anim": "pop", "duration": 220, "easing": "back", "stagger": 0 },
  "exit": { "anim": "none", "duration": 0 },
  "timing": { "lead": 0.05, "hold": 0.6 },
  "fx": { "shake": 0, "shakeDuration": 180, "rgbSplit": 0, "flicker": 0, "wobble": 0, "tilt": 0, "float": 0 },
  "frame": { "dim": 0, "punchZoom": 0, "grain": 0, "vignette": 0, "flash": 0 }
}
```

Only `id`, `name`, `vibe`, `font`, `color.fill`, `layout.mode`, `layout.anchor`, `reveal`, `enter` and `exit` are required.
Leave out anything you don't use (`gradient`, `palette`, `glow`, `fx`, …).

## Fields

| Field | Values | What it does |
| --- | --- | --- |
| `id` | `kebab-case` | Unique. Must match the file name. |
| `font.family` | any [Google Fonts](https://fonts.google.com) family | Loaded on demand. Check the weight exists for that family. |
| `font.size` | 20–400 | Starting px size; shrinks automatically to fit. |
| `font.case` | `upper` `lower` `none` | Text transform. |
| `font.letterSpacing` | em, e.g. `0.04` | Tracking. |
| `color.gradient` | 2+ colors | Vertical gradient fill (top→bottom). Ignored when `palette` is set. |
| `color.palette` | colors | Cycles the fill color per group, e.g. alternating words. |
| `layout.mode` | `line` `chunk` `word` | Whole lyric line / up to `maxWords` at a time / one word at a time. |
| `layout.anchor` | `upper` `center` `lower` | Vertical position inside the safe zone (user can nudge it). |
| `layout.placement` | `block` `scatter` `zigzag` `stairs` `orbit` `wander` `bounce` | Where words go: centered block · thrown around the frame · alternating edges · diagonal steps · circling the center · a new spot per phrase · DVD-logo bouncing (palette color changes on each bounce). |
| `layout.sizeJitter` | 0–1 | Random size per word (scatter / zigzag / stairs). |
| `layout.speed` | e.g. `1` | Orbit spin / bounce speed. |
| `enter.letterStagger` | ms | Animate letters one by one with the entrance (pop, drop, flyIn…). |
| `color.letterPalette` | colors | Color each letter from this list. |
| `fx.wave` | px | A wave running through the letters. |
| `fx.jelly` | 0–1 | Squash-and-stretch wobble when a word lands. |
| `fx.drift` | px/s | Words slowly float away in their own directions. |
| `exit.overlap` | `true` | Let the exit keep playing while the next phrase comes in (words fly/fall away behind it). |
| `reveal` | `all` `word` `char` | Whole group at once / each word appears as it's sung / typewriter letters. |
| `upcoming.opacity` | 0–1 | For `reveal: all`: dim words not sung yet (karaoke look). |
| `active.mode` | `none` `color` `sung` `box` `underline` | How the word being sung stands out. `sung` = every sung word keeps the color. |
| `active.scale` | e.g. `1.12` | Scale bump for the current word (works with any mode). |
| `enter.anim` | `none` `fade` `pop` `slam` `zoom` `slideUp` `slideDown` `blur` `drop` `spin` `glitch` `typewriter` `flyIn` `flip` `stretch` `swing` | Entrance. Applies per group (`reveal: all`) or per word. |
| `enter.easing` | `linear` `easeOut` `easeInOut` `back` `elastic` `bounce` | Optional; each anim has a sensible default. |
| `enter.stagger` | ms | For `reveal: all`: delay between words so they cascade in. |
| `exit.anim` | `none` `fade` `blur` `slideUp` `shrink` `scatter` `fall` `pop` | Plays after the last word is sung, only when there's a pause before the next group. |
| `timing.lead` | seconds | Only for `reveal: all`: show the whole group this early (karaoke-style pre-show). Word timing itself is automatic: every entrance is started early enough that the word is readable exactly when it's sung, so all templates stay in sync. |
| `timing.hold` | seconds | Max linger after the last word if nothing follows. |
| `fx.shake` | px | Jitter when text lands. |
| `fx.rgbSplit` | px | Red/cyan chromatic copies (glitch look). |
| `fx.flicker` | 0–1 | Random dimming per tick. |
| `fx.wobble` | degrees | Continuous sway. |
| `fx.tilt` | degrees | Random fixed rotation per group (sticker look). |
| `fx.float` | px | Gentle vertical bobbing. |
| `layout.spread` | `true` | Spread each row's words evenly across the full width ("NOW    WE    AIN'T"). |
| `color.blend` | `normal` `multiply` `screen` `overlay` `difference` `soft-light` | Blend text into the footage. `multiply` + dark text = projected onto a bright wall. |
| `color.card` | `{ color, padding, radius }` | Solid panel behind the words (e.g. white text on red). |
| `fx.soften` | px | Constant slight blur, for projected / out-of-focus text. |
| `emphasis.trigger` | `lineEnd` `marked` `none` | Which words are "payoff" words: the last word of every lyric line, or only words the user wraps in `*stars*` (starred words always count). Each payoff word gets its own moment. |
| `emphasis.background` | color | Cuts the whole frame to this color while the payoff word shows (e.g. `#000` blackout). |
| `emphasis.fill` / `scale` / `noCard` | | Restyle the payoff word: its color, a size boost, and whether to hide the card. |
| `frame.dim` | 0–1 | Darkens the video so text pops. |
| `frame.punchZoom` | e.g. `0.05` | Camera "kick" zoom on every new group. |
| `frame.flash` | 0–1 | White flash on every new group. |
| `frame.grain` | 0–1 | Film grain. |
| `frame.vignette` | 0–1 | Dark edges. |

## Recipes

- **High energy / rap:** `layout.mode: word`, `enter.anim: slam`, `fx.shake`, `frame.punchZoom`, a `palette`.
- **Karaoke:** `layout.mode: line` or `chunk`, `reveal: all`, `active.mode: sung` or `color`, `upcoming.opacity: 0.5`.
- **Sad / aesthetic:** serif or handwritten font, `case: lower`, `reveal: word`, `enter.anim: blur`, `frame.dim` + `vignette`.
- **Cinematic / indie:** condensed caps (`Oswald`, `Roboto Condensed`), `layout.spread`, `reveal: word`,
  no enter animation (hard cuts), `emphasis: { trigger: lineEnd, background: "#000" }`. Add `color.card` for the red-panel look.
- **Playful / experimental:** `placement: scatter` + `sizeJitter` + `exit: scatter` with `overlap`; letter pop-ins with
  `letterStagger` + `wave` + `letterPalette`; `placement: bounce` with a `palette`; `enter: stretch` + `fx.jelly`.
- **Glitch / Y2K:** mono or pixel font, `enter.anim: glitch`, `fx.rgbSplit`, `fx.flicker`, `frame.grain`.

Check your changes with `npm run validate-templates`.
