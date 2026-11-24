# Course data pipeline

The lessons in `src/lib/server/learn/data/lessons.json` are generated here.

1. **Sources (not committed, downloaded when needed)**
   - CEFR-J Vocabulary Profile 1.5: https://github.com/openlanguageprofiles/olp-en-cefrj (free for commercial use with citation)
   - Tatoeba exports (CC BY 2.0 FR): https://downloads.tatoeba.org/exports/ (`links.tar.bz2` and `per_language/{eng,ara,ind,vie,kor}/*_sentences_detailed.tsv.bz2`)
2. `trans.py` links English sentences to their Arabic/Indonesian/Vietnamese/Korean translations (direct and via one bridge sentence) into `pairs2.json`.
3. `plan.py` + `pick.py` pick, per lesson topic, words whose CEFR-J level matches and that have a sentence.
4. `sheets/*.py` hold the authored lessons (tips, word translations, sentences). `gen/mk_*.py` generate the A2 and B1 sheets.
   A word's sentence is either a Tatoeba sentence (`'T'` or with per-language overrides) or a custom sentence written by Learnly AI.
5. `build.py` merges everything, validates it (4 languages everywhere, correct script, the word appears in its sentence, CEFR-J level matches) and writes `out/lessons.json` and `out/credits.json`.
6. `align.py` is a heuristic report: does each translated word show up in its translated sentence? Most remaining flags are verb conjugation false positives; review the rest by hand.

Run from a folder that contains the downloaded data: `python3 build.py`, then copy `out/*.json` into `src/lib/server/learn/data/`.
