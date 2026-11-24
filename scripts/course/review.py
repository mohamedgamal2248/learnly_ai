import json, sys, re
picked = json.load(open('picked.json')); pairs = json.load(open('pairs2.json'))
lo, hi = sys.argv[1], sys.argv[2]
def short(lst, en):
    return min(lst, key=lambda x: abs(len(x['text']) - len(en)*1.0))['text'] if lst else None
for lid, ws in picked.items():
    if not (lo <= lid <= hi): continue
    print('##', lid)
    for w, sids in ws:
        v = pairs[str(sids[0])]
        print(f"{w} #{sids[0]} | {v['en']} | " + ' | '.join(f"{l}:{short(v['tr'].get(l, []), v['en']) or '-'}" for l in ('ar','id','vi','ko')))
