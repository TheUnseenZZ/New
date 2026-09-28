# Lyric Studio

![Lyric Studio](docs/app.png)

Turn a vertical music clip into a TikTok-ready lyric video: auto-captions from the vocals, animated
TikTok-style text, kept inside TikTok's safe zone, exported as a 1080×1920 MP4.

**Everything runs in the browser.** Speech recognition (Whisper via transformers.js) and video
rendering (WebCodecs via Mediabunny) happen on the user's own machine. Videos are never uploaded,
there's no server to pay for, and it can be hosted for free as a static site.

## Use it

```bash
cd lyric-studio
npm install
npm run dev        # http://localhost:5173 (use desktop Chrome or Edge)
```

1. **Drop a video** (MP4/MOV/WebM, ideally vertical).
2. **Auto-caption.** The first run downloads the speech model (~80 MB for Fast, ~250 MB for Accurate). After that it's cached.
   Pick the language if auto-detect guesses wrong.
3. **Fix the lyrics.** Click a timestamp to jump there, edit the text, merge or delete lines. Turn on
   *Edit timings* for start/end, or use the global *Lyric timing* slider if everything is a bit early or late.
4. **Pick a style** from the gallery (hover a thumbnail to see it animate). Then adjust size, position,
   framing (fill or fit + blurred background) and colors.
5. **Export MP4.** It renders at the clip's frame rate with the original audio.

Captions autosave in the browser per video. *Save project* / *Load project* move them between machines,
and *.srt* gives you a plain subtitle file.

## New animation styles

![Some of the built-in templates](docs/templates.png)

Templates are JSON files in `src/templates/`. See [TEMPLATES.md](TEMPLATES.md).
With Claude Code open in this repo, just ask: *"make a lyric template that feels like a 2000s emo music video"*.
The `lyric-template` skill writes and validates the file. In the hosted app, paste JSON via **+ Template**.

## Deploy (free)

It's a static site: `npm run build` → upload `dist/`. Vercel or Netlify work out of the box
(import the repo, root directory `lyric-studio`, build `npm run build`, output `dist`).
Note: the bundled ONNX runtime `.wasm` is ~27 MB, over Cloudflare Pages' 25 MB per-file limit.

## Limits to know

- **Sung vocals are hard for Whisper.** Clear vocals over a quiet beat work well. Heavy autotune, ad-libs and
  loud mixes cause misheard words, so plan on a quick edit pass. The *Accurate* model helps.
- **Browser:** desktop Chrome/Edge recommended (WebGPU for fast transcription, H.264/AAC export).
  Firefox/Safari may fall back to slower transcription or VP9/Opus output.
- **Export speed** is roughly real-time on a typical laptop. Long clips (> 3 min) use a lot of memory.

## Code map

```
src/lib/render.ts           Caption renderer: grouping, layout inside safe zone, animation, effects
src/lib/anim.ts             Enter/exit animations, easings, deterministic randomness
src/lib/tiktok.ts           1080×1920 frame + TikTok safe zone + preview overlay
src/lib/transcribe*.ts      Whisper in a Web Worker (WebGPU → CPU fallback), word timestamps
src/lib/lyrics.ts           Words → lines, retiming edits, SRT
src/lib/export.ts           Frame-accurate MP4 export (Mediabunny / WebCodecs)
src/templates/*.json        Built-in styles
src/components/             Preview, lyrics editor, template gallery, import dialog
```

Preview and export use the same renderer and deterministic "randomness", so the MP4 matches the preview.
