-- Nutrilens v1 schema (Supabase / Postgres)
-- Auth: Supabase Auth (email+password, Google). Email/password live in auth.users, NOT duplicated here.

-- ENUMS
create type diet_type as enum ('none','vegetarian','vegan','other');
create type scan_status as enum ('uploaded','reviewed','analyzed','failed');
create type result_status as enum ('no_known_conflict','conflict_found','unknown');
create type field_type as enum ('product_name','ingredient','allergen','sugar','sodium','protein','serving_size','other');
create type box_source as enum ('detected','rule','ai','unknown');
create type vegan_status as enum ('vegan','non_vegan','unknown');
create type user_role as enum ('user','admin');

-- PROFILES (1:1 with auth.users; replaces the "users" table in the template)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role user_role not null default 'user',
  age int check (age between 1 and 120),            -- required at onboarding step 1
  diet diet_type not null default 'none',
  conditions text[] not null default '{}',           -- sensitive
  allergies text[] not null default '{}',            -- sensitive
  thresholds jsonb not null default '{}',            -- e.g. {"sugar_g":10,"sodium_mg":400}; validate with Pydantic/Zod
  protein_goal_g int check (protein_goal_g > 0),     -- null = no gym goal
  onboarding_step smallint not null default 1,       -- resume unfinished onboarding
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now()
);

-- auto-create profile on signup
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name) values (new.id, new.raw_user_meta_data->>'name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- SCANS
create table scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  image_path text,                                   -- storage path: scans/{user_id}/{scan_id}.jpg
  status scan_status not null default 'uploaded',
  overall_status result_status,                      -- null until analyzed; missing data => 'unknown', never safe
  product_name text,
  serving_size_g numeric,
  serving_is_estimate boolean not null default false,
  created_at timestamptz not null default now()
);
create index on scans (user_id, created_at desc);

-- SCAN_BOXES (OCR lines; coords are 0-1 fractions of the image)
create table scan_boxes (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade, -- denormalized for cheap RLS
  line_no int not null,                              -- the "id" sent to Claude
  text text not null,
  ocr_confidence real check (ocr_confidence between 0 and 1),
  x real not null check (x between 0 and 1),
  y real not null check (y between 0 and 1),
  w real not null check (w between 0 and 1),
  h real not null check (h between 0 and 1),
  field field_type,
  source box_source not null default 'detected',
  user_corrected boolean not null default false,
  corrected_text text,
  unique (scan_id, line_no)
);
create index on scan_boxes (scan_id);

-- FINDINGS (rule engine output; one row per flag)
create table findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  rule_type text not null check (rule_type in ('allergen','vegan','threshold','missing_data')),
  result result_status not null,
  title text not null,
  rule_detail text not null,                         -- plain rule text, no AI
  box_ids uuid[] not null default '{}',              -- evidence boxes (every flag must have source text unless missing_data)
  ai_explanation text,                               -- cached /explain output, shown with "AI" tag
  created_at timestamptz not null default now()
);
create index on findings (scan_id);

-- PROTEIN LOG (running tally, resets by date)
create table protein_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  scan_id uuid references scans(id) on delete set null,
  protein_g numeric not null check (protein_g >= 0),
  amount_eaten_g numeric,
  is_estimate boolean not null default false,
  logged_on date not null default current_date,      -- store user's local date from the client/API
  created_at timestamptz not null default now()
);
create index on protein_log (user_id, logged_on);

-- VEGAN_INGREDIENTS (shared reference list; read by all, written by admin only)
create table vegan_ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  aliases text[] not null default '{}',
  status vegan_status not null default 'unknown',
  note text
);

-- ROW LEVEL SECURITY
alter table profiles enable row level security;
alter table scans enable row level security;
alter table scan_boxes enable row level security;
alter table findings enable row level security;
alter table protein_log enable row level security;
alter table vegan_ingredients enable row level security;

-- helper: is current user admin
create function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- profiles: own row; users can't promote themselves
create policy "own profile read" on profiles for select using (id = auth.uid());
create policy "own profile update" on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

-- user-owned tables: full access to own rows
create policy "own scans" on scans for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own boxes" on scan_boxes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own findings read" on findings for select using (user_id = auth.uid());  -- writes by backend (service role) only
create policy "own protein" on protein_log for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- vegan list: everyone logged in reads, admin writes
create policy "read vegan list" on vegan_ingredients for select using (auth.role() = 'authenticated');
create policy "admin writes vegan list" on vegan_ingredients for all using (is_admin()) with check (is_admin());

-- STORAGE: private bucket 'scans', path = {user_id}/{scan_id}.jpg
insert into storage.buckets (id, name, public) values ('scans','scans',false);
create policy "own scan images" on storage.objects for all
  using (bucket_id = 'scans' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'scans' and (storage.foldername(name))[1] = auth.uid()::text);
