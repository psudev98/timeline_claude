# Our Little Timeline

A private shared space for two people, built with React, Framer Motion, Supabase, and Vercel.

## Included

- Supabase email/password login
- Personal display names and profile colors
- Realtime shared timeline and new-memory notifications
- Multi-photo albums with carousel and individual photo removal
- Reactions, replies, favorite memories, and mood tags
- Voice notes and a song link per memory
- Secret-phrase and scheduled memory unlocks
- Locations and a map view
- Calendar and draggable Polaroid wall views
- Scheduled love letters
- Monthly anniversary and custom countdowns
- "This day again" resurfacing
- Four visual themes
- Special-date heart/sparkle celebrations
- Mobile-first upload form
- Print/PDF keepsake export
- Scrapbook Flip UI with 3D page spreads, paper texture, tape, ticket stubs, envelope/secret reveals, and parallax-style decorative motion

## 1. Upgrade Supabase

Open **Supabase > SQL Editor**, paste the complete contents of:

```txt
supabase-romance-upgrade.sql
```

Then click **Run**.

The migration is additive. It keeps existing milestones and adds the columns, tables, RLS policies, Storage rules, and Realtime publication entries used by the expanded app.

Your existing private Storage bucket must be named:

```txt
photos
```

The bucket stores photos and voice-note files. Access remains limited to authenticated users through Storage RLS.

Then also run:

```txt
supabase-avatar-storage.sql
```

This creates a separate, **public** `avatars` bucket used only for the two profile photos shown on the login screen (so they can be uploaded and viewed before anyone signs in). See the comments in that file for the security trade-off this implies.

If the site says it cannot add a memory, check the message shown in the pink status box. The most common causes are:

- `photos` bucket does not exist.
- Storage policies for authenticated upload/read/delete were not created.
- `supabase-romance-upgrade.sql` was not run after the new scrapbook features were added.
- Vercel was not redeployed after pushing the latest code.
- Reactions/comments fail with `PGRST205` because Supabase cannot find the `public.reactions` or `public.comments` table. Run the upgrade SQL and refresh the page.

The app can now fall back to a basic milestone insert if the optional scrapbook columns are not present, but photo albums, reactions, comments, letters, and other interactions need the upgrade SQL.

## 2. Authentication

In **Supabase > Authentication > Users**, create the two accounts that should access the site.

The login screen no longer asks for an email or a typed password. Instead:

- Each person picks their own named card, then picks **a date** from a date picker as their "password."
- Set each account's real Supabase Auth password to that exact date, formatted `YYYY-MM-DD` (e.g. `2024-02-14`). Whatever date is picked in the UI is sent to Supabase as the password string, so it must match exactly.
- The email each card signs in with comes from environment variables, not from typing - see "Environment variables" below.

After signing in, each person can choose a display name and profile color from the settings button.

## 3. Environment variables

Add these in **Vercel > Project > Settings > Environment Variables**:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_PARTNER_DEVA_EMAIL=deva_actual_login_email@example.com
VITE_PARTNER_AADI_EMAIL=aadi_actual_login_email@example.com
```

Use the anon/public key, never the Supabase service-role key.

The two `VITE_PARTNER_*_EMAIL` values are what let the login screen sign each person in without ever showing an email box. They're kept out of the GitHub repo by living only in env vars, but like all `VITE_`-prefixed variables they do get bundled into the site's shipped JavaScript - so treat them as "not in source control" rather than "secret." Anyone who inspects the deployed site's network/JS could still see them.

For local development, put the same values in `.env.local`.

## 4. Install and run

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## 5. Deploy updates

Push this project to the GitHub repository connected to Vercel. Vercel will install the updated Supabase dependency, build the Vite app, and deploy it automatically.

If automatic deployment is disabled, open **Vercel > Deployments** and redeploy the latest commit.

## Notes

- Music mode requires a direct browser-playable audio URL. Spotify/YouTube page links can still appear on a memory, but usually cannot play as background audio.
- The map uses latitude and longitude saved with each memory.
- The export button opens the browser print dialog. Choose **Save as PDF** for a keepsake.
- Both authenticated users can currently edit the shared experience and remove memories/files. This matches a mutual-contributor setup.
