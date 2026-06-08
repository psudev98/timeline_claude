# Our Little Timeline

A romantic, animated React timeline with a live anniversary counter, scroll-linked glowing timeline, spring-loaded memory cards, and a hidden contributor panel.

## Run locally

```bash
npm install
npm run dev
```

## Firebase upgrade path

The demo stores new memories in `localStorage` so it works immediately. To make it collaborative:

1. Create a Firebase project with Firestore and Storage enabled.
2. Add your Firebase web app keys to `.env.local` using the `VITE_FIREBASE_*` names from `src/firebaseTemplate.ts`.
3. Replace the local `useState` persistence in `src/main.tsx` with `subscribeToMilestones`, `uploadMilestonePhoto`, and `addMilestoneToFirestore`.
4. Add Firebase Auth or a stronger password gate before sharing the contributor panel publicly.
