# Tamil hadith translation rules (Way to Jannah app)

Readers: Tamil-speaking Muslims (Tamil Nadu / Sri Lanka). Accuracy and reverence matter more than speed.

Each INPUT file is a JSON array of {number, arabic, english}. For each input file write the matching OUTPUT file
(same name, under tr/out/<book>/) as a JSON object mapping each number (string key) to its Tamil text:
{"123": "...", "124": "..."}. Every input number must appear. Write it with a small python script using
json.dump(..., ensure_ascii=False) so escaping is right. Do one file at a time and write it before starting the next.
If an output file already exists and has every number, skip it.

How to translate:
- Translate from the ARABIC as the primary source; use the English to help understanding.
- Chain of narrators (isnad): do NOT translate the long chain "حدثنا فلان، حدثنا فلان...". Start, like Tamil hadith
  books do, with the Companion (or the last narrator the English names after "Narrated ..."):
  "அபூஹுரைரா (ரலி) அவர்கள் அறிவிக்கிறார்கள்: ..." or end with "... என அனஸ் (ரலி) அவர்கள் அறிவிக்கிறார்கள்."
  Translate the text (matn) fully: do not drop any sentence, do not summarise, no commentary.
- Notes of the compiler inside the hadith (e.g. "Abu Dawud said: ...", "Abu Isa said: this hadith is hasan sahih",
  other chains "a similar hadith was narrated by...") — translate them briefly as part of the text, e.g.
  "அபூதாவூத் கூறுகிறார்: ..." / "இது ஹஸன் ஸஹீஹ் ஹதீஸ் ஆகும் என அபூஈஸா (திர்மிதீ) கூறுகிறார்."
  If an entry is ONLY a chain pointing to the previous hadith, write a short Tamil line saying so, e.g.
  "மேற்கண்ட ஹதீஸ் போன்றே இன்னோர் அறிவிப்பாளர் தொடர் வழியாகவும் அறிவிக்கப்பட்டுள்ளது."
- Words the English adds that are not in the Arabic go in round brackets ( ), like Tamil hadith books.
- Standard Tamil Muslim style (Rahmath Trust / Muntakhab Ahadith Tamil):
  * رسول الله → அல்லாஹ்வின் தூதர் (ஸல்) அவர்கள்; النبي → நபி (ஸல்) அவர்கள்; ﷺ → (ஸல்)
  * رضي الله عنه/عنها/عنهما → (ரலி); Allah → அல்லாஹ்; عز وجل → வல்லமையும் மாண்பும் மிக்க அல்லாஹ்
  * Jannah → சொர்க்கம்; Jahannam → நரகம்; salah → தொழுகை; wudu → உளூ; ghusl → குளியல் (குஸ்ல்); tayammum → தயம்மும்;
    zakah → ஸகாத்; sadaqah → தர்மம் (ஸதகா); sawm → நோன்பு; hajj → ஹஜ்; umrah → உம்ரா; iman → ஈமான்; Qiyamah → மறுமை நாள்;
    sunnah → சுன்னா; bid'ah → பித்அத்; halal/haram → ஹலால்/ஹராம்; masjid → பள்ளிவாசல்; adhan → பாங்கு; iqamah → இகாமத்;
    rak'ah → ரக்அத்; sajdah → ஸஜ்தா; ruku → ருகூஉ; witr → வித்ர்; jumu'ah → ஜுமுஆ; eid → பெருநாள்; jihad → ஜிஹாத் (அறப்போர்);
    angels → வானவர்கள்; Shaytan → ஷைத்தான்; dunya → இவ்வுலகம்; akhirah → மறுமை.
  * Names in usual Tamil Muslim spelling: Abu Hurayrah → அபூஹுரைரா, Aishah → ஆயிஷா, Ibn Abbas → இப்னு அப்பாஸ்,
    Ibn Umar → இப்னு உமர், Anas bin Malik → அனஸ் பின் மாலிக், Umar → உமர், Ali → அலீ, Uthman → உஸ்மான்,
    Abu Bakr → அபூபக்ர், Jabir → ஜாபிர், Abu Sa'id al-Khudri → அபூஸயீத் அல்குத்ரீ, Ibn Mas'ud → இப்னு மஸ்ஊத்,
    Mu'adh bin Jabal → முஆத் பின் ஜபல், Abu Dharr → அபூதர், Jibril → ஜிப்ரீல்.
  * Books: Bukhari → புகாரி, Muslim → முஸ்லிம், Abu Dawud → அபூதாவூத், Tirmidhi → திர்மிதீ, Nasai → நஸாயீ,
    Ibn Majah → இப்னுமாஜா, Malik → மாலிக், Ahmad → அஹ்மத். Grades: sahih → ஸஹீஹ், hasan → ஹஸன், da'if → ளயீஃப்,
    gharib → கரீப்.
  * Natural, clear, literary-but-simple Tamil; respectful forms (அவர்கள், கூறினார்கள்).
  * Quran verses quoted: translate the meaning, add the reference in brackets if known, e.g. (அல்குர்ஆன் 2:286).
- Fiqh/legal hadith (purity, divorce, inheritance, hudud, trade): be precise; keep technical terms with a Tamil gloss
  in brackets the first time in a hadith, e.g. "ஸாஉ (ஓர் அளவை)". Explicit bodily matters: translate faithfully but
  modestly, as Tamil fiqh books do.

When all your files are done, check each output parses and has exactly the input's numbers. Reply with only:
files done, hadith count, and up to 5 hadith numbers where you were unsure of the meaning (one line each).

Note: run your python scripts with /opt/homebrew/bin/python3 (the system /usr/bin/python3 rejects UTF-8 script files). Keep scripts in scratchpad/trscripts/.
Other agents share scratchpad/trscripts/: name every script/temp file with your first file id, e.g. trscripts/abudawud-29-1_write.py.
Bracket glosses must only clarify; never add words that narrow or widen a ruling (e.g. do not add "stillborn", "only men", etc. unless the Arabic says it).
