# BETA Hackscore

A live-event hackathon judging system optimized for judges on phones, organizers tracking scoring coverage, and public leaderboard displays.

## Recommended folder structure

```text
hackathon-scorer/
├── api/                    # Vercel function entrypoints
├── dist/                   # Frontend build output
├── src/
│   ├── components/         # Reusable UI
│   ├── lib/                # API client and shared helpers
│   ├── pages/              # Judge / admin / leaderboard routes
│   ├── App.tsx
│   ├── main.tsx
│   └── types.ts
├── supabase/
│   ├── schema.sql          # Production relational schema
│   └── seed.sql            # Sample seed data
├── db.js                   # Local SQLite bootstrap for prototype mode
├── scoring.js              # Shared leaderboard and aggregation logic
├── server.js               # Express API for local and Vercel runtime
├── .env.example
└── README.md
```

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy env vars:

```bash
cp .env.example .env
```

3. Start local development:

```bash
npm run dev
```

4. Open:

- Judge portal: `http://localhost:5173/login`
- Organizer dashboard: `http://localhost:5173/admin`

Default local admin password: `beta2025`

## Production notes

- The current app runs locally on SQLite for fast prototyping.
- For real event usage, move persistence to Supabase using the SQL in [supabase/schema.sql](/Users/easonxu/hackathon-scorer/supabase/schema.sql) and [supabase/seed.sql](/Users/easonxu/hackathon-scorer/supabase/seed.sql).
- Vercel-hosted local SQLite is not durable enough for a real judging event.

## Scoring and ranking logic

- Each score stores raw criterion values plus derived `total_score` and `weighted_score`.
- Criteria weights can be enabled or disabled from organizer settings.
- Judge weights can be enabled or disabled from organizer settings.
- Leaderboard aggregation supports:
  - `average_all`
  - `drop_high_low`
  - `median`
  - `weighted_average`
- Finalists can come from judge nominations or organizer selection.
- Category winners are computed from aggregate project performance and criterion-specific averages.
