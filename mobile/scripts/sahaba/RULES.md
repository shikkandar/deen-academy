# Hayatus Sahaba — page JSON rules (Deen Academy app)

The book is bundled page by page, like Muntakhab Ahadith: one JSON file per printed page in
`mobile/assets/sahaba/<lang>/<id>.json` (absolute: `/Users/sabina/Documents/way-to-jannah/mobile/assets/sahaba/`).

| lang | what | source | id |
|---|---|---|---|
| `en` | The Lives of the Sahabah (English, 3 volumes) | `hayat/en/vol1.pdf` `vol2.pdf` `vol3.pdf` | volume × 1000 + printed page (Vol 2 p. 45 → `2045`) |
| `tp` | printed Tamil edition, Darul Marashid (பாகம் 1 அத்தியாயம் 1 and 2) | `hayat/p1/part1.pdf` (part 1), `hayat/p2/part2.pdf` (part 2) | part × 1000 + printed page (part 2 p. 45 → `2045`) |
| `ta` | our Tamil of each `en` page (AI translation) | `assets/sahaba/en/<id>.json` | same id as the English page |

File names are the id padded to 4 digits: `1045.json`, `2001.json`.

`hayat/...` paths are under the scratchpad:
`/private/tmp/claude-504/-Users-sabina-Documents-way-to-jannah/c73a7c2a-ac99-4f33-867c-03b04c0d4f7e/scratchpad/hayat/`.
Python with PyMuPDF and Pillow: `<scratchpad>/venv/bin/python -I <script>`. Render one page with
`fitz.open(pdf)[index].get_pixmap(dpi=DPI).save(png)` (English DPI 120, Tamil DPI 150; for a hard-to-read part,
crop and render that part larger with `clip=fitz.Rect(...)`), then look at the PNG with the Read tool.
Keep your scripts and PNGs under `<scratchpad>/sahaba-work/<your job id>/`, never in the repo. Delete PNGs once a
page is written.

The scans are the source. The English PDFs have a text layer, but it is bad OCR (Arabic and symbols are garbage):
you may use `page.get_text()` as a typing aid for English sentences, but always check it against the image and
never take Arabic or symbols from it.

## Which pages

You are given a range of PDF page indexes (0-based). For each index: render it, read the printed page number
(top corner), and write `<id>.json`. Skip — write nothing — for: covers, title pages, publisher/copyright pages,
blank pages, decorative pages, and the CONTENTS / பொருளடக்கம் / தலைப்புகள் pages (a separate job builds the
contents). Forewords, introductions, the translator's notes and the author's biography ARE written (they have
printed page numbers). A page whose number is not printed: use the previous page's number + 1.

## File shape

```json
{
  "header": { "book_title": "Hayatus Sahaba", "volume": 1, "page_number": 45, "running_head": "Da'wah towards Allaah and His Rasul" },
  "blocks": [ ... ]
}
```
`book_title`: `Hayatus Sahaba` (en) / `ஹயாத்துஸ் ஸஹாபா` (tp, ta). `volume`: the volume / part number.
`running_head`: the chapter line printed at the top of the page in that language (on English pages it is the
heading at the top other than "THE LIVES OF THE SAHABAH (Vol-1)"; if the page only prints the book title, use the
last chapter/topic heading in force). Optional.

## Blocks, in reading order

- `{"type":"heading","level":"chapter"|"topic"|"section","text":"...","arabic_text":"..."}`
  chapter = chapter titles ("Chapter One — …", "அத்தியாயம்", "பாடம் 2 …"); topic = big bold centred headings;
  section = the bold headings over each story/report ("Rasulullaah ﷺ Invites Hadhrat Abu Bakr (RA)…").
  `arabic_text` only if the heading is also printed in Arabic.
- `{"type":"paragraph","text":"..."}` prose: the author's/translator's words, explanations, forewords.
- `{"type":"narration","narrator":"...","text":"...","arabic_text":"...","source":"..."}` a report (hadith / athar):
  `narrator` the companion/person reporting (e.g. "Hadhrat Anas (RA)" / "ஹஜ்ரத் அனஸ் (ரலி)"), optional;
  `text` the whole report as printed (including "Hadhrat Anas (RA) reports that…"); `arabic_text` only where the
  page prints Arabic for it; `source` the reference printed right after it (Tamil pages often print it as
  "நூல்: அஹ்மத்"), optional. Where the English page puts the reference in a footnote, leave `source` out and keep
  the `[^n]` marker.
- `{"type":"quran","arabic_text":"...","reference":"...","text":"..."}` a quoted verse: the Arabic as printed
  with its vowel marks, `reference` as printed (e.g. "Surah Aal Imraan, verse 110" / "ஸூரத்துல் ஹஷ்ர்: 8-9"),
  `text` the translation printed with it.
- `{"type":"poetry","arabic_text":"...","text":"..."}` lines of poetry (Arabic lines joined with "\n").
- `{"type":"footnote","number":3,"text":"..."}` each footnote at the bottom of the page, in order. Tamil pages
  also print a long commentary under a rule at the bottom (smaller font, numbered): each numbered note is one
  footnote; an un-numbered commentary paragraph there is a footnote without `number`.

`"continued": true` on the FIRST block of a page when it carries on a paragraph/narration/verse/footnote from the
previous page. Footnote markers inside text: `[^3]` exactly where the superscript is printed. No Markdown, no HTML.
A block with a word you could not read: best guess plus `"unclear": true`.

## Text

- Type everything printed, in full, in reading order. Nothing summarised, skipped, reworded or added. Keep the
  edition's spellings ("Rasulullaah", "Hadhrat", "Allaah", "Sahabah"; Tamil as printed). Rejoin words broken by a
  line-end hyphen; otherwise lines run on into one paragraph.
- The printed calligraphic honorifics become text: after the Prophet → `ﷺ`; after a Sahabi (رضي الله عنه/عنها/
  عنهم, singular or plural) → `(RA)` in English, `(ரலி)` in Tamil; after Allaah (تبارك وتعالى / جل جلاله) → nothing
  in English (write just "Allaah"), and in Tamil as printed in words if printed in words, otherwise nothing; after
  a scholar (رحمه الله) → `(RAH)` / `(ரஹ்)`; after a prophet (عليه السلام) → `(AS)` / `(அலை)`.
- Arabic: type verses, du'as, poetry and printed hadith Arabic carefully, with tashkeel where printed. Keep the
  Quran ornament brackets out (just the words). Arabic numerals as printed.
- Bold words inside a paragraph: plain text (no marking).

## The Tamil translation job (`ta`)

For each English page `assets/sahaba/en/<id>.json` in your range, write `assets/sahaba/ta/<id>.json`: the same
JSON with the same blocks in the same order, every English string translated into Tamil, and these left exactly as
they are: `arabic_text`, `number`, `level`, `continued`, `unclear`, `type`, and `[^n]` markers.
`header.book_title` = `ஹயாத்துஸ் ஸஹாபா`, `running_head` translated. Follow
`mobile/scripts/hadith-tamil/RULES.md` "How to translate" for style and terms (ஸல், ரலி, names, Islamic terms,
literary-but-simple Tamil, respectful forms). Also:
- Translate the English faithfully and completely: no summarising, no additions, no commentary. Bracketed
  explanations in the English stay bracketed.
- Rasulullaah → அல்லாஹ்வின் தூதர் (ஸல்) அவர்கள் / நபி (ஸல்) அவர்கள் (follow the English: "Rasulullaah" →
  "ரஸூலுல்லாஹ் (ஸல்) அவர்கள்" is also fine — be consistent within a page); ﷺ → (ஸல்); (RA) → (ரலி);
  (RAH) → (ரஹ்); (AS) → (அலை); Hadhrat → ஹஜ்ரத்; Sahabah → ஸஹாபாக்கள்; Allaah → அல்லாஹ்.
- Names in usual Tamil Muslim spelling (அபூபக்ர், உமர், உஸ்மான், அலீ, அபூஹுரைரா, ஆயிஷா, இப்னு அப்பாஸ்,
  இப்னு மஸ்ஊத், முஆத் பின் ஜபல், காலித் பின் வலீத், ஸஅத் பின் அபீவக்காஸ், அபூஉபைதா, பிலால்,…).
- Hadith book names in references: Bukhari → புகாரி, Muslim → முஸ்லிம், Abu Dawood → அபூதாவூத், Tirmidhi →
  திர்மிதீ, Nasa'i → நஸாயீ, Ibn Maajah → இப்னுமாஜா, Ahmad → அஹ்மத், Tabraani → தப்ரானீ, Bayhaqi → பைஹகீ,
  Haakim → ஹாகிம், Abu Nu'aym → அபூநுஐம், Hilya → ஹில்யா, Kanzul Ummaal → கன்ஸுல் உம்மால், Majma'uz Zawaa'id →
  மஜ்மஉஸ் ஸவாயித், Ibn Sa'd → இப்னு ஸஅத், Ibn Ishaaq → இப்னு இஸ்ஹாக், Al Bidaaya → அல்பிதாயா; "Vol.1 Pg.238" →
  "பாகம் 1, பக்கம் 238".
- Quran verse references: "Surah Aal Imraan, verse 110" → "(ஸூரா ஆலு இம்ரான்: 110)".
Read the English page and `hadith-tamil/RULES.md` once; write the Tamil file with Python json.dump. One page at a
time.

## If you can no longer see the images

If a page image comes back as "[media removed …]" or you otherwise cannot see the scan, STOP at once: do not type
any page from the text layer alone. Reply with the last id you wrote from a seen image and the first index you did
not do; a fresh job will continue from there.

## Output

Write each file with Python `json.dump(page, f, ensure_ascii=False, indent=0)` from a script under your work folder.
Check it parses before moving on. A file that already exists in the target folder is done — skip it (so a job can
be rerun safely). Never edit any other file in the repo, never run git.

When your range is done reply with only: how many files you wrote, the first and last id, and up to 5 ids where
something was hard to read.
