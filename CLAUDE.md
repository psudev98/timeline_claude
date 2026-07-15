# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A private, two-person "romance timeline" web app (React 19 + Vite + Framer Motion + Supabase). One shared account per partner, no public signup. Views: Timeline, Calendar, Wall (polaroid grid), Letters, Someday (bucket list), Stats. Entry point is `index.html` → `src/main.tsx`. The frontend is a pure client-side SPA — there is no server-side code in this app.

## Commands

```bash
npm install
npm run dev      # vite --host 127.0.0.1
npm run build    # vite build (production bundle in dist/)
npm run preview  # vite preview --host 127.0.0.1
```

There is no `tsconfig.json`, no lint config, and no test suite. `npm run build` runs `vite build` only — Vite/esbuild transpiles and bundles but does **not** type-check. TypeScript types in this codebase are for editor/authoring clarity, not enforced by the build; a successful `npm run build` does not mean the types are sound. There's no separate command to add — this is the extent of the tooling.

## Architecture

**Almost everything lives in `src/main.tsx` (~2,600 lines).** Every view (`TimelineView`, `CalendarView`, `PolaroidWall`, `LettersView`, `SomedayView`, `StatsView`), every modal (`MemoryComposer`, `SettingsPanel`, `LetterComposer`), and every small reusable piece (`TimePill`, `EmptyState`, `FloatingHearts`, etc.) is a top-level function defined in this one file. Only two components are split out, because they're reused across files: `src/ReactionRow.tsx` and `src/MemoryPhotoViewer.tsx`. When adding a new view or feature, follow this convention — add it as a new top-level function in `main.tsx` near the other views, don't create a new file for it.

**Top-level flow:** `App()` gates on Supabase auth session → `AuthScreen()` (unauthenticated) or `RomanceApp({ session })` (authenticated, the real app shell: topbar, nav tabs, hero counter, and the active view).

**Data layer (`src/romanceApi.ts`):** `loadRomanceData()` does one batched `Promise.all` across all tables (milestones, milestone_media, reactions, comments, love_letters, special_dates, bucket_list_items) and returns a single typed object. `RomanceApp`'s `refresh()` calls it and sets the corresponding state. Photo/voice storage paths are signed in one batched `signAllUrls()` call rather than per-file, since that matters a lot on mobile networks. A single Supabase Realtime channel (`romance-live`) subscribes to `postgres_changes` on every table and calls `refresh(true)` on any change — this is the only realtime wiring; there's no per-view subscription.

**Mutations** (insert/update/delete against Supabase) are defined as closures inside `RomanceApp`, not in `romanceApi.ts` — they need direct access to `session.user.id`, `setStatus`, `setToast`, and `refresh`. `romanceApi.ts` only holds pure data-loading/shaping functions and a few auth/profile/upload helpers. Follow this split when adding new mutations.

**Nav/view switching:** `ViewName` (in `src/types.ts`) is the union of every tab. The tab bar uses a Framer Motion `layoutId`-based shared-element indicator that automatically adapts to however many `<ViewButton>`s exist — adding or removing a tab needs no changes to the indicator logic itself.

**Auth is unusual — read before touching it.** There's no email/password form. Each partner picks a named card, then answers one of three rotating trivia questions (first date / first kiss / anniversary) with a date picker. The trivia answer is compared entirely client-side against a `VITE_TRIVIA_*` env var and is **never** sent to Supabase. Only on a correct guess does the app call `signInWithPassword` behind the scenes using a separate hidden per-partner password (`VITE_PARTNER_*_AUTH_SECRET`) that the person never sees or types. A wrong guess never touches Supabase — it picks a random line from the large static `roastPool` in `main.tsx` (via `pickRoastLine()`, which avoids repeating the line currently on screen) and rolls a new question. See README.md § 2 for the full mechanics.

**Env vars are `VITE_`-prefixed and get bundled into shipped client JS** — they're kept out of git via `.env.local`/`.gitignore`, but are not truly secret once deployed (anyone inspecting the deployed site's JS can read them). The `AUTH_SECRET` and `TRIVIA_*` values should still be treated as real passwords (long, random, unique per partner) since the auth-secret values literally *are* each account's Supabase Auth password.

## Supabase migrations

SQL migrations are standalone, additive `.sql` files at the project root (not a `supabase/migrations/` folder) — `supabase-romance-upgrade.sql` (base schema), `supabase-avatar-storage.sql` (public avatars bucket), `supabase-bucket-list.sql` (Someday feature). Each new feature needing schema changes should follow the same convention: a new root-level `.sql` file, run manually in the Supabase SQL Editor, following the established shape:
- `create table if not exists` / `drop policy if exists` + `create policy` (idempotent, safe to re-run)
- RLS enabled, with policy `for all to authenticated using (true) with check (true)` — this is the default for shared data (`milestones`, `special_dates`, `love_letters`, the Someday table). The stricter `auth.uid() = user_id` variant is only used by `reactions`/`comments`.
- A `do $$ ... pg_publication_tables ... alter publication supabase_realtime add table ... $$;` block to add the new table to realtime, guarded so it's a no-op if already added.

`romanceApi.ts`'s `isOptionalSetupError()`/`setupError()` pattern lets the app degrade gracefully (rather than crash) when an optional migration hasn't been run yet in a given environment — new optional tables should be wired into `loadRomanceData()`'s `Promise.all` the same way, with their error guarded by `isOptionalSetupError` before being added to `firstError`.

A Supabase MCP server can be registered project-scoped (`.mcp.json`, gitignored) via `claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=<ref>"`, authenticated via `/mcp` in an interactive session (OAuth, no PAT needed). Project-scoped MCP servers are only picked up at session startup, so a server added mid-session requires starting a new session before it's usable.

## Motion/animation conventions

- Bouncy overshoot ease `[0.34, 1.56, 0.64, 1]` and spring configs like `{ type: 'spring', stiffness: 130, damping: 11, bounce: 0.52 }` are the established feel for card/tile entrances — reuse them rather than inventing new easing for new views.
- Reduced motion is dual-gated: a JS `useReducedMotion()` check (for `whileHover`/`whileTap`/conditional animation props) *and* a global CSS blanket override in `styles.css` under `@media (prefers-reduced-motion: reduce)` that forces `transition-duration`/`animation-duration` to `1ms !important` for specific classes. New animated classes need to be added to that override list, not just gated in JS.
- Framer Motion takes over the entire inline `transform` CSS property on any element where a `style={{ ... }}`-bound motion value targets a transform sub-property (rotate/scale/x/y) — a competing CSS `transform` rule on that same element will be fought/overwritten. If you need a plain CSS transform effect on an element that also has Framer-driven transforms, use a separate wrapper `<div>` with no Framer bindings.
- Elements with `position: absolute` (e.g. `.inline-form`) resolve against the nearest ancestor with `position: relative` — the app relies on `.view-heading`/`.countdown-band`-style containers providing that positioning context. If an absolutely-positioned popover/form seems to render "nowhere," check that its intended positioned ancestor actually has `position: relative`.
- Avoid unmemoized list re-renders on scroll-driven state: `TimelineCard` is wrapped in `React.memo` with a custom comparator that excludes the inline callback props (they're recreated every render but close over the same stable `item`, so comparing them would defeat the memoization). Follow this pattern for any other per-item component driven by frequently-updating parent state (e.g. scroll/intersection tracking).

## Deployment

Hosted on Vercel, connected to the GitHub repo — pushes to the deployed branch auto-build and deploy. Env vars are configured in Vercel project settings, mirrored locally in `.env.local` (gitignored). See README.md for the full list of required env vars and the Supabase setup steps.
