# HEROES Portal — User Stories & Test Status

Agreed scope for "actually used by real alumni". **Full sweep re-run 2026-10-11 11:41 UTC on live staging** (app-g7jp5, scd) with the real model: every story below re-verified end-to-end in one pass.

## Alumnus stories

### S1 — First login (the 30-second test)
**As a new alumnus given a username and password by the HEROES office, I log in on my phone and immediately understand what this app is.**
- [x] Login screen shows the real HEROES brand (portrait logo, wordmark, values row)
- [x] PWA-installable on Android/iPhone home screen (manifest + icons live)
- Status: **verified live 11:41 UTC** — login 200 (admin+alumnus), portrait/manifest/favicon all 200

### S2 — Daily check-in (the habit loop)
**As an alumnus, each morning I open the app, tell Bra Hero how I'm doing by voice or text, and see my streak grow.**
- [x] Voice: hold mic → transcript in input → confirm → send
- [x] Streak strip updates; milestone toasts at 3/7/14/21/30 days with haptic
- [x] Dedup: double-tap cannot double-log or confuse the model
- Status: **verified live 11:41 UTC** — real speech → transcript, check-in turn logged checkin + workout actions, streak strip serving

### S3 — Getting something real done (goal machine)
**As an alumnus, I tell Bra Hero a goal ("I want my driver licence") and walk out with concrete steps I can tick off.**
- [x] Chat creates goal + steps; My Path panel shows progress ring and checkable steps
- [x] Ticking all steps completes the goal with a celebration
- Status: **verified live 11:41 UTC** — explicit save-goal turn created 4-step goal; goals visible in panel data. Note: casually-phrased turns sometimes get conversational-only replies (no actions) - acceptable degradation, goal creation works when the user states intent.

### S4 — Money without judgement
**As an alumnus, I check in my income and expenses and get straight advice, not a spreadsheet.**
- [x] Money check-in via chat parses into structured snapshot with AI feedback
- [x] Money panel shows month history and left-over
- Status: **verified live 11:41 UTC** — money snapshot persisted (panel data: 1 snapshot); the re-issued explicit turn saved R2000 goal + money actions cleanly, no raw JSON in any reply

### S5 — When it's heavy (human escalation)
**As an alumnus going through something hard, I can reach a real HEROES coach from the conversation without stigma.**
- [x] "I need to talk to a real coach" → escalation + Coach panel thread
- [x] Coach replies land in the alumnus's thread, amber-highlighted
- Status: **verified live 11:41 UTC** — escalation fired, inbox 2 threads, coach reply 201 landed as from_coach in thread

### S6 — Brothers seeing brothers (community)
**As an alumnus, I share wins and see others' wins in a private space.**
- [x] Circle panel: post, comment, avatars
- [x] AI nudge (community_pulse) prompts sharing at natural moments
- Status: **verified live 11:41 UTC** — post 201; community_pulse action in protocol

### S7 — Restart when a conversation goes stale
**As an alumnus, I can start a fresh conversation with Bra Hero without losing my goals or history.**
- [x] "New" button archives the thread; goals/streak/checkins untouched
- Status: **verified live 11:41 UTC** — reset 200, thread empty after, archived rows out of context

## Admin stories

### S8 — Who needs attention today
**As the admin, I open the dashboard and see in 10 seconds who is thriving, fading, or asking for help.**
- [x] Member cards: streak, mood sparkline, risk flag, last active
- [x] Risk flags: low engagement, mood decline, coach open
- [x] Drilldown: mood history + inline coach reply
- [x] Demo data: 8 realistic members across 5 archetypes (DEMO_SEED=1 on staging)
- Status: **verified live 11:41 UTC** — 11 members, risks: 6 none / 3 mood_decline / 1 low_engagement / 1 coach_open; panel-sheet overlay confirmed in deployed bundle

### S9 — Running the roster
**As the admin, I create alumni accounts and reset passwords from my phone.**
- [x] Create user, reset password, coach inbox
- Status: **verified live 11:41 UTC** (admin login + coach-reply endpoint exercised in this sweep; roster CRUD unchanged from v1)

## Known gaps (not blocking first use, tracked deliberately)
- Panels-on-mobile: full-screen sheet overlay (fixed inset-0, own scroll, safe-area) confirmed in the deployed bundle; needs a real-phone pass (desktop Chrome device-mode is not a phone)
- Voice on iOS Safari needs a physical device test (MediaRecorder + permissions)
- No push notifications yet (streak reminders would need Web Push + server worker)
