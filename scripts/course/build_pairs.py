import csv, json, sys
from collections import defaultdict
L = {'ara':'ar','ind':'id','vie':'vi','kor':'ko'}
sent = {}
for lang in ['eng']+list(L):
    for line in open(f'{lang}_sentences_detailed.tsv', encoding='utf-8'):
        p = line.rstrip('\n').split('\t')
        if len(p) >= 4: sent[int(p[0])] = (lang, p[2], p[3])
eng_ids = {i for i,(l,_,_) in sent.items() if l=='eng'}
tr = defaultdict(lambda: defaultdict(list))   # eng id -> lang -> [ids]
for line in open('links.csv'):
    a,b = line.split('\t'); a=int(a); b=int(b)
    if a in eng_ids and b in sent and sent[b][0] in L: tr[a][sent[b][0]].append(b)
print('eng with any', len(tr))
for lang in L: print(lang, sum(1 for a in tr if lang in tr[a]))
four = [a for a in tr if all(l in tr[a] for l in L)]
print('four-way', len(four))
three = [a for a in tr if sum(l in tr[a] for l in L) >= 3]
print('>=3', len(three))
out = {}
for a in tr:
    out[a] = {'en': sent[a][1], 'by': sent[a][2], 'tr': {L[l]: [{'id': i, 'text': sent[i][1], 'by': sent[i][2]} for i in tr[a][l][:3]] for l in tr[a]}}
json.dump(out, open('pairs.json','w'), ensure_ascii=False)
