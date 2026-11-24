import sys
def emit(lessons, path):
    out = ["S = {}"]
    for lid,(t,i,ws) in lessons.items():
        out.append(f"S[{lid!r}] = dict(t={t!r}, i={i!r}, w=[")
        for row in ws:
            w,tr,c = row[:3]; o = row[3] if len(row)>3 else {}
            out.append(f"  ({w!r},{tr!r},{c!r},{o!r}),")
        out.append(" ])")
    open(path,'w').write("\n".join(out)+"\n")
