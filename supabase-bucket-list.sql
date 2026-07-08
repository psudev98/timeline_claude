-- Run this once in Supabase > SQL Editor.
--
-- Adds the "Someday" bucket list: a shared list of future dates/dreams/
-- trips, separate from the existing special_dates countdown table since
-- these items intentionally have no fixed date. Additive, like every
-- other migration file here - it does not touch existing tables.

create table if not exists public.bucket_list_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.bucket_list_items enable row level security;

drop policy if exists "Authenticated bucket list access" on public.bucket_list_items;
create policy "Authenticated bucket list access"
on public.bucket_list_items for all to authenticated
using (true) with check (true);

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'bucket_list_items'
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
