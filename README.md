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
- "Someday" bucket list with one-tap conversion of a completed item into a real memory
- "Us in Numbers" stats page

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

Then also run:

```txt
supabase-bucket-list.sql
```

This creates the `bucket_list_items` table used by the "Someday" bucket-list board.

If the site says it cannot add a memory, check the message shown in the pink status box. The most common causes are:

- `photos` bucket does not exist.
- Storage policies for authenticated upload/read/delete were not created.
- `supabase-romance-upgrade.sql` was not run after the new scrapbook features were added.
- Vercel was not redeployed after pushing the latest code.
- Reactions/comments fail with `PGRST205` because Supabase cannot find the `public.reactions` or `public.comments` table. Run the upgrade SQL and refresh the page.

The app can now fall back to a basic milestone insert if the optional scrapbook columns are not present, but photo albums, reactions, comments, letters, and other interactions need the upgrade SQL.

## 2. Authentication

In **Supabase > Authentication > Users**, create the two accounts that should access the site.

The login screen no longer asks for an email or a fixed typed password. Instead:

- Each person picks their own named card, then is asked one of three rotating trivia questions about the relationship (first date, first kiss, anniversary) and answers with a date picker.
- The correct answer to each question is a `YYYY-MM-DD` date stored in an env var (see below) - it's compared entirely in the browser and is never sent to Supabase.
- Only once the trivia answer matches does the app sign in behind the scenes using a separate, hidden per-partner password (also an env var) that the person never sees or types.
- Set each account's real Supabase Auth password to that hidden per-partner value (`VITE_PARTNER_DEVA_AUTH_SECRET` / `VITE_PARTNER_AADI_AUTH_SECRET`), **not** to a date anymore.
- A wrong guess never touches Supabase at all - it just shows a playful message and rolls a new question.
- The email each card signs in with still comes from environment variables, not from typing - see "Environment variables" below.

After signing in, each person can choose a display name and profile color from the settings button.

## 3. Environment variables

Add these in **Vercel > Project > Settings > Environment Variables**:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_PARTNER_DEVA_EMAIL=deva_actual_login_email@example.com
VITE_PARTNER_AADI_EMAIL=aadi_actual_login_email@example.com
VITE_PARTNER_DEVA_AUTH_SECRET=some_long_random_hidden_password_for_deva
VITE_PARTNER_AADI_AUTH_SECRET=some_long_random_hidden_password_for_aadi
VITE_TRIVIA_FIRST_DATE=2024-01-01
VITE_TRIVIA_FIRST_KISS=2024-01-05
VITE_TRIVIA_ANNIVERSARY=2024-02-14
```

Use the anon/public key, never the Supabase service-role key.

The two `VITE_PARTNER_*_EMAIL` values are what let the login screen sign each person in without ever showing an email box. They're kept out of the GitHub repo by living only in env vars, but like all `VITE_`-prefixed variables they do get bundled into the site's shipped JavaScript - so treat them as "not in source control" rather than "secret." Anyone who inspects the deployed site's network/JS could still see them.

The `VITE_PARTNER_*_AUTH_SECRET` and `VITE_TRIVIA_*` values follow the same rule: kept out of the GitHub repo, but still bundled into the shipped JavaScript like everything else here. Treat the auth-secret values as real passwords anyway (long, random, unique per partner) since they literally are each account's actual Supabase Auth password now.

For local development, put the same values in `.env.local`.

### Wrong-guess roasts (optional, needs one more var)

```bash
GROQ_API_KEY=your_groq_api_key
```

Get a free key at [console.groq.com](https://console.groq.com) - no credit card needed. Unlike every other var above, **do not prefix this one with `VITE_`**. It's read server-side only, by the Vercel serverless function at `api/roast.ts`, and must never end up in the shipped client JS (a leaked key could be used by anyone to burn the shared free-tier rate limit). When a partner answers the trivia question wrong, the login screen shows a brief loading spinner while it asks Groq for a freshly generated roast line; if `GROQ_API_KEY` isn't set, or the request fails or times out (3s), it falls back to a line from the static `roastPool` instead - there's no user-visible error either way. A small badge under the roast line ("fresh from the AI" vs. "classic roast") shows which one you got.

Local dev note: plain `npm run dev` (Vite) does not serve the `/api` folder, so the roast endpoint will 404 locally and silently fall back to the static pool - to actually exercise `api/roast.ts` locally, run `vercel dev` instead (needs the Vercel CLI and the project linked with `vercel link`).

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
