# FitTrack AI

Workout planner and logger, food and nutrition tracker, body progress charts, habits, and reminders.
React + TypeScript + Vite + Tailwind + Recharts (web) · Express + TypeScript + Prisma + PostgreSQL (server).

## Run it

### Docker (everything)
```bash
cp .env.example .env        # set JWT_SECRET
docker compose up --build
# app: http://localhost:8080   api: http://localhost:4000
```

### Local dev
```bash
docker compose up db -d
cp .env.example server/.env          # DATABASE_URL points at localhost
cd server && npm install
npx prisma generate && npx prisma db push   # or: npx prisma migrate dev --name init
npm run seed                                # exercises + ~50 foods
npm run dev                                 # API :4000, reminder scheduler included
# second terminal
cd web && npm install && npm run dev        # http://localhost:5173 (proxies /api)
```

## What's implemented
- Auth: register, login, logout, password reset (bcrypt, httpOnly JWT cookie). Reset links go to server logs unless `SMTP_URL` is set.
- Multiple profiles per account, each with fully separate food, workouts, measurements, reminders. Edit, delete, JSON export.
- Targets: Mifflin-St Jeor × activity, goal adjustment with a safety floor, protein 1.6–2.0 g/kg, fat/carbs/fiber/water. Assumptions shown; manual override supported; auto-recalculates on profile change unless pinned.
- Dashboard: calories/macros consumed vs remaining (excess shown as "over"), workout %, water, steps, habits, explainable notes.
- Workouts: default 6-day PPL template, fully editable weekly planner (reorder, replace, add cardio/mobility, rest days, swap days). Explicit "Start workout" (opening never logs), per-set weight/reps/warm-up, rest timer, skip with reason, replace, pain flag, autosave, PR detection (Epley est. 1RM), duplicate-safe sessions (DB unique constraint), finish summary, history.
- Exercise library: 34 exercises with written instructions, mistakes, safety, variations; search + filters.
- Food: natural-language parser with a review screen (ambiguity flags like cooked vs dry), search, custom foods, edit grams, delete, copy yesterday, per-entry source and "estimated" flags.
- Progress: weight with 7-day average, waist, calories, protein, workouts/week, steps, strength per exercise; 7/30/90/custom ranges.
- Reminders: per-profile schedules (time, days), quiet hours, snooze, no duplicates, missed-workout flow (start / move to tomorrow / skip), in-app inbox, browser Notifications while open, Web Push when VAPID keys are set.

## Known limits (be aware)
- **Food data is a small seed list** (~50 foods, rounded per-100 g approximations, labelled as such). For production accuracy, import USDA FoodData Central or Open Food Facts (not wired in) and verify values.
- **No AI parsing**; the deterministic parser only. Ml-to-gram uses density only where set, otherwise 1 g/ml and is flagged as estimated.
- **No exercise videos or images**: none are bundled (no invented URLs). Add licensed media per exercise.
- Not built: recipe builder, barcode scanning, progress photos, email reminders (other than password reset), imperial-unit UI (data is metric), automatic step sync, deload-week scheduler, per-day "reschedule to arbitrary date" (only move/swap).
- Browsers cannot guarantee alarms when closed. For reliable alarms, build a native Android app.
- Seed foods and calorie targets are estimates, not medical advice.
- Not yet run end to end against a live database in the build environment (Prisma engines couldn't be downloaded there). TypeScript compiles for server and web, the parser and target calculator were exercised directly, and the web bundle builds.
