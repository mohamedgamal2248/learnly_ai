"use client";

import Link from "next/link";
import credits from "@/lib/server/learn/data/credits.json";

const authors = (credits.authors as string[]).filter((a) => a && a !== "\\N");

export default function Credits() {
  return (
    <article className="lc stack legal" style={{ gap: 14 }}>
      <h1>Sources and credits</h1>
      <p className="muted">The course is built from open resources. Here is exactly what comes from where.</p>

      <section>
        <h2>Which words, at which level</h2>
        <p>The words in each lesson were chosen from the <b>CEFR-J Vocabulary Profile (version 1.5)</b>, so every word is an official A1, A2 or B1 word. The grammar tips follow the points listed in the CEFR-J Grammar Profile.</p>
        <p className="hint">Compiled by Yukio Tono, Tokyo University of Foreign Studies (TUFS). Provided through <a className="md-link" href="https://github.com/openlanguageprofiles/olp-en-cefrj" target="_blank" rel="noreferrer">Open Language Profiles</a> and the <a className="md-link" href="http://www.cefr-j.org/" target="_blank" rel="noreferrer">CEFR-J project</a>. Free for commercial use with citation.</p>
      </section>

      <section>
        <h2>Example sentences</h2>
        <p>About one in five example sentences (and some translations) come from <a className="md-link" href="https://tatoeba.org" target="_blank" rel="noreferrer">Tatoeba.org</a>, a collaborative sentence collection, under the <b>CC BY 2.0 FR</b> licence. Each one links to its page in the lesson. We used {credits.sentences} Tatoeba sentences written by {authors.length} contributors, listed below.</p>
        <p>The other sentences and translations were written by Learnly AI with the help of an AI model, using simple everyday English. They are checked automatically (every word and sentence exists in all four languages, in the right script, and the learned word appears in its sentence), but they are <b>not yet reviewed by native-speaker teachers</b>. If something sounds wrong, please tell us.</p>
      </section>

      <section>
        <h2>Tatoeba contributors</h2>
        <p className="small" dir="ltr" style={{ lineHeight: 1.9, color: "var(--muted)" }}>{authors.join(", ")}</p>
      </section>

      <p className="small"><Link className="md-link" href="/me">Back</Link></p>
    </article>
  );
}
