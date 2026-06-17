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

If the site says it cannot add a memory, check the message shown in the pink status box. The most common causes are:

- `photos` bucket does not exist.
- Storage policies for authenticated upload/read/delete were not created.
- `supabase-romance-upgrade.sql` was not run after the new scrapbook features were added.
- Vercel was not redeployed after pushing the latest code.

The app can now fall back to a basic milestone insert if the optional scrapbook columns are not present, but photo albums, reactions, comments, letters, and other interactions need the upgrade SQL.

## 2. Authentication

In **Supabase > Authentication > Users**, create the two accounts that should access the site.

Each person signs in with:

```txt
User ID: their Supabase Auth email
Password: the password assigned to that Auth user
```

After signing in, each person can choose a display name and profile color from the settings button.

## 3. Environment variables

Add these in **Vercel > Project > Settings > Environment Variables**:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Use the anon/public key, never the Supabase service-role key.

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
