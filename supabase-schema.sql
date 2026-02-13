-- Echo Legacy Database Schema
-- Run this in your Supabase SQL Editor

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Users (extends Supabase auth.users)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null default '',
  email text not null,
  prompt_cadence text not null default 'off' check (prompt_cadence in ('off', 'daily', 'every_3_days', 'weekly')),
  prompt_time text not null default '09:00',
  created_at timestamptz not null default now()
);

-- Vaults
create table public.vaults (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_user_id uuid references public.users(id) on delete cascade not null,
  is_pro boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  invite_code text not null default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

-- Vault Members
create table public.vault_members (
  vault_id uuid references public.vaults(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  role text not null default 'member' check (role in ('owner', 'member', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (vault_id, user_id)
);

-- Recordings
create table public.recordings (
  id uuid primary key default uuid_generate_v4(),
  vault_id uuid references public.vaults(id) on delete cascade not null,
  created_by_user_id uuid references public.users(id) on delete set null,
  title text,
  prompt_id uuid,
  audio_url text not null,
  duration_seconds integer not null default 0,
  status text not null default 'uploading' check (status in ('uploading', 'processing', 'ready', 'failed', 'rejected_paywall')),
  summary text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Recording Segments
create table public.recording_segments (
  id uuid primary key default uuid_generate_v4(),
  recording_id uuid references public.recordings(id) on delete cascade not null,
  start_ms integer not null,
  end_ms integer not null,
  text text not null
);

-- Prompts
create table public.prompts (
  id uuid primary key default uuid_generate_v4(),
  text text not null,
  theme text not null,
  depth_level text not null default 'light' check (depth_level in ('light', 'medium', 'deep'))
);

-- Prompt Logs
create table public.prompt_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  prompt_id uuid references public.prompts(id) on delete cascade not null,
  sent_at timestamptz not null default now(),
  action text not null check (action in ('started', 'skipped', 'ignored'))
);

-- Usage Logs
create table public.usage_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  date_yyyy_mm_dd text not null,
  seconds_recorded_total integer not null default 0,
  unique (user_id, date_yyyy_mm_dd)
);

-- ============================================
-- INDEXES
-- ============================================

create index idx_vault_members_user on public.vault_members(user_id);
create index idx_vault_members_vault on public.vault_members(vault_id);
create index idx_recordings_vault on public.recordings(vault_id);
create index idx_recordings_created_at on public.recordings(created_at desc);
create index idx_recordings_status on public.recordings(status);
create index idx_recording_segments_recording on public.recording_segments(recording_id);
create index idx_usage_logs_user_date on public.usage_logs(user_id, date_yyyy_mm_dd);
create index idx_vaults_invite_code on public.vaults(invite_code);
create index idx_prompt_logs_user on public.prompt_logs(user_id);

-- Full text search on recordings
alter table public.recordings add column fts tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || array_to_string(tags, ' '))
  ) stored;
create index idx_recordings_fts on public.recordings using gin(fts);

-- Full text search on segments
alter table public.recording_segments add column fts tsvector
  generated always as (to_tsvector('english', text)) stored;
create index idx_segments_fts on public.recording_segments using gin(fts);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.users enable row level security;
alter table public.vaults enable row level security;
alter table public.vault_members enable row level security;
alter table public.recordings enable row level security;
alter table public.recording_segments enable row level security;
alter table public.prompts enable row level security;
alter table public.prompt_logs enable row level security;
alter table public.usage_logs enable row level security;

-- Users: can read/update own profile
create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_update_own" on public.users for update using (auth.uid() = id);
create policy "users_insert_own" on public.users for insert with check (auth.uid() = id);

-- Vaults: visible to members
create policy "vaults_select" on public.vaults for select using (
  id in (select vault_id from public.vault_members where user_id = auth.uid())
);
create policy "vaults_insert" on public.vaults for insert with check (owner_user_id = auth.uid());
create policy "vaults_update" on public.vaults for update using (owner_user_id = auth.uid());
create policy "vaults_delete" on public.vaults for delete using (owner_user_id = auth.uid());

-- Vault Members: visible to other members
create policy "vault_members_select" on public.vault_members for select using (
  vault_id in (select vault_id from public.vault_members where user_id = auth.uid())
);
create policy "vault_members_insert" on public.vault_members for insert with check (
  user_id = auth.uid() or
  vault_id in (select vault_id from public.vault_members where user_id = auth.uid() and role = 'owner')
);
create policy "vault_members_update" on public.vault_members for update using (
  vault_id in (select vault_id from public.vault_members where user_id = auth.uid() and role = 'owner')
);
create policy "vault_members_delete" on public.vault_members for delete using (
  vault_id in (select vault_id from public.vault_members where user_id = auth.uid() and role = 'owner')
);

-- Recordings: visible to vault members
create policy "recordings_select" on public.recordings for select using (
  vault_id in (select vault_id from public.vault_members where user_id = auth.uid())
);
create policy "recordings_insert" on public.recordings for insert with check (
  vault_id in (select vault_id from public.vault_members where user_id = auth.uid() and role in ('owner', 'member'))
);
create policy "recordings_update" on public.recordings for update using (
  vault_id in (select vault_id from public.vault_members where user_id = auth.uid() and role in ('owner', 'member'))
);

-- Recording Segments: visible to vault members via recording
create policy "segments_select" on public.recording_segments for select using (
  recording_id in (
    select r.id from public.recordings r
    join public.vault_members vm on vm.vault_id = r.vault_id
    where vm.user_id = auth.uid()
  )
);
create policy "segments_insert" on public.recording_segments for insert with check (
  recording_id in (
    select r.id from public.recordings r
    join public.vault_members vm on vm.vault_id = r.vault_id
    where vm.user_id = auth.uid() and vm.role in ('owner', 'member')
  )
);

-- Prompts: publicly readable
create policy "prompts_select" on public.prompts for select using (true);

-- Prompt Logs: own logs only
create policy "prompt_logs_select" on public.prompt_logs for select using (user_id = auth.uid());
create policy "prompt_logs_insert" on public.prompt_logs for insert with check (user_id = auth.uid());

-- Usage Logs: own logs only
create policy "usage_logs_select" on public.usage_logs for select using (user_id = auth.uid());
create policy "usage_logs_insert" on public.usage_logs for insert with check (user_id = auth.uid());
create policy "usage_logs_update" on public.usage_logs for update using (user_id = auth.uid());

-- ============================================
-- STORAGE BUCKETS
-- ============================================

insert into storage.buckets (id, name, public) values ('recordings', 'recordings', false);

-- Storage policy: vault members can upload to their vault folder
create policy "recordings_upload" on storage.objects for insert
  with check (
    bucket_id = 'recordings' and
    auth.uid() is not null
  );

-- Storage policy: vault members can read from their vault folder
create policy "recordings_read" on storage.objects for select
  using (
    bucket_id = 'recordings' and
    auth.uid() is not null
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users insert
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to count ready recordings in a vault
create or replace function public.count_ready_recordings(vault_uuid uuid)
returns integer as $$
  select count(*)::integer from public.recordings
  where vault_id = vault_uuid and status = 'ready';
$$ language sql security definer;

-- ============================================
-- SEED PROMPTS
-- ============================================

insert into public.prompts (text, theme, depth_level) values
  ('What''s your earliest childhood memory?', 'childhood', 'light'),
  ('Tell me about a meal your family always made together.', 'traditions', 'light'),
  ('What was your favorite thing to do after school as a kid?', 'childhood', 'light'),
  ('Describe the house or neighborhood you grew up in.', 'places', 'light'),
  ('What''s a song that always reminds you of someone special?', 'relationships', 'light'),
  ('Who was your best friend growing up, and what did you do together?', 'relationships', 'medium'),
  ('Tell me about a family tradition that has been passed down.', 'traditions', 'medium'),
  ('What was the hardest decision you ever had to make?', 'life lessons', 'medium'),
  ('Describe a moment when you felt truly proud of yourself.', 'milestones', 'medium'),
  ('What advice would you give to your younger self?', 'wisdom', 'medium'),
  ('Tell me about a time you failed and what you learned from it.', 'life lessons', 'deep'),
  ('What does "home" mean to you?', 'identity', 'deep'),
  ('How has your understanding of love changed over the years?', 'relationships', 'deep'),
  ('What do you hope future generations remember about you?', 'legacy', 'deep'),
  ('Tell me about a moment that changed the direction of your life.', 'milestones', 'deep'),
  ('What''s a family story that deserves to be remembered forever?', 'legacy', 'deep'),
  ('Describe the happiest day of your life so far.', 'milestones', 'medium'),
  ('What was your first job, and what did it teach you?', 'career', 'light'),
  ('Tell me about a place you''ve traveled to that left a lasting impression.', 'places', 'medium'),
  ('What''s a skill or hobby you wish you had learned earlier?', 'wisdom', 'light');
