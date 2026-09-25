# Monetisation (Milestone 6) — decisions needed from the owner

Everything through Milestone 5 is local-first and needs no account. M6 is the first cloud
work and it needs product decisions that the research informs but cannot make.

## What the research says
- Subscriptions cluster at $10–20 / month with a cheaper annual (Yousician, Rocksmith+,
  Melodics, Simply). One-time and lifetime options exist and sell (Synthesia $39,
  Playground $349, Tribe XR $199).
- Content-tier splits work: Melodics Standard vs Premium (song lessons), Yousician Premium
  vs Premium+ (licensed songs), Flowkey Classic vs Premium.
- Hardware bundle codes are a proven channel: Melodics via Pioneer serial numbers, Traktor
  Play bundled with the FLX4.
- The complaints to avoid: daily minute caps on the free tier, first-lesson-only paywalls,
  trial-billing disputes, platform lock-in.

## Proposed split (draft for your decision)
- **Free**: Foundations and Mixing packs, generic profile, history, daily goal, calibration,
  editor. Fully usable forever.
- **Pro**: Performance/Advanced/Pro packs and signature moves, replay and ghost, daily
  challenge leaderboards, cloud sync across devices, weekly challenge, pack sharing.
- Price points to test: $8 / month, $60 / year, $149 lifetime. Bundle code with a
  controller partner as the acquisition channel.

## Decisions you need to make
1. Accounts provider (Clerk / Supabase Auth / Firebase) and where attempts sync (Supabase
   Postgres is the simplest fit for the existing Dexie shapes).
2. Payments (Stripe, or app-store billing if Tauri ships to the Mac App Store).
3. Leaderboard integrity: the daily challenge is seeded and local; a shared board needs
   server-side re-scoring from the input log (the engine's replay reconstruction already
   does this deterministically, so it can run in a serverless function).
4. Licensed audio: the synthesized stems avoid licensing entirely. If real tracks are ever
   wanted, that is a rights conversation, not an engineering one.
5. Brand and name. "MIDI Trainer" is a working title.

Nothing in the codebase blocks any of these; the storage layer exports and imports full
backups already, which is the shape a sync service would move.
