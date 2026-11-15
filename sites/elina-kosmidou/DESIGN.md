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
Desktop hero: the office photo full-bleed, darkened by a left-to-right gradient; text left-aligned over the dark bookshelf side, the room stays readable on the right.
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
3. Reviews: a carousel rendered from CONFIG, hidden until real reviews exist.
4. About: the office corner photo bleeds off the left edge, with the bio and credentials beside it.
5. How we start: three numbered steps (a real sequence) and a short FAQ.
6. Contact: a dark sage section with hours (today highlighted), address, directions and the call action repeated.
Plus a sticky call/Viber bar on mobile once the hero is out of view.

## Principles
- The room is the brand. Every colour is in the photo, and no invented motif is placed over text.
- Spend the boldness on the CBT loop, because it explains the method by letting people try it. Everything else stays quiet.
- Motion: one staggered hero entrance. Everything else responds to the visitor (sheet, menu, loop switch, eased anchor scroll).
- Nothing invented. Reviews, rating, hours and phone live in CONFIG, and a block with no data does not render.

## Review against the generic tells (what I changed)
- Cream background: I first reached for the bouclé colour as the page base, but it sits near #F4F1EA. I switched the base to the sage wall `#E2E6D7`, so the page reads green-grey rather than cream.
- Terracotta accent near #D97757: the cushion is a deeper red, so I pushed it to `#C63F28`, used it only for actions and quote marks, and paired it with sage, not cream.
- Deep green + yellow (rejected before): there is no yellow. Oak brown is the secondary colour and appears only in hairlines and numbers.
- Eyebrows, middle dots, arrows: none. Section headings are plain sentences.
- Numbering only on "Πώς ξεκινάμε", which really is a sequence. Services are not numbered.
- A map was planned, then cut: I don't have street data, so a fake SVG map would mislead. A directions button does the job.
