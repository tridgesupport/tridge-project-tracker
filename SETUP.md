# Tridge Project Tracker — Setup Guide

## Prerequisites
- Node.js 18+
- A Supabase project
- A Resend account (for email notifications)

## 1. Supabase Setup

### Create the database tables
1. Go to your Supabase dashboard → SQL Editor
2. Paste and run the entire contents of `supabase/migration.sql`
3. This creates all tables, triggers, RLS policies, and indexes

### Configure Auth
- Enable **Email/Password** auth in Authentication → Providers
- (Optional) Set up a custom SMTP server in Authentication → SMTP Settings for transactional emails

### Create the first admin user
1. Go to Authentication → Users → Create user
2. After creation, run this in the SQL editor (replace the email):
   ```sql
   UPDATE public.users SET role = 'admin', name = 'Your Name' WHERE email = 'admin@yourcompany.com';
   ```

## 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → service_role key |
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
