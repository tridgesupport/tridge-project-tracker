# Tridge Project Tracker — Setup Guide

## Prerequisites
- Node.js 18+
- A Neon (Postgres) project
- A Resend account (for email notifications)

## 1. Neon Setup

### Create the database schema
1. Set `DATABASE_URL` in `.env.local` to your Neon connection string
2. Run `npx tsx scripts/migrate-neon.ts` to create/update tables

### Auth
Auth is handled by NextAuth v5 with the Credentials provider — passwords are hashed with `bcryptjs` and checked against the `users` table via `lib/db.ts`. No external auth provider is required.

### Create the first admin user
Run `npx tsx scripts/create-admin.ts` (see the script for required env vars/args).

## 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
|---|---|
| `DATABASE_URL` | Neon dashboard → Connection Details → connection string |
| `AUTH_SECRET` | Generate with `npx auth secret` (NextAuth v5) |
| `RESEND_API_KEY` | Resend dashboard → API Keys |
| `EMAIL_FROM` | A verified domain email in Resend (e.g. `noreply@yourcompany.com`) |
| `NEXT_PUBLIC_APP_URL` | Your deployment URL (e.g. `https://tracker.yourcompany.com`) |

## 3. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 4. Deploy to Vercel

```bash
npx vercel
```

Set all environment variables in the Vercel project settings.

## 5. Roles

| Role | Capabilities |
|---|---|
| `admin` | Full access — manage users, clients, all projects |
| `internal` | View all projects, edit assigned tasks/milestones |
| `client` | Read-only view of their linked projects |

## 6. Email Notifications

When `next_action_by` is set or changed on a project, milestone, or task, an email is automatically sent to that user via Resend.
