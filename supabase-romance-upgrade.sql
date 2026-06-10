-- Run this once in Supabase > SQL Editor.

alter table public.milestones
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists is_favorite boolean not null default false,
  add column if not exists mood_tags text[] not null default '{}',
  add column if not exists location_name text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists song_url text,
  add column if not exists voice_path text,
  add column if not exists unlock_phrase text,
  add column if not exists unlock_at timestamptz;

create table if not exists public.milestone_media (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  storage_path text not null,
  media_type text not null default 'image' check (media_type in ('image', 'audio')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('heart', 'sparkle', 'smile', 'favorite')),
  created_at timestamptz not null default now(),
  unique (milestone_id, user_id, reaction)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  author_color text not null default '#e9517d',
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.love_letters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  unlock_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.special_dates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  kind text not null default 'date',
  recurring_yearly boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.milestones enable row level security;
alter table public.milestone_media enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.love_letters enable row level security;
alter table public.special_dates enable row level security;

drop policy if exists "Authenticated milestone access" on public.milestones;
create policy "Authenticated milestone access"
on public.milestones for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated media access" on public.milestone_media;
create policy "Authenticated media access"
on public.milestone_media for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated reaction access" on public.reactions;
create policy "Authenticated reaction access"
on public.reactions for all to authenticated
using (true) with check (auth.uid() = user_id);

drop policy if exists "Authenticated comment access" on public.comments;
create policy "Authenticated comment access"
on public.comments for all to authenticated
using (true) with check (auth.uid() = user_id);

drop policy if exists "Authenticated letter access" on public.love_letters;
create policy "Authenticated letter access"
on public.love_letters for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated special date access" on public.special_dates;
create policy "Authenticated special date access"
on public.special_dates for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated memory file read" on storage.objects;
drop policy if exists "Authenticated memory file upload" on storage.objects;
drop policy if exists "Authenticated memory file delete" on storage.objects;

create policy "Authenticated memory file read"
on storage.objects for select to authenticated
using (bucket_id = 'photos');

create policy "Authenticated memory file upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'photos');

create policy "Authenticated memory file delete"
on storage.objects for delete to authenticated
using (bucket_id = 'photos');

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'milestones',
    'milestone_media',
    'reactions',
    'comments',
    'love_letters',
    'special_dates'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = relation_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        relation_name
      );
    end if;
  end loop;
end
$$;
