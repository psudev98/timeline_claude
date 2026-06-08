<<<<<<< HEAD
# Our Little Timeline

A romantic, animated React timeline with a live anniversary counter, scroll-linked glowing timeline, spring-loaded memory cards, and a hidden contributor panel.

## Run locally

```bash
npm install
npm run dev
```

## Supabase setup

The app uses Supabase Auth, Database, Storage, and Realtime.

Add these variables in Vercel and in `.env.local` for local development:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Run this in the Supabase SQL Editor if your `milestones` table already exists:

```sql
alter table milestones
add column if not exists photo_path text;

alter table milestones enable row level security;

drop policy if exists "Authenticated users can view milestones" on milestones;
drop policy if exists "Authenticated users can add milestones" on milestones;
drop policy if exists "Authenticated users can remove milestones" on milestones;

create policy "Authenticated users can view milestones"
on milestones
for select
to authenticated
using (true);

create policy "Authenticated users can add milestones"
on milestones
for insert
to authenticated
with check (true);

create policy "Authenticated users can remove milestones"
on milestones
for delete
to authenticated
using (true);
```

Create a private Storage bucket named `photos`, then add Storage policies:

```sql
drop policy if exists "Authenticated users can upload photos" on storage.objects;
drop policy if exists "Authenticated users can view photos" on storage.objects;
drop policy if exists "Authenticated users can delete photos" on storage.objects;

create policy "Authenticated users can upload photos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'photos');

create policy "Authenticated users can view photos"
on storage.objects
for select
to authenticated
using (bucket_id = 'photos');

create policy "Authenticated users can delete photos"
on storage.objects
for delete
to authenticated
using (bucket_id = 'photos');
```

Create two Supabase Auth users from Authentication > Users. The login screen labels the email as a User ID, so both of you can sign in with your email and password.
=======
# timeline
>>>>>>> 866f4007cddb5743aa0500671e653637cb2fd1c4
