# Ελίνα Κοσμίδου — design plan

Subject: a CBT psychologist (MSc, AUTH) with a newly furnished private office in Thermi, Thessaloniki, who also sees people online.
Audience: adults in Thermi and east Thessaloniki, parents of teens, and young women. Most arrive on a phone, are hesitant and have never phoned a therapist.
Primary job: get that hesitant person to call or send a Viber message.

## Palette (brand colours sampled from her logo, plus her office)

Revised after finding her logo: navy and grey-sage replace the deep green as the dark brand colour.
| token | hex | where it comes from | role |
|---|---|---|---|
| wall | `#E2E6D7` | pale sage wall behind the bookshelf | light section base (not cream) |
| mist | `#F6F7F1` | bouclé armchair / sofa | cards, solid nav |
| navy (`--sage` token) | `#272B3E` | logo infinity loop and sprout | headings, dark sections, primary buttons |
| leaf | `#8E918A` | logo grey-sage loop and wordmark | illustration fills, fine detail |
| ink | `#20261E` | — | body text (green-black, not #111) |
| oak | `#A47B4C` | desk and shelves | fine detail, step numbers, arrows |
| cushion | `#C63F28` | the red cushion on the sofa | small accent only: active dot, today badge, quote marks |

## Type
- Literata (variable, opsz): headlines, node text, quotes. Chosen by Giorgos from the specimen.
- Commissioner: body, UI, buttons. 17px / 1.6.
- Scale: 14 · 17 · 21 · 27 · 36 · 48 · 72 (roughly 1.27 ratio). Sentence case throughout.

## Layout
Desktop hero: Elina's portrait from her Maps listing, sized by height on the right and fading into navy under the left-aligned text. At 1100px and below it fills the hero behind bottom-anchored text; on phones it fills the top two-thirds so her face stays clear of the centred text.
Nav and footer: her logo, traced to two-tone SVG symbols whose colours come from `--lg-navy` and `--lg-sage` (white over the photo, brand colours on the solid nav).
About: an office carousel in the photo slot (second room first, then main room, desk, door sign, hourglass). It crossfades every 5 s at the client's request, pauses on hover/focus/off-screen, has dots, swipe and a pause button, stays still under reduced motion, and is sticky on desktop so it stays in view beside the bio.
```
| Ελίνα Κοσμίδου        Με τι βοηθάω  Η θεραπεία  Σχετικά  Επικοινωνία [Κάλεσε 69…] |
|                                                                          |
|  Ας δούμε μαζί                                  (desk, lamp, sofa)       |
|  τι σε βαραίνει.                                                         |
|  CBT για ενήλικες, εφήβους και γονείς. Θέρμη ή online.                   |
|  [Κάλεσε 69X XXX XXXX]  [Στείλε μήνυμα στο Viber]                        |
|  ● Ανοιχτά τώρα, έως 21:00                                               |
|  MSc Κλινική Ψυχική Υγεία ΑΠΘ. Εκπαίδευση CBT κατά EABCT.                |
```
Mobile hero: its own page. Centred stack over the blurred and darkened photo, full-width buttons up to 320px wide.
```
| Ελίνα Κοσμίδου   ☰ |
|                    |
|   Ας δούμε μαζί    |
|  τι σε βαραίνει.   |
|     subline        |
| [ Κάλεσε 69… ]     |
| [ Viber ]          |
|  ● Ανοιχτά τώρα    |
|   credentials      |
```
Sections in order:
1. Help: 8 illustrated cards in a swipe row, each opening a detail sheet.
2. The CBT loop. This is the one memorable element: pick an everyday situation and watch the thought, feeling and action chain, then switch to how it can go after therapy.
3. Reviews: none. The section and its code are removed. Add a reviews section only once she has real Google reviews, quoted word for word with their source.
4. About: the office corner photo bleeds off the left edge, with the bio and credentials beside it.
5. How we start: three numbered steps (a real sequence) and a short FAQ.
6. Contact: a dark sage section with hours (today highlighted), address, directions and the call action repeated.
Plus a sticky call/Viber bar on mobile once the hero is out of view.

## Principles
- The room is the brand. Every colour is in the photo, and no invented motif is placed over text.
- Spend the boldness on the CBT loop, because it explains the method by letting people try it. Everything else stays quiet.
- Motion: one staggered hero entrance. Everything else responds to the visitor (sheet, menu, loop switch, eased anchor scroll).
- Nothing invented: no reviews, ratings or testimonials. Example thoughts in the CBT section are labelled as examples and not shown as quotes.

## Review against the generic tells (what I changed)
- Cream background: I first reached for the bouclé colour as the page base, but it sits near #F4F1EA. I switched the base to the sage wall `#E2E6D7`, so the page reads green-grey rather than cream.
- Terracotta accent near #D97757: the cushion is a deeper red, so I pushed it to `#C63F28`, used it only for actions and quote marks, and paired it with sage, not cream.
- Deep green + yellow (rejected before): there is no yellow. Oak brown is the secondary colour and appears only in hairlines and numbers.
- Eyebrows, middle dots, arrows: none. Section headings are plain sentences.
- Numbering only on "Πώς ξεκινάμε", which really is a sequence. Services are not numbered.
- A map was planned, then cut: I don't have street data, so a fake SVG map would mislead. A directions button does the job.

## Draft: "professional pass" (draft.html)
Generated from index.html by a script, so the two can be compared side by side. Requested after comparing with a competitor site that felt more established.
- Manrope for everything (the reference site's font). Sans specimen: Manrope, Advent Pro, Commissioner, Didact Gothic.
- Nav is always solid (light background, full-colour logo, navy button) and bigger: 88px, logo 80px.
- No hover fades, sliding underlines or hero entrance animation. Only the carousel, menu and detail sheets move.
- Topic cards use CC0 stock photos from StockSnap (found through Openverse) that show each problem in a calm way, mostly without identifiable faces. Sources are in img/CREDITS.txt.
- Split hero, after a reference the client liked: copy and buttons on a plain light panel (55%), portrait in its own panel (45%) with no overlay. On phones the photo is on top and the text is on a solid panel below. A strip of three facts follows: in person, online, confidentiality.
- The CBT section is a static three-step example (thought, feeling, behaviour) instead of the interactive loop.
- Contact: tinted office photo with an angled top edge, a right-aligned heading with one call button, and an icon list (phone, Viber, email when set, address, short hours with today in bold, live status).
- Footer adds a legal row: copyright, privacy policy (privacy.html) and licence number from CONFIG.
- All copy uses the formal «εσείς».

## Standing rules from Giorgos
- No custom mouse cursors, cursor trails or cursor effects.
- No decorative or "extra" animation: no scroll-triggered reveals, parallax, hover fades, floating or bouncing elements, animated counters or text effects. Motion is allowed only where it answers a visitor's action (menu, detail sheet, carousel the client asked for) and stays off under reduced motion.
- When borrowing from another site or skill, take the structure and content ideas, not its effects.
- No reviews, ratings or testimonials unless they are real, quoted word for word, with their source.

## Taken from the friend's beauty-salon-website skill (and what was left out)
Taken, all of it "invisible quality":
- One shared grade on every photo (less saturation, lifted blacks, slight warmth), so the stock and office photos read as one shoot.
- Responsive WebP (480/800 or 800/1200/1600) with srcset and sizes, explicit width and height, one priority hero image with a preload, lazy loading below the fold. Desktop weight with everything loaded went from 1.7 MB to 750 KB.
- Favicon and app icons drawn from her logo mark, a web manifest, and a 1200x630 social card (img/og.jpg) with og:image size and alt.
- The skill's contrast scan and keyboard/accessible-name check. The CBT labels failed (3.0:1) and now use #73502C. The remaining flag (white caption on the carousel's dark gradient) is a false positive.
Left out on purpose: custom cursor, intro loader, parallax and floating photos, glow under the cursor, letter-roll and magnetic buttons, breathing light pools, dust particles, odometer numbers, review deck, footer wordmark effect, chapter rail. The friend's memory notes (cursor, glowing motion, model-like hero) are that client's taste, not Giorgos's.

## Palette v2: warm linen (client's pick, Nov 2026)
Chosen over soft sage and deep navy from rendered options of the topics section. Navy (#272B3E) stays for the logo, headings and buttons.
| token | hex | role |
|---|---|---|
| --wall | #F4EFE8 | warm linen, section backgrounds |
| --wall-2 | #EAE2D7 | deeper linen |
| --mist | #FBF8F4 | bouclé white: nav, hero panel, light sections |
| cards | #FFFDF9 | rounded cards (26px), inset photos (18px) |
| chip | #EDE3D6 | pill buttons inside cards |
Shadows are warm-tinted (rgba(70,52,34,...)). The client asked for "more rounded stuff", which supersedes the earlier square-photo rule for cards. Full-bleed photos (hero, carousel) stay square.
