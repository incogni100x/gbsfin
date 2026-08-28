# Global Stripe Fin

React banking demo with a source-controlled Supabase authentication and account
setup.

## Local setup

Requirements:

- Node.js 22 or newer
- Docker Desktop, OrbStack, Podman, or another Docker-compatible runtime

Install dependencies and start Supabase:

```bash
npm install
npm run supabase:start
```

Copy `.env.example` to `.env.local`, then copy the API URL and publishable key
shown by `npm run supabase:status` into that file.

Start the React application:

```bash
npm run dev
```

Local authentication emails are available in Mailpit at
`http://127.0.0.1:54324`.

## Database workflow

The repository is the database source of truth. Schema and reference-data
changes belong in `supabase/migrations/`; disposable local demo data belongs in
`supabase/seed.sql`.

```bash
npm run supabase:reset
npm run supabase:test
npm run supabase:lint
```

Before pushing to a linked remote project, review pending migrations with the
Supabase CLI and use an explicit dry run.

## Authentication flow

- Signup: password, email OTP, onboarding, three hashed security answers,
  private identity documents, and RPC account creation.
- Sign-in: password, email OTP, and one security question.
- Recovery: email recovery OTP, one security question, and a new password.
- Dashboard routes require an authenticated session that has passed the
  security-question check for the current session.

Only the Supabase publishable key belongs in the browser. Never place a secret
or service-role key in a `VITE_` environment variable.
