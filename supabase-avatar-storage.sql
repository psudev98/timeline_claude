-- Run this once in Supabase > SQL Editor.
--
-- Creates a dedicated PUBLIC storage bucket for the two login-screen
-- profile photos. It is intentionally separate from the private
-- "photos" bucket used for shared memories: this bucket only ever
-- holds two profile pictures, is meant to be visible before anyone
-- logs in, and is written to by the login screen's photo-upload
-- button before any authentication happens.
--
-- Security note: because this bucket allows unauthenticated
-- (public) uploads, anyone who finds the deployed site could
-- technically overwrite these two avatar images. That's an accepted
-- trade-off for the "upload a photo right from the login screen"
-- feature - it does not expose anything else (the private "photos"
-- bucket and all app data remain restricted to authenticated users).

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Public avatar read" on storage.objects;
drop policy if exists "Public avatar upload" on storage.objects;
drop policy if exists "Public avatar update" on storage.objects;

create policy "Public avatar read"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Public avatar upload"
on storage.objects for insert
with check (bucket_id = 'avatars');

create policy "Public avatar update"
on storage.objects for update
using (bucket_id = 'avatars')
with check (bucket_id = 'avatars');
