-- Run this whole file once in Supabase: Project > SQL Editor > New query > paste > Run

-- One row per user, extends Supabase's built-in auth.users
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  role text check (role in ('trucker', 'broker', 'vendor')) not null,
  company_name text not null,
  created_at timestamp with time zone default now()
);

-- Extra fields only trucking companies fill in (their discoverable profile card)
create table trucker_details (
  id uuid references profiles(id) on delete cascade primary key,
  fleet_size int,
  equipment text,
  lanes text,
  bio text,
  years_active int
);

-- A completed-job review left by a broker/vendor about a trucking company
create table reviews (
  id uuid default gen_random_uuid() primary key,
  trucker_id uuid references profiles(id) on delete cascade not null,
  reviewer_id uuid references profiles(id) on delete cascade not null,
  on_time boolean not null,
  condition int not null check (condition between 1 and 5),
  created_at timestamp with time zone default now()
);

-- A match between a trucking company and a broker or vendor
create table matches (
  id uuid default gen_random_uuid() primary key,
  trucker_id uuid references profiles(id) on delete cascade not null,
  partner_id uuid references profiles(id) on delete cascade not null,
  partner_role text not null,
  created_at timestamp with time zone default now(),
  unique (trucker_id, partner_id)
);

-- Negotiation messages inside a match
create table messages (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  text text,
  rate numeric,
  created_at timestamp with time zone default now()
);

-- Row Level Security: locks down who can read/write what, enforced by the database itself
alter table profiles enable row level security;
alter table trucker_details enable row level security;
alter table reviews enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;

-- Profiles: anyone logged in can see all profiles (needed for discovery); you can only edit your own
create policy "profiles are viewable by everyone logged in" on profiles
  for select using (auth.role() = 'authenticated');
create policy "users can insert their own profile" on profiles
  for insert with check (auth.uid() = id);
create policy "users can update their own profile" on profiles
  for update using (auth.uid() = id);

-- Trucker details: viewable by everyone logged in; only the trucker themself can edit theirs
create policy "trucker details are viewable by everyone logged in" on trucker_details
  for select using (auth.role() = 'authenticated');
create policy "truckers manage their own details" on trucker_details
  for insert with check (auth.uid() = id);
create policy "truckers update their own details" on trucker_details
  for update using (auth.uid() = id);

-- Reviews: viewable by everyone logged in; only broker/vendor who matched can leave one
create policy "reviews are viewable by everyone logged in" on reviews
  for select using (auth.role() = 'authenticated');
create policy "reviewers can leave reviews" on reviews
  for insert with check (auth.uid() = reviewer_id);

-- Matches: only the two people in the match can see it; only the broker/vendor side creates it
create policy "match participants can view" on matches
  for select using (auth.uid() = trucker_id or auth.uid() = partner_id);
create policy "brokers and vendors can create matches" on matches
  for insert with check (auth.uid() = partner_id);

-- Messages: only participants of the parent match can read/write
create policy "match participants can view messages" on messages
  for select using (
    exists (
      select 1 from matches
      where matches.id = messages.match_id
      and (matches.trucker_id = auth.uid() or matches.partner_id = auth.uid())
    )
  );
create policy "match participants can send messages" on messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from matches
      where matches.id = messages.match_id
      and (matches.trucker_id = auth.uid() or matches.partner_id = auth.uid())
    )
  );
