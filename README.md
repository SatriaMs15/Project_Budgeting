# Buku Kas

A personal budgeting ledger: income and expenses in Rupiah, monthly budget
limits, savings goals, recurring entries, and statement import.

There is no login screen. Each device is signed in anonymously by Supabase on
first visit, and Row Level Security keeps every account's data to itself.

## Stack

- Next.js (App Router) + React 19, TypeScript, Tailwind v4, shadcn/ui on Base UI
- Supabase — Postgres, anonymous auth, RLS. Queried through `supabase-js` so the
  user's session travels with every request; an ORM connecting directly would
  use a privileged role and bypass RLS entirely
- Recharts for the dashboard, Vitest + Playwright for tests

## Running locally

```bash
npm install
cp .env.local.example .env.local   # then fill in the values
npm run dev
```

Apply the SQL in `supabase/migrations/` in order, via the Supabase dashboard's
SQL editor. Each file is written to be re-runnable, so running one twice is
harmless.

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public by design; RLS is what protects the data |
| `GEMINI_API_KEY` | no | Only for importing PDFs and photos. CSV, Excel and Word are read without it |

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Vitest suite |
| `npm run e2e` | Playwright suite against a running dev server |
| `npm run build` | Production build — the only check that catches `"use server"` violations |
| `npm run lint` | ESLint |

`npm run e2e` needs the dev server up, and honours `E2E_BASE` if it is not on
port 3000. It shares one anonymous user across tests (cached in
`.e2e-session.json`) because Supabase rate-limits anonymous sign-ins.

## Deploying to Vercel

1. Import the repository at [vercel.com/new](https://vercel.com/new). The
   framework, build command and output are all detected; nothing to configure.
2. Add the environment variables above under **Settings → Environment
   Variables**, for Production, Preview and Development.
3. Deploy, then open the URL and confirm the dashboard renders — that proves
   the anonymous session bootstrapped.

### Platform limits worth knowing

- **Uploads are capped at 4 MB.** Vercel rejects request bodies over 4.5 MB with
  `413 FUNCTION_PAYLOAD_TOO_LARGE` before the app sees them, on Hobby and Pro
  alike. `lib/upload-limits.ts` is the single source of truth and the import
  form quotes it.
- **Anonymous sign-ins are rate limited.** On Vercel they originate from
  Vercel's egress IPs rather than the visitor's, so Supabase's per-IP limit
  applies to everyone collectively. Check **Authentication → Rate Limits**
  before sharing the link widely. Anonymous users also count toward the free
  tier's monthly active users, which is why `app/robots.ts` keeps crawlers out
  and the proxy only signs in requests that actually ask for a page.
- **Supabase free projects pause after about a week idle.** A deployed but
  unused app will look broken until it is restored from the dashboard.
- Vercel's Hobby plan is for non-commercial use.
