import json
from collections import defaultdict
L = {'ara':'ar','ind':'id','vie':'vi','kor':'ko'}
sent = {}
for lang in ['eng']+list(L):
    for line in open(f'{lang}_sentences_detailed.tsv', encoding='utf-8'):
        p = line.rstrip('\n').split('\t')
        if len(p) >= 4: sent[int(p[0])] = (lang, p[2], p[3])
lang_of = {i:v[0] for i,v in sent.items()}
tgt = {i for i,l in lang_of.items() if l in L}
# pass 1: neighbours of target-language sentences (any language)
nb = defaultdict(set)   # neighbour id -> target ids
for line in open('links.csv'):
    a,b = line.split('\t'); a=int(a); b=int(b)
    if a in tgt and b not in tgt: nb[b].add(a)
    elif b in tgt and a not in tgt: nb[a].add(b)
print('neighbour ids', len(nb))
# pass 2: eng <-> neighbour (bridge) links, plus direct
eng2 = defaultdict(set)
for line in open('links.csv'):
    a,b = line.split('\t'); a=int(a); b=int(b)
    if lang_of.get(a)=='eng':
        if b in tgt: eng2[a].add(b)
        elif b in nb: eng2[a].update(nb[b])
out = {}
for a, ts in eng2.items():
    d = defaultdict(list)
    for t in ts: d[L[lang_of[t]]].append({'id': t, 'text': sent[t][1], 'by': sent[t][2]})
    out[a] = {'en': sent[a][1], 'by': sent[a][2], 'tr': d}
print('eng with any', len(out))
for l in L.values(): print(l, sum(1 for v in out.values() if l in v['tr']))
print('four-way', sum(1 for v in out.values() if len(v['tr'])==4))
json.dump(out, open('pairs2.json','w'), ensure_ascii=False)
