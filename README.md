# Backhaul

A matching network for trucking companies, brokers, and vendors.

## Set up the database (do this first)

1. Open your Supabase project → left sidebar → **SQL Editor** → **New query**
2. Open `supabase/schema.sql` from this project, copy all of it, paste into the query box
3. Click **Run**
4. You should see "Success. No rows returned" — that means all 5 tables were created

## Connect the app to Supabase

1. In Supabase: **Project Settings** (gear icon) → **API**
2. Copy the **Project URL**
3. Copy the **anon public** key (NOT the service_role key)
4. In this project, make a copy of `.env.local.example`, rename the copy to `.env.local`
5. Paste your two values in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=paste-project-url-here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=paste-anon-key-here
   ```

## Deploy on Vercel

1. Push this project to your GitHub repo
2. Go to vercel.com → **Add New Project** → import your GitHub repo
3. Before clicking Deploy, expand **Environment Variables** and add the same two values from `.env.local`
4. Click **Deploy**
5. Vercel gives you a live URL — that's your app

## What works right now

- Sign up as a Trucking Company, Broker, or Vendor
- Trucking companies fill out a discoverable profile (fleet size, equipment, lanes, bio)
- Brokers/vendors browse a discovery deck of trucking companies and "Connect" to match
- Matches open a negotiation thread (rate + message)
- Brokers/vendors can leave a review after a job: on-time delivery and freight condition are tracked as two separate scores, which drive the carrier's letter grade
- Brokers/vendors see how many carriers they've matched with this month

## What's not built yet

- Payments — broker/vendor accounts aren't actually charged yet (that's stage 3, added on top of this once you're happy with how the core app works)
- Email confirmation is on by default in Supabase, so new users must click a link in their email before they can log in. You can turn this off in Supabase under **Authentication → Providers → Email → Confirm email** if you want faster testing.
