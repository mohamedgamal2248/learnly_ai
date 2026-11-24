import json, re, sys, glob, importlib.util, os
from plan import P
from units import U
pairs = json.load(open('pairs2.json')); picked = json.load(open('picked.json'))
LANGS = ['ar','id','vi','ko']
DIAC = re.compile('[ً-ٰٟـ]')
def clean(l, s): s = s.strip(); return DIAC.sub('', s) if l=='ar' else s
SS = {}
for f in sorted(glob.glob('sheets/*.py')):
    spec = importlib.util.spec_from_file_location(os.path.basename(f)[:-3], f); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); SS.update(m.S)
meta = {lid:(lvl,title) for lid,lvl,title,_ in P}
errors = []; credits = {}
import csv
from collections import defaultdict
voc = defaultdict(set)
for r in csv.DictReader(open('cefrj-vocabulary-profile-1.5.csv')):
    for h in r['headword'].split('/'): voc[h.strip().lower()].add(r['CEFR'])
warns = []
def forms(w): return {w, w+'s', w+'es', w+'ed', w+'d', w+'ing', w[:-1]+'ies', w[:-1]+'ied', w+w[-1]+'ed', w+w[-1]+'ing', w[:-1]+'ing'}
def surface(w, en):
    toks = re.findall(r"[A-Za-z']+", en)
    for t in toks:
        if t.lower() in forms(w): return t
    return None
def script_ok(l, s):
    if l=='ar': return bool(re.search('[؀-ۿ]', s))
    if l=='ko': return bool(re.search('[가-힯]', s))
    return bool(re.search('[A-Za-zÀ-ỹ]', s))
def split4(s, where):
    p = [x.strip() for x in s.split('|')]
    if len(p)!=4 or not all(p): errors.append(f'{where}: need 4 parts, got {len(p)}: {s[:40]}')
    return dict(zip(LANGS, p))
lessons = []
for lid,(lvl,title) in meta.items():
    if lid not in SS: continue
    sh = SS[lid]; words = []
    pk = {w:s for w,s in picked[lid]}
    for (w, trs, mode, opts) in sh['w']:
        where = f'{lid}/{w}'
        tr = split4(trs, where)
        src = {}
        if isinstance(mode, list):
            en, *rest = mode
            if len(rest)!=4: errors.append(f'{where}: custom needs 5')
            ex = dict(zip(LANGS, rest)); src = {l:'learnly' for l in LANGS}; src['en']='learnly'
        else:
            sid = (pk.get(w) or [None])[0]
            if sid is None: errors.append(f'{where}: no tatoeba pick'); continue
            v = pairs[str(sid)]; en = v['en']; src['en'] = f"tatoeba:{sid}"; credits[sid]=v['by']
            ex = {}
            ov = {} if mode=='T' else mode
            for l in LANGS:
                if l in ov: ex[l]=ov[l]; src[l]='learnly'
                else:
                    c = v['tr'].get(l)
                    if not c: errors.append(f'{where}: missing {l} (mode T)'); ex[l]=''; continue
                    b = min(c, key=lambda x: abs(len(x['text'])-len(en))); ex[l]=b['text']; src[l]=f"tatoeba:{b['id']}"; credits[b['id']]=b['by']
        ex = {l: clean(l, ex[l]) for l in LANGS}
        for l in LANGS:
            if not script_ok(l, ex[l]): errors.append(f'{where}: {l} sentence wrong script: {ex[l][:30]}')
            if not script_ok(l, tr[l]): errors.append(f'{where}: {l} word wrong script: {tr[l]}')
        lv = voc.get(w)
        if not lv: warns.append(f'{lid}/{w}: not in CEFR-J')
        elif lvl not in lv: warns.append(f"{lid}/{w}: CEFR-J says {','.join(sorted(lv))}, lesson is {lvl}")
        blank = opts.get('b') or surface(w, en)
        if not blank or blank.lower() not in en.lower(): errors.append(f'{where}: word not found in "{en}"')
        d = {'en': opts.get('d') or w, 'tr': tr, 'ex': en, 'exTr': ex, 'blank': blank, 'src': src}
        words.append(d)
    t = split4(sh['t'], lid+'/title'); i = split4(sh['i'], lid+'/intro')
    lessons.append({'id': lid, 'level': lvl, 'title': title, 'titleTr': t, 'intro': i, 'words': words})
order = {l['id']:k for k,l in enumerate(sorted(lessons, key=lambda x: x['id']))}
units = []
for uid,lvl,title,trs,icon,ids in U:
    if not any(i in order for i in ids): continue
    units.append({'id':uid,'level':lvl,'title':title,'titleTr':split4(trs,uid),'icon':icon,'lessons':[i for i in ids if i in order]})
lessons.sort(key=lambda x: [u['lessons'] for u in units if x['id'] in u['lessons']] and sum(len(u['lessons']) for u in units if u['id'] < '') or 0)
# order lessons by unit order
pos = {lid:k for k,lid in enumerate(l for u in units for l in u['lessons'])}
lessons.sort(key=lambda x: pos[x['id']])
for k,l in enumerate(lessons): l['n']=k+1; l['unit']=[u['id'] for u in units if l['id'] in u['lessons']][0]
os.makedirs('out', exist_ok=True)
json.dump({'units':units,'lessons':lessons}, open('out/lessons.json','w'), ensure_ascii=False, indent=0)
json.dump({str(k):v for k,v in credits.items()}, open('out/credits.json','w'), ensure_ascii=False)
print('lessons', len(lessons), 'words', sum(len(l['words']) for l in lessons), 'errors', len(errors))
for e in errors: print(' !', e)
for w in warns: print(' ~', w)
