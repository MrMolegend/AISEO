# Tutor Hub

An online tutoring marketplace for GCSE, A-Level, university and adult learners in the
UK. Students and parents compare tutors, book lessons from real availability, message
between sessions and meet in Tutor Hub's own lesson room. Tutors apply, set their rate
and hours, and manage their teaching in one place. Administrators review applications and
oversee the marketplace.

**This repository is a complete frontend build.** Every screen is finished and every
control does something, but nothing leaves the browser: there is no database, no payment
processor and no video service connected. Where a real integration would sit, the
interface says so rather than pretending.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

| Command                           | What it does                                   |
| --------------------------------- | ---------------------------------------------- |
| `npm run dev`                     | Development server                             |
| `npm run build` / `npm start`     | Production build and server                    |
| `npm run typecheck`               | `tsc --noEmit`                                 |
| `npm run lint`                    | ESLint                                         |
| `npm run format` / `format:check` | Prettier                                       |
| `npm run test`                    | Unit tests (Vitest)                            |
| `npm run test:e2e`                | End-to-end journeys (Playwright) — build first |
| `npm run verify`                  | Typecheck, lint, format check and unit tests   |

Requires Node 20.9 or later. `npm run test:e2e` builds against `next start` on port 3100;
in a sandbox with a pre-installed browser, set `PLAYWRIGHT_CHROMIUM_PATH` to its
executable.

## Demo roles

There are no credentials. `/sign-in` offers four accounts, and the account menu has a
role switcher so every dashboard can be reviewed without signing out.

| Role          | Demo account   | What they see                                                                           |
| ------------- | -------------- | --------------------------------------------------------------------------------------- |
| Student       | Maya Bennett   | A-Level Maths and Physics, two tutors, a lesson today, saved tutors and progress        |
| Parent        | Sarah Kaur     | Two linked learners in Years 11 and 13, their lessons, feedback and spend               |
| Tutor         | Priya Raghavan | Chemistry and Biology profile, 158 reviews, booking requests, availability and earnings |
| Administrator | Dan Foster     | Application queue, tutor management, bookings, users and reports                        |

The account menu also has **Reset demo data**, which clears everything you have created
and returns the seed data.

## Main routes

**Public**

`/` · `/tutors` · `/tutors/[slug]` · `/how-it-works` · `/become-a-tutor` · `/about` ·
`/contact` · `/sign-in` · `/sign-up` · `/privacy` · `/terms` · `/safeguarding`

**Booking, messaging and lessons**

`/book/[slug]` · `/booking/confirmed` · `/messages` · `/messages/[conversationId]` ·
`/lesson/[bookingId]`

**Student** `/student` · `/student/lessons` · `/student/saved` · `/student/progress` ·
`/student/settings`

**Tutor** `/tutor` · `/tutor/lessons` · `/tutor/availability` · `/tutor/students` ·
`/tutor/messages` · `/tutor/earnings` · `/tutor/profile` · `/tutor/settings`

**Parent** `/parent` · `/parent/learners` · `/parent/lessons` · `/parent/progress` ·
`/parent/messages` · `/parent/settings`

**Admin** `/admin` · `/admin/applications` · `/admin/tutors` · `/admin/users` ·
`/admin/bookings` · `/admin/reports` · `/admin/settings`

## Where the data lives

All demo data is typed TypeScript in `lib/data/`:

| File               | Contents                                                                   |
| ------------------ | -------------------------------------------------------------------------- |
| `subjects.ts`      | Twelve subjects and the levels each is taught at                           |
| `tutors.ts`        | Twelve tutor profiles — varied rates, ratings, experience and availability |
| `reviews.ts`       | Reviews written after completed lessons                                    |
| `people.ts`        | Demo accounts and the two learners linked to the parent account            |
| `bookings.ts`      | Bookings across every status                                               |
| `conversations.ts` | Message threads between tutors and students or parents                     |
| `applications.ts`  | Tutor applications waiting in the admin queue                              |
| `reports.ts`       | Platform reports for triage                                                |
| `notifications.ts` | Per-role notifications                                                     |
| `progress.ts`      | Progress entries and tutor feedback                                        |

Nothing in `app/` or `components/` imports those arrays directly. Reads go through
**`lib/queries.ts`** — `getTutors`, `getTutorBySlug`, `filterTutors`, `getSeedBookings`
and so on. That file is the seam: replace its bodies with Supabase queries and no
component changes shape.

## What persists locally

Anything you change is written to `localStorage` under `tutorhub.demo.v1` (theme lives
separately under `tutorhub.theme.v1`) and is layered on top of the seed data by
`lib/store/demo-store.tsx`:

- the demo role you signed in as
- saved tutors
- bookings you create, and status changes (cancel, reschedule, accept)
- messages you send and conversations you start
- tutor availability edits, blocked dates and public-profile changes
- tutor applications you submit, and the admin decisions on them
- admin tutor flags (verified, featured, suspended), report statuses and platform settings
- notifications you have opened
- theme choice

The store is an external store read through `useSyncExternalStore`, which is what keeps
server-rendered HTML and the first client render identical while still picking up what
was saved.

## Future integration points

Nothing below is connected. Each has one clearly marked place to connect it.

**Supabase Auth** — `components/auth/demo-role-picker.tsx` and `sign-in-form.tsx` select
a demo account; `lib/use-require-account.ts` is the guard that currently redirects to
`/sign-in?next=…`. Replace the selection with a session; the rest of the app reads
`useDemo().account`.

**Supabase database** — `lib/queries.ts`. Its functions become async queries against
tables shaped like `lib/types.ts`. Writes currently in `lib/store/demo-store.tsx`
(`createBooking`, `sendMessage`, `submitApplication`, `decideApplication`,
`setAvailability`, `saveTutorProfile`, `setTutorFlags`, `setReportStatus`) become
mutations.

**Supabase Storage** — tutor photographs (`components/ui/avatar.tsx` renders initials
today, and `/tutor/profile` has the upload button), plus application documents and
message attachments (`components/messages/messenger.tsx`).

**Supabase Realtime** — `components/messages/messenger.tsx` reads and appends through the
store; a realtime channel replaces the local append.

**Stripe / Stripe Connect** — the checkout step in `components/booking/booking-flow.tsx`
is a labelled placeholder that collects no card details. Tutor payouts are stubbed at
`/tutor/earnings`. Fee arithmetic is in `lib/booking-utils.ts`.

**Daily (or LiveKit)** — `lib/lesson/provider.ts` defines `LessonRoomProvider`, and
`demoLessonProvider` implements it locally. `components/lesson/lesson-room.tsx` talks only
to that interface. A real provider needs a server-minted room token; the local camera
preview in `lib/lesson/use-local-camera.ts` already handles permission being refused and
stops its tracks on unmount.

**Email and SMS** — `components/marketing/contact-form.tsx` validates and stops; booking,
message and application notifications would be sent from the same mutations listed above.

**Identity and qualification verification** — the admin decision flow at
`/admin/applications` records the outcome; document upload and checking is the missing
half.

## How it is put together

- **Next.js 16** (App Router) with **React 19** and **TypeScript** in strict mode.
- **Tailwind CSS v4**, with the whole design system as tokens in `app/globals.css`. Dark
  mode is a token swap on `html.dark`, applied before first paint by a small inline
  script so there is no flash.
- **Motion for React** for entrances, drawers, tabs and step transitions — short,
  opacity-and-transform only, and switched off under `prefers-reduced-motion`.
- **Lucide** icons.
- Client components are kept to the parts that need state. The public pages are server
  components; the marketplace, dashboards, messenger and lesson room are not.
- Dates and money are formatted by hand in `lib/datetime.ts` and `lib/utils.ts` rather
  than by `Intl`, because Node's and the browser's ICU disagree on the details and React
  reports the difference as a hydration failure.

### Tests

- `tests/unit` — filtering and sorting, availability generation, formatting, tutor
  metrics and the integrity of the demo data (80 tests).
- `tests/e2e` — the journeys the product is judged on: searching, filtering, favouriting,
  booking end to end, messaging, the tutor application through to admin approval,
  suspension removing a tutor from search, the lesson room, and the theme toggle. Mobile
  has its own spec for the drawer, the filter sheet, the sticky booking bar and the
  bottom navigation.
