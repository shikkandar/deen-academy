"""Contents and running heads for the Arabic original (ar) and our Tamil of it (ta), from the heading blocks.
Chapters are the `chapter` headings, items the `topic` headings (or `section` ones in a chapter without topics).
Also sets each page's header.running_head to the heading in force. Run after new pages land:
    python3 scripts/sahaba/gen-toc-ar.py"""
import json, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'sahaba')
TOTAL = 1778  # printed pages of the Arabic edition (4 volumes)
ids = sorted(int(f[:4]) for f in os.listdir(os.path.join(ROOT, 'ar')) if f.endswith('.json'))


def load(lang, i):
    p = os.path.join(ROOT, lang, f'{i:04d}.json')
    return json.load(open(p)) if os.path.exists(p) else None


tocs = {lang: {'title': title, 'total': TOTAL, 'chapters': []} for lang, title in (('ar', 'الفهرس'), ('ta', 'பொருளடக்கம்'))}
head = {'ar': '', 'ta': ''}
for i in ids:
    pages = {lang: load(lang, i) for lang in ('ar', 'ta')}
    if not pages['ar'] or not pages['ta']:
        continue
    for lang in ('ar', 'ta'):
        pages[lang]['header']['running_head'] = head[lang]
    for k, (a, t) in enumerate(zip(pages['ar']['blocks'], pages['ta']['blocks'])):
        if a['type'] != 'heading':
            continue
        for lang, b in (('ar', a), ('ta', t)):
            text = b['text'].strip()
            chapters = tocs[lang]['chapters']
            if b.get('level') == 'chapter' or not chapters:
                chapters.append({'title': text if b.get('level') == 'chapter' else ('المقدمة' if lang == 'ar' else 'தொடக்கம்'), 'items': [], '_page': i})
            if b.get('level') in ('topic', 'section'):
                items = chapters[-1]['items']
                has_topics = any(x.get('_topic') for x in items)
                if b['level'] == 'topic' or not has_topics:
                    items.append({'label': text, 'page': i, **({'_topic': True} if b['level'] == 'topic' else {})})
            if b.get('level') in ('chapter', 'topic'):
                head[lang] = text
                if k == 0:
                    pages[lang]['header']['running_head'] = text
    for lang in ('ar', 'ta'):
        json.dump(pages[lang], open(os.path.join(ROOT, lang, f'{i:04d}.json'), 'w'), ensure_ascii=False, indent=0)
for lang, toc in tocs.items():
    for c in toc['chapters']:
        if not c['items']:  # a chapter with no topic headings opens at its own page
            c['items'].append({'label': c['title'], 'page': c['_page']})
        c.pop('_page', None)
        for it in c['items']:
            it.pop('_topic', None)
    json.dump(toc, open(os.path.join(ROOT, f'toc-{lang}.json'), 'w'), ensure_ascii=False, indent=1)
print({lang: (len(t['chapters']), sum(len(c['items']) for c in t['chapters'])) for lang, t in tocs.items()})
