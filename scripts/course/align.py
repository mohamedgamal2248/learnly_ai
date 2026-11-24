import json, re
d = json.load(open('out/lessons.json'))
DIAC = re.compile('[ً-ٰٟ]')
def alts(s): return [a.strip() for a in re.split(r'\s*/\s*', s) if a.strip()]
def norm_ar(s): return DIAC.sub('', s)
def hit(lang, tr, sent):
    sent_l = sent.lower()
    for a in alts(tr):
        a = re.sub(r'\(.*?\)', '', a).strip().lower()
        if not a: continue
        if lang == 'ar':
            a = norm_ar(a); s = norm_ar(sent)
            a2 = re.sub(r'^(ال)', '', a); stem = a2[:max(3, len(a2)-2)]
            if stem in s or a2 in s: return True
        elif lang == 'id':
            stem = a[:max(4, len(a)-3)]
            if stem in sent_l: return True
        elif lang == 'vi':
            if a in sent_l: return True
        elif lang == 'ko':
            a2 = re.sub(r'(하다|다)$', '', a.replace('~','').strip())
            for stem in {a2[:2], a2[:3], a2}:
                if stem and stem in sent: return True
    return False
bad = []
n = 0
for l in d['lessons']:
    for w in l['words']:
        for lang in ('ar','id','vi','ko'):
            n += 1
            if not hit(lang, w['tr'][lang], w['exTr'][lang]): bad.append((l['id'], w['en'], lang, w['tr'][lang], w['exTr'][lang]))
print(len(bad), 'of', n)
for b in bad: print(*b, sep=' | ')
