# Learnly AI

An AI-powered learning app for the Pi Browser. Verified teachers turn their own materials into subject bots, students learn with them and pay with Pi, and the community area is free.

**Stack:** Next.js 16 (App Router) on Vercel · Supabase Postgres (project DalilPi, tables prefixed `ln_`) · Meta Model API (`muse-ember-1.0`) · Pi SDK (Testnet, `sandbox: false`).

## What's in it

| Area | Path | Notes |
| --- | --- | --- |
| Home | `/` | Tracks, bot search, continue last chat |
| Tutor chat | `/chat?b=<botId>` | Streaming replies, "thinking" indicator, file downloads |
| Teacher dashboard | `/teach` | Apply with a private proof document, build bots from PDF/Word/PowerPoint/TXT |
| Community | `/community` | Free groups, posts, replies, reports |
| Pioneer Academy | `/academy` | Free lessons |
| Admin | `/admin` | Approve teachers and bots, handle reports, set limits and margin, emergency stop |

## How AI cost and credits work

- 1 credit = `credit_usd` (default $0.001). Packs are priced in USD internally and sold **in Pi** at the live OKX `PI-USDT` price (quote signed, valid 10 minutes).
- Each message: the server estimates the maximum cost, **reserves** that many credits (`ln_reserve`), streams the reply, then charges the real cost × `markup` (default 4×) plus the bot's teacher fee and any file fee, and **refunds the rest** (`ln_settle`). Balance can never go negative (DB constraint).
- Input is trimmed to an estimated 150K tokens so a request never reaches Muse Ember's >200K price tier. Output is capped at 6K tokens per round, max 3 rounds.
- Prompt caching: the system prompt (rules + teacher instructions + teacher materials) and tool list come first and are identical for every student of a bot, with `prompt_cache_key = ln-bot-<id>` and 24h retention. Cached input costs 4% of normal.
- Non-paying users: daily message cap, a daily platform budget, and an admin kill switch. Teachers get 70% of their per-message fee.

## Files the AI can make

The tutor calls a `create_file` tool. Only a small JSON spec is stored (`ln_files`, auto-deleted after 30 days); the PDF, DOCX, PPTX or XLSX is rebuilt on download at `/api/files/<id>` as a normal `GET` with `Content-Disposition: attachment`, which works in Pi Browser. Arabic PDFs use the bundled IBM Plex Sans Arabic (OFL, see `assets/fonts/OFL.txt`).

## Environment variables (Vercel)

See `.env.example`. `SUPABASE_KEY` is the project's publishable/anon key and is used only on the server. All database access goes through `ln_*` Postgres functions that check `LN_DB_SECRET` against the hash stored in `ln_config`.

## Database

`supabase/migrations/001_learnly_init.sql`. After applying it, store the secret hash:

```sql
insert into ln_config(key, value) values ('server_secret_sha256', to_jsonb('<sha256 of LN_DB_SECRET>'::text))
on conflict (key) do update set value = excluded.value;
```

## Keeping the free plans happy

- All pages are static; data loads through small API routes.
- `/api/bots` and `/api/posts` are cached at the CDN (`s-maxage`).
- Chat history lives in the browser (localStorage), not the database.
- Functions run in `lhr1`, next to the Supabase region (eu-west-2).

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

Pi sign-in and payments only work inside Pi Browser.
