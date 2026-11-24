import csv, json, re
from collections import defaultdict
from plan import P
voc = defaultdict(lambda: defaultdict(set))
for r in csv.DictReader(open('cefrj-vocabulary-profile-1.5.csv')):
    for h in r['headword'].split('/'):
        voc[h.strip().lower()][r['CEFR']].add(r['pos'])
pairs = json.load(open('pairs2.json'))
# index English sentences by token
BAD = re.compile(r"\b(Tom|Mary|John|Boston|Tokyo|Japan|Japanese|kill|die|dead|death|fuck|shit|sex|drunk|gun|bomb|God|Jesus|Allah|Trump)\b", re.I)
by_tok = defaultdict(list)
for sid, v in pairs.items():
    t = v['en']; w = t.split()
    if not (3 <= len(w) <= 9) or BAD.search(t) or re.search(r'\d', t): continue
    nt = len(v['tr'])
    for tok in set(re.findall(r"[a-z']+", t.lower())): by_tok[tok].append((sid, nt, len(w)))
def forms(w): return {w, w+'s', w+'es', w+'ed', w+'d', w+'ing', w[:-1]+'ies' if w.endswith('y') else w+'s', w[:-1]+'ied' if w.endswith('y') else w+'ed'}
def best(w, n=3):
    c = {}
    for f in forms(w):
        for sid, nt, ln in by_tok.get(f, []): c[sid] = (nt, ln)
    # score: translation coverage first, then shorter
    ranked = sorted(c.items(), key=lambda kv: (-kv[1][0], kv[1][1]))
    return [(sid, *c[sid]) for sid, _ in ranked[:n]]
out = {}
for lid, lvl, title, words in P:
    chosen = []
    for w in dict.fromkeys(words.split()):
        if lvl not in voc.get(w, {}): continue
        b = best(w)
        if not b or b[0][1] < 2: continue
        chosen.append((w, b))
        if len(chosen) == 8: break
    out[lid] = chosen
    print(lid, lvl, title, '->', len(chosen), ' '.join(w for w,_ in chosen))
json.dump({k:[(w,[x[0] for x in b]) for w,b in v] for k,v in out.items()}, open('picked.json','w'))
