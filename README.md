# Textweaver — Textweaver

AI-powered platform that generates comics and interactive books for language learners in Laos and Southeast Asia.

## Quick Start

```bash
git clone https://github.com/knivesthao/Textweaver.git
cd Textweaver
npm install
cp .env.example .env   # fill in your Supabase URL + key
npm run dev            # opens http://localhost:5173
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Where to get it |
|----------|-----------------|
| `VITE_SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API → anon public key |

No other setup needed. The app uses Supabase (database + auth) and Cloudflare (hosting) — both run for free during development.

## Running Tests

```bash
npm test              # run once
npm run test:watch    # re-run on changes
```

## Project Structure

```
src/
├── main.tsx              # Entry point
├── App.tsx               # Routes: / /book/:id /purchase/:id /read/:id /my-library
├── components/           # Shared components (ErrorBoundary)
├── hooks/                # useAuth — Supabase phone auth
├── lib/                  # supabase client, IndexedDB storage
├── pages/                # Library, BookDetail, Purchase, Reader, MyLibrary
└── index.css             # All styles

supabase/migrations/       # Database schema + business functions
public/mock/               # Placeholder content for dev
```

## Deploy

```bash
# Frontend auto-deploys on `git push` (Cloudflare Pages integration)
git push origin main

# Set Cloudflare environment variables (one time):
npx wrangler secret put VITE_SUPABASE_URL
npx wrangler secret put VITE_SUPABASE_ANON_KEY
```
