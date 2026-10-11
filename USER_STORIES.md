# HEROES Portal — User Stories & Test Status

Agreed scope for "actually used by real alumni". Every story is tested below against the live staging deployment (app-g7jp5, scd) with the real model unless marked otherwise.

## Alumnus stories

### S1 — First login (the 30-second test)
**As a new alumnus given a username and password by the HEROES office, I log in on my phone and immediately understand what this app is.**
- [x] Login screen shows the real HEROES brand (portrait logo, wordmark, values row)
- [x] PWA-installable on Android/iPhone home screen (manifest + icons live)
- Status: **verified** — login flow + brand assets served (200 on /brand/portrait.png, manifest valid)

### S2 — Daily check-in (the habit loop)
**As an alumnus, each morning I open the app, tell Bra Hero how I'm doing by voice or text, and see my streak grow.**
- [x] Voice: hold mic → transcript in input → confirm → send
- [x] Streak strip updates; milestone toasts at 3/7/14/21/30 days with haptic
- [x] Dedup: double-tap cannot double-log or confuse the model
- Status: **verified live** — real speech transcribed (3.5s), streak + toast mechanics deployed

### S3 — Getting something real done (goal machine)
**As an alumnus, I tell Bra Hero a goal ("I want my driver licence") and walk out with concrete steps I can tick off.**
- [x] Chat creates goal + steps; My Path panel shows progress ring and checkable steps
- [x] Ticking all steps completes the goal with a celebration
- Status: **verified live** — real-model turn created 4-step K53 goal

### S4 — Money without judgement
**As an alumnus, I check in my income and expenses and get straight advice, not a spreadsheet.**
- [x] Money check-in via chat parses into structured snapshot with AI feedback
- [x] Money panel shows month history and left-over
- Status: **verified live** — R5200/4400 parsed, feedback referenced real numbers

### S5 — When it's heavy (human escalation)
**As an alumnus going through something hard, I can reach a real HEROES coach from the conversation without stigma.**
- [x] "I need to talk to a real coach" → escalation + Coach panel thread
- [x] Coach replies land in the alumnus's thread, amber-highlighted
- Status: **verified live** — round-trip admin ↔ sipho works

### S6 — Brothers seeing brothers (community)
**As an alumnus, I share wins and see others' wins in a private space.**
- [x] Circle panel: post, comment, avatars
- [x] AI nudge (community_pulse) prompts sharing at natural moments
- Status: **verified** — posts/comments live; community_pulse action in protocol

### S7 — Restart when a conversation goes stale
**As an alumnus, I can start a fresh conversation with Bra Hero without losing my goals or history.**
- [x] "New" button archives the thread; goals/streak/checkins untouched
- Status: **verified** — archive + empty thread + fresh context tested end-to-end

## Admin stories

### S8 — Who needs attention today
**As the admin, I open the dashboard and see in 10 seconds who is thriving, fading, or asking for help.**
- [x] Member cards: streak, mood sparkline, risk flag, last active
- [x] Risk flags: low engagement, mood decline, coach open
- [x] Drilldown: mood history + inline coach reply
- [x] Demo data: 8 realistic members across 5 archetypes (DEMO_SEED=1 on staging)
- Status: **verified live** — 11 members, risk distribution no/low/decline/coach visible

### S9 — Running the roster
**As the admin, I create alumni accounts and reset passwords from my phone.**
- [x] Create user, reset password, coach inbox
- Status: **verified** (v1 flow preserved in Accounts tab)

## Known gaps (not blocking first use, tracked deliberately)
- Panels-on-mobile: sheet overlay now full-screen with own scroll; needs a real-phone pass (desktop Chrome device-mode is not a phone)
- Voice on iOS Safari needs a physical device test (MediaRecorder + permissions)
- No push notifications yet (streak reminders would need Web Push + server worker)
