# Lyric Studio: game plan

## Goal

A musician drops in a clip recorded for TikTok and gets back a lyric video that looks native to the platform:
- auto-captioned from the vocals
- animated in a TikTok/internet style, not plain subtitles
- never covered by TikTok's UI

It should be usable by other artists, not just us.

## Decisions so far

| Question | Decision | Why |
| --- | --- | --- |
| Lyrics source | Auto-transcribe (Whisper) + manual edit pass | What you picked. Paste-and-align is the planned accuracy upgrade (Phase 2). |
| Platform | Browser app, all processing local | $0 hosting, private, shareable by link, no installs. |
| AI animations | Via Claude Code for now | Templates are JSON, so Claude writes new ones with no API cost. In-app for other users later. |
| Styles | All four families + your references | 18 built in, led by the zachdoaa-inspired Blackout / Red Card / Statement / Solitude. |

## Phase 1: MVP ✅ (this branch)

- Upload → local Whisper transcription with word timestamps (WebGPU, CPU fallback, 12 languages + auto)
- Lyrics editor: edit text (auto-retimes), merge/delete/add lines, per-line timing, global sync offset
- 14 JSON templates covering 4 style families; live animated thumbnails; import custom JSON
- Renderer: chunking, balanced line wrapping, active-word highlight/box/karaoke fill, 12 enter + 5 exit
  animations, shake/tilt/wobble/float/RGB split/flicker, punch-zoom/flash/grain/vignette/dim
- TikTok safe-zone enforcement (text can't leave it) + preview overlay mocking TikTok's UI
- Fill 9:16 or fit with blurred background (for landscape clips)
- Frame-accurate 1080×1920 MP4 export with original audio, fully in-browser
- Autosave per video, project save/load, SRT export
- Claude Skill `lyric-template` + validator for generating new styles

## Phase 2: accuracy and feel (after you test with real clips)

1. **Paste lyrics + auto-align.** Paste the real lyrics; match them to Whisper's word timings (fuzzy alignment).
   This is the biggest accuracy win for sung vocals.
2. **Word-level timing editor.** A waveform lane with draggable word blocks, plus a "tap to sync" mode (tap spacebar on each word).
3. **Beat sync.** Detect beats (local onset detection) so punch-zoom/flash/shake hit the drums, not just word starts.
4. ✅ **Templates from your references** (zachdoaa-style): Blackout, Red Card, Statement, Solitude, plus renderer support for
   spread words, text cards, blend modes and payoff words (`*starred*` or last word of each line). Next: the pink glitter-burst accent.
5. **Per-line style overrides.** E.g. the hook line in a different template or color.
6. Emoji/sticker accents and keyword emphasis (auto-bigger words for "love", "money", the song title…).

## Phase 3: other people using it

1. Deploy as a static site (Vercel/Netlify, free). Share the link.
2. **In-app "describe a style" box** calling the Claude API with the user's own API key (BYOK).
   It outputs template JSON validated by the same schema. No backend needed.
3. Optional vocal isolation before transcription (in-browser source separation; heavy, opt-in).
4. Onboarding, sample clip, template favorites, share/import template links.

## Phase 4: product (only if there's demand)

- Accounts + cloud project sync, a hosted AI template generator (you pay per generation, so you'd need billing/limits)
- Mobile support (phones can't run this workload well in-browser, so it needs a server render path or a native app)
- Template marketplace / community templates

## Cost estimates

**Running it:** $0 to host (static files). Compute happens on each user's device.
The speech model is downloaded once per browser from Hugging Face's CDN.

**AI template generation (Phase 3, if in-app):** one template is ~2k tokens in and ~1k out, roughly 1–3¢ per
generation on a mid-tier Claude model. Check current API pricing before launch. With BYOK, users pay their own.

**Building it (your Claude usage):**

| Phase | Rough effort |
| --- | --- |
| 1 · MVP | ~1 long session (done) |
| 2 · accuracy & feel | 2–3 sessions |
| 3 · multi-user + in-app AI | 2–3 sessions |
| 4 · accounts/billing/mobile | 4–6+ sessions |

A "session" here is a long, focused build conversation. On Pro that's a big share of a week's usage; on Max it's comfortable.
Asking for new templates via the skill is cheap (a small fraction of a session each).

## Risks and honest trade-offs

- **Transcription quality on songs is the weakest link.** Expect to fix some words. Phase 2 #1 is the real fix.
- **Desktop Chrome/Edge only, realistically.** Safari/Firefox work partially. Phones mostly won't.
- **Long videos** (> 3–4 min) can run out of memory during export. TikTok clips are usually short, so this is fine for now.
- **Safe zone numbers are conservative estimates.** TikTok changes its UI, so they're kept in one place (`src/lib/tiktok.ts`).
- **Fonts:** only free Google Fonts, so there's no licensing risk if others use it.

## Open questions for you

1. Mostly your own songs, or should other artists be able to use this soon? That decides when Phase 3 happens.
2. Which languages do you sing in? I added Greek + 11 others. Whisper's accuracy varies a lot by language.
3. Do you have stems (an acapella track)? Transcribing the acapella gives much better lyrics. We could add an optional "vocal track" upload.
