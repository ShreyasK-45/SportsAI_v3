-- ============================================================
-- SportsAI+ / Stridewise — Supabase Schema v2.0
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create extension if not exists "pgcrypto";

-- ── Athlete profiles ─────────────────────────────────────────
create table if not exists public.profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade unique,
  display_name        text    not null default 'Runner',
  goal                text    not null default 'Build relaxed long-run efficiency',
  target_event        text    not null default 'Half marathon',
  weekly_distance_km  numeric(6,1) not null default 32,
  weight_kg           numeric(5,1) not null default 65,
  preferred_intensity text    not null default 'moderate'
                        check (preferred_intensity in ('easy','moderate','hard')),
  updated_at          timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Nutrition profiles ────────────────────────────────────────
create table if not exists public.nutrition_profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade unique,
  diet_type    text not null default 'vegetarian'
                 check (diet_type in ('vegetarian','vegan','eggetarian','non-vegetarian','other')),
  diet_mode    text not null default 'mixed'
                 check (diet_mode in ('modern_global','traditional_regional','mixed')),
  region       text not null default 'India',
  cuisine      text not null default 'South Indian',
  goal         text not null default 'performance'
                 check (goal in ('performance','weight_loss','muscle_gain','general_health')),
  allergies    text[] not null default '{}',
  dislikes     text[] not null default '{}',
  budget       text not null default 'medium'
                 check (budget in ('low','medium','high')),
  cooking_time text not null default '15_to_30'
                 check (cooking_time in ('under_15','15_to_30','over_30')),
  updated_at   timestamptz not null default now()
);
alter table public.nutrition_profiles enable row level security;
create policy "Users manage own nutrition profile" on public.nutrition_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Analysis sessions ─────────────────────────────────────────
create table if not exists public.analyses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade,
  activity_id      text not null default 'long-distance-running',
  source_name      text not null,
  score            integer not null check (score between 0 and 100),
  confidence       integer not null check (confidence between 0 and 100),
  confidence_level text not null default 'Medium'
                     check (confidence_level in ('High','Medium','Low','Insufficient')),
  duration         numeric(8,2) not null,
  focus            text not null,
  country          text not null default 'india',
  view             text,
  view_confidence  integer,
  metrics          jsonb,
  foot_strike      jsonb,
  rag_output       jsonb,
  pose_confidence  jsonb,
  pipeline_steps   jsonb,
  created_at       timestamptz not null default now()
);
alter table public.analyses enable row level security;
create policy "Users manage own analyses" on public.analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists analyses_user_created on public.analyses(user_id, created_at desc);

-- ── Nutrition logs ────────────────────────────────────────────
create table if not exists public.nutrition_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  country     text not null default 'india',
  meal_type   text not null check (meal_type in ('pre_run','post_run','daily','supplement')),
  description text not null,
  logged_at   timestamptz not null default now()
);
alter table public.nutrition_logs enable row level security;
create policy "Users manage own nutrition logs" on public.nutrition_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Nutrition chat sessions ───────────────────────────────────
create table if not exists public.nutrition_chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  title      text not null default 'Nutrition chat',
  created_at timestamptz not null default now()
);
alter table public.nutrition_chat_sessions enable row level security;
create policy "Users manage own chat sessions" on public.nutrition_chat_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Nutrition chat messages ───────────────────────────────────
create table if not exists public.nutrition_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid references public.nutrition_chat_sessions(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);
alter table public.nutrition_chat_messages enable row level security;
create policy "Users manage own chat messages" on public.nutrition_chat_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Training sessions ─────────────────────────────────────────
create table if not exists public.training_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  day         text not null,
  title       text not null,
  detail      text not null,
  kind        text not null check (kind in ('easy','quality','recovery','strength')),
  completed   boolean not null default false,
  week_start  date not null default current_date,
  created_at  timestamptz not null default now()
);
alter table public.training_sessions enable row level security;
create policy "Users manage own training sessions" on public.training_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Reports ───────────────────────────────────────────────────
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete cascade,
  storage_path text,   -- Supabase Storage path when using object storage
  generated_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "Users manage own reports" on public.reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Auto-create profile on signup ────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Runner'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
