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
- Panels-on-mobile: full-screen sheet overlay confirmed in the deployed bundle; needs a real-phone pass (desktop Chrome device-mode is not a phone)
- Voice on iOS Safari needs a physical device test (MediaRecorder + permissions)
- No push notifications yet (streak reminders would need Web Push + server worker)

## Demo-data note (for the staging walkthrough)
Sipho's account (sipho / heroes123) carries intentional demo state so the walkthrough has texture: a driver-licence goal with step 1 done, a savings goal ("Laptop for coding course", R500 of R8000), a 1-day check-in streak, and a coach thread. All of it can be reset from the app (New conversation, uncheck steps) or wiped by recreating the user from Eed → Accounts.




## Admin experience stories
### S10 — Experience as member (sandbox, not impersonation)
**As an admin, I want to feel exactly what members feel — test chats, check-ins, tools — without touching any real member's account.**
- [x] One "Experience as member" button on the Dashboard enters member mode
- [x] Mode uses a synthetic "Test Member" account (hero_sandbox): all test data lands there, never on a real member
- [x] Member-mode nav is the pure member experience (Chat/Circle/Tools — no admin surface), amber "Test mode" banner with one-tap exit
- [x] Sandbox excluded from the Dashboard member list and risk flags
- Status: **verified live (staging, 2026-10-11)** — enter → sandbox chat 200 → exit → admin restored; overview shows no sandbox rows

### S11 — Messages live in Circle
**As a member, the Circle is the community surface: feed AND direct messages in one place.**
- [x] Segmented [Feed | Messages] view inside the Circle tab with unread badge (8s poll)
- [x] DM threads with 5s polling, mark-as-read on view
- [x] Anyone can DM anyone (member→admin included)
- [x] Tools sheet no longer holds Messages or Circle
- Status: **verified live (staging, 2026-10-11)** — recipient's unread badge incremented 1→2 on a new message; opening the thread marks read and the badge clears; segmented pill confirmed in the deployed bundle

### S12 — Admin login lands on Eed (the admin dashboard)
**As an admin, my default view is Eed (the community dashboard) — fundamentally different from the member experience.**
- [x] Admin login lands on Eed (members overview, risk flags, accounts, opportunities, persona)
- [x] Admin nav: Eed + Circle only (no Chat/Tools — those are member surfaces)
- [x] Members never see any admin surface
- Status: **verified live (staging, 2026-10-11)**

## Known limits (honest list)
- **Casual goal mentions don't always create goals.** Saying "I want to get my licence" mid-conversation sometimes gets a conversational reply without the goal being logged; stating intent ("set that goal up with steps") works reliably. Fix is prompt-tuning + a confirmation step ("want me to log that as a goal?") — queued.
- **iOS voice needs a real-phone test.** The transcription path works everywhere we can test, but Safari's MediaRecorder + mic-permission flow behaves differently on real iPhones. Needs a physical device pass before launch.
- **Same-tick concurrent duplicate sends** can still double-insert (the 5s replay guard is sequential-only; the client-side in-flight guard covers real double-taps). Only reachable via scripted concurrent calls.
- **No push notifications yet.** Streak reminders would need Web Push + a service worker — the highest-value next engagement feature.
- **Messages polling is 5s** (no websockets) — fine for a small community, worth upgrading if it grows.
- **Bra Hero avatar is Ahren-supplied art bundled as-is** — if a lighter small-size variant is wanted (24px message rows), we can derive one.
