# BidPulse — Build Guide

Full 6-stage procurement intelligence platform, built from 43 Stitch mockups
in `mockups-reference/` plus the extended schema in `schema.sql`.

Stack: **Next.js 15 (App Router, TypeScript) + Tailwind + Supabase (Postgres, Auth, Storage) + Vercel.**

**Everything below runs entirely in the browser — no desktop apps or local
installs.** The four tools involved are GitHub, GitHub Codespaces (a full
VS Code environment that opens in a browser tab), the Supabase dashboard,
and the Vercel dashboard.

---

## 0. What's in this repo

Once unzipped into the root of your GitHub repo, the layout is:

```
(repo root)
├── README.md                    ← you are here
├── schema.sql                   ← full Postgres schema, run this first
├── package.json
├── middleware.ts                ← keeps Supabase auth sessions alive app-wide
├── tailwind.config.ts           ← design tokens copied 1:1 from DESIGN.md
├── app/
│   ├── globals.css
│   └── (app)/
│       └── intake/
│           ├── page.tsx         ← WORKED EXAMPLE: mockup → real page
│           └── IntakeActions.tsx
├── components/ui/
│   ├── AppShell.tsx              ← shared header/nav, used on every screen
│   └── LifecycleStepper.tsx      ← shared 6-stage stepper, used on every screen
├── lib/supabase/
│   ├── client.ts                 ← browser client
│   └── server.ts                 ← server-component client
└── mockups-reference/            ← your original 43 screens + DESIGN.md, untouched
```

**How to keep building with AI help:** open this repo in GitHub Codespaces
(step 3 below) and use the Claude Code extension inside that browser-based
VS Code — no install needed, since Codespaces itself is remote. Work
through Phases 1–8 in section 3. Prompt it with things like *"convert
mockups-reference/compliance_matrix_desktop/code.html into
app/(app)/compliance/page.tsx following the same pattern as the intake
page"* — it can read the mockup HTML, the schema, and the existing
converted pages for context, and repeat the pattern screen by screen.

---

## 1. One-time setup (all in the browser)

1. **Create a GitHub repo.** On github.com: New Repository → name it
   `bidpulse` → keep it **private** → leave "Add a README file" unchecked
   → Create repository. Don't upload anything yet — leave it empty.

2. **Open it in Codespaces.** On the repo page: green "Code" button →
   Codespaces tab → "Create codespace on main." This opens a full VS
   Code in a new browser tab, cloned from your (currently empty) repo,
   with a built-in terminal — this is where every command below runs.

3. **Upload the zip into the codespace.** In the Explorer panel on the
   left, drag `bidpulse-build.zip` from your computer straight onto the
   file list. It uploads into the codespace (still nothing installed on
   your machine — this is a browser tab).

4. **Extract it and move it into place.** In the terminal, run exactly
   this:
   ```bash
   unzip bidpulse-build.zip
   mv bidpulse-build/* .
   mv bidpulse-build/.* . 2>/dev/null || true
   rm -rf bidpulse-build bidpulse-build.zip
   ```
   This unpacks the zip, moves every file (including hidden ones like
   `.gitignore`) up into the repo root, and deletes the now-empty folder
   and the zip. Confirm it worked: `ls` should show `app`, `components`,
   `lib`, `mockups-reference`, `schema.sql`, `package.json`, etc. directly
   — not nested inside a `bidpulse-build` folder.

5. **Commit and push** so the files are saved to GitHub, not just sitting
   in this codespace:
   ```bash
   git add -A
   git commit -m "Initial BidPulse scaffold"
   git push
   ```

6. **Install dependencies:**
   ```bash
   npm install
   ```
   Note: it's `npm install`, not `npm run install` — `run` is only for
   named scripts (`dev`, `build`, etc.) defined in `package.json`'s
   `"scripts"` section. Plain `install` is a built-in npm command, not a
   script, so `run` doesn't apply to it.

7. **Create a Supabase project** at supabase.com (browser dashboard) →
   New Project → pick a name/password/region → wait ~2 min for it to
   provision.

8. **Get your API credentials:** in that project, go to
   **Settings → API**. You need two values from this page:
   - **Project URL** (looks like `https://abcxyz.supabase.co`)
   - **anon public** key, under "Project API keys" (a long string
     starting with `eyJ...`) — NOT the `service_role` key, which must
     never be exposed to the browser.

9. **Run the schema:** in the same project, go to **SQL Editor → New
   query**, paste in the entire contents of `schema.sql`, and click
   **Run**. This creates every table, the enums, the RLS policies, and
   the `rfp-documents` storage bucket in one go. You should see
   "Success. No rows returned."

10. **Set environment variables.** Back in the Codespaces Explorer,
    right-click the repo root → New File → name it exactly `.env.local`
    → paste in, replacing the placeholders with your actual values from
    step 8:
    ```
    NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
    ```
    This file is already listed in `.gitignore`, so it won't get pushed
    to GitHub — that's intentional, since it holds project-specific
    config.

11. **Confirm email/password auth is on:** Supabase dashboard →
    Authentication → Providers → "Email" should already show as enabled
    by default. This is what `team_members.auth_user_id` links against —
    no action needed unless it's off.

12. **Create yourself an admin account.** There's no `/signup` page in
    the code yet (that's Phase 1 below), so create the first user
    directly in Supabase:
    - **Authentication → Users → Add user.** Enter your email and a
      password, check **"Auto Confirm User"**, click Create. Click into
      the new user and copy its **User UID** (a long uuid) — you'll need
      it in the next step.
    - **Table Editor → `organizations` → Insert row.** Set `name` to
      something like `BidPulse Internal`, leave `id` and `created_at` on
      their defaults, click Save. Click into the new row and copy its
      `id` value.
    - **Table Editor → `team_members` → Insert row.** Fill in:
      `org_id` = the organization `id` you just copied,
      `auth_user_id` = the User UID you copied,
      `full_name` = your name,
      `email` = the same email you signed up with,
      `role` = `platform_admin`.
      Save.

13. **Run the app:**
    ```bash
    npm run dev
    ```
    Codespaces detects the running server and shows a popup — click
    **"Open in Browser"** (or the Ports tab → the forwarded port → globe
    icon). In that new tab, go to `/intake`. You should see the
    worked-example page render with empty fields (no bid exists yet).
    To see it populated: Table Editor → `bids` → Insert a row with some
    sample `title`/`agency`/`org_id` values → copy its `id` → visit
    `/intake?bid=<that-id>` in the app.

14. **Deploy it live (optional, whenever you're ready):** at vercel.com,
    sign in with GitHub → "Add New Project" → import the `bidpulse` repo
    → in "Environment Variables," add the same two keys from step 8/10 →
    Deploy. Every future `git push` to `main` auto-redeploys — no CLI, no
    local build step.

---

## 2. The conversion pattern (repeat this 42 more times)

Every mockup in `mockups-reference/<screen_name>/code.html` is a
self-contained Tailwind CDN page. `app/(app)/intake/page.tsx` shows the
full conversion. The recipe:

1. Open `mockups-reference/<screen>/code.html` next to the new page file.
2. The Tailwind class names in the mockup (`bg-surface-container-lowest`,
   `text-headline-lg`, etc.) already match the tokens in
   `tailwind.config.ts` — copy the JSX structure across almost verbatim,
   converting `class=` → `className=` and closing self-closing tags.
3. Delete the `<header>` / desktop `<nav>` / mobile bottom `<nav>` — wrap
   the page in `<AppShell activePath="/whatever">` instead.
4. If the screen shows the 6-stage stepper, replace it with
   `<LifecycleStepper currentStage={N} />`.
5. Replace hardcoded placeholder copy (agency names, dollar figures) with
   real fields from a Supabase query.
6. Anything interactive (buttons that mutate data, checkboxes, forms)
   goes in a small sibling `"use client"` component, like
   `IntakeActions.tsx` — keep the page itself a server component so data
   fetching stays simple and fast.
7. Every state-changing action that matters for compliance/legal
   purposes (attestations, sign-offs, submissions, exports) should also
   insert a row into `audit_log`. Never update or delete audit_log rows —
   that's what makes it a real audit trail.

---

## 3. Route map — build in this order

### Phase 1 — Platform shell + Auth (do first, everything depends on it)
- `middleware.ts` — **done**, keeps Supabase sessions refreshed on every request
- `/login`, `/signup` — **done**. `/signup` inserts the matching
  `organizations` + `team_members` rows (role `contractor_owner`) right
  after `supabase.auth.signUp()` succeeds when the project returns a
  session immediately; if "Confirm email" is on, it defers that insert to
  first login instead (see `lib/auth/ensure-org.ts`) since there's no
  session yet to satisfy RLS at signup time.
- `/dashboard` ← `bidpulse_dashboard` — **done**, reads real `bids` /
  `matched_opportunities` / `compliance_items` rows for the signed-in
  user's org
- `components/ui/AppShell.tsx` — done
- `components/ui/LifecycleStepper.tsx` — done

### Phase 2 — Stage 1: Discovery & Intake
- `/intake` ← `rfp_intake_attestation` — **done, see worked example**
- `/opportunities/[id]` ← `matched_opportunities_detail` — **done**. That
  mockup is actually a list/browse screen, not a single-record detail view,
  so the route keeps its card's visual language (fit-score ring, agency
  chip, rationale) applied to one `matched_opportunities` row. "Start
  Intake" creates a real `bids` row and links it back via `bid_id` +
  `status = 'converted_to_bid'`.

### Phase 3 — Stage 2: Compliance Review — **done**
- `/compliance` ← `compliance_review` — bid picker (no `?bid=`) or a
  per-clause checklist with inline status editing + a real status
  breakdown (the mockup's unbacked "Security Certifications" /
  "Technical Thresholds" cards were dropped)
- `/compliance/matrix` ← `compliance_matrix_desktop` — stat cards, status
  filter chips, Owner column (real `reviewed_by` → `team_members` join),
  CSV export
- `/compliance/[itemId]` ← `compliance_check_detail_desktop` / `_mobile` —
  single-clause status + notes review, replacing the mockup's AI
  auto-findings (no backing table) with a plain decision form
- All three status changes go through `lib/compliance/record-status-change.ts`,
  which also writes an `audit_log` row per README section 2 step 7

### Phase 4 — Stage 3: Assembly & Drafting — **done**
- `/assembly` ← `assembly_drafting_desktop` / `_mobile` — bid picker (no
  `?bid=`), then manages real `deliverables` rows (add / sign off) for that
  bid. The mockup's AI document editor + "AI Assistant" drafting sidebar
  has no document store or generation backend anywhere in schema.sql, so
  it's dropped in favor of the real table.
- `/fit-score/[bidId]` ← `fit_analysis_detail` — reads `bids.fit_score` +
  `bids.scoring_breakdown` (jsonb; shape defined in `page.tsx` as
  `ScoringBreakdown`) and includes an editor since nothing else in the app
  writes to that column yet
- Deliverable sign-off writes an `audit_log` row (compliance/legal action
  per README section 2 step 7); fit-score edits don't (routine data entry,
  not a compliance action)

### Phase 5 — Stage 4: Quality & Admin Audit — **done**
- `/admin` ← `admin_operations_dashboard` — real metrics (active audits,
  pending sign-off, open pipeline value, avg cycle time), a real Stage
  Distribution chart (bid_stage counts), and a Needs Attention list (bids
  with failed compliance items). Dropped the mockup's fabricated "System
  Alerts" (margin-threshold detection — no pricing-margin data exists) and
  "Team Capacity" (bids has no assignee column, so per-person workload
  can't be attributed to anyone real).
- `/admin/review` ← `admin_review_audit` — reuses `ComplianceChecklist`
  from the compliance pages as the "Audit Evidence Logs" table, and reuses
  `audit_log` (event_type `'note'`) as a real Reviewer Notes thread
  instead of a new notes table
- `/admin/sign-off` ← `admin_audit_sign_off_desktop` / `_mobile` — reuses
  `DeliverablesPanel` from `/assembly`; the mockup's 3 manual "Audit
  Checkpoints" checkboxes are replaced with 2 gates computed from real
  data (compliance passed/waived, deliverables signed off) that must both
  be true before "Authorize for Client Review" advances `bids.stage` to
  `client_review`
- `/admin/audit-log` ← `audit_log_export_desktop` / `_mobile` — **done**
  (pre-existing worked example, gated by `can_export_audit_log`)
- `/deliverables/sign-off` ← `deliverables_sign_off` — the contractor-side
  counterpart to `/admin/sign-off` (gated by `can_sign_off`, not
  `can_view_admin`, so `contractor_owner` can reach it); "Approve Package"
  is gated on every real deliverable being individually signed off
- All four gate by the specific `role_permissions` column each action
  actually needs (`can_view_admin` for `/admin/*` page views per README
  section 5, `can_sign_off` for the two sign-off actions) rather than one
  blanket check

### Phase 6 — Stage 5: Client Review — **done**
- `/review/portal` ← `client_review_portal_desktop` / `_mobile` — the
  fast-approve overview: deliverable cards with a one-click Approve, a
  general (non-deliverable) comment feed, and the "Sign-Off & Authorize"
  gate that advances `bids.stage` to `submission` once every deliverable
  is approved
- `/review/feedback` ← `client_review_feedback` / `_desktop` — the
  companion deep-dive: pick one deliverable, see/post its own threaded
  `client_reviews` history (comments and Approve/Request Changes decisions
  interleaved by time), same completion gate at the bottom
- Both read/write the real `client_reviews` table — `decision` is
  `approved | changes_requested` per the schema comment, `deliverable_id`
  null means a general comment; "Pages" / "Total Value" fields from the
  mockups were dropped since no such columns exist
- `client_reviews` had RLS enabled but zero policies (same gap
  `organizations`/`team_members`/`matched_opportunities` had) — added
  insert + select policies scoped through `bids`, same pattern as
  `compliance_items`/`deliverables`

### Phase 7 — Stage 6: Submission Execution — **done**
- `/submit` ← `submission_execution` / `_desktop` — mirrors `/intake`'s
  attestation pattern (checkbox + irrevocable action). The mockup's "Total
  Payload (14.2 MB)" has no backing column, so the summary shows a real
  deliverable count instead. The SHA-256 "Cryptographic Seal" is a real
  hash (`lib/audit/export`'s `calculateSha256`) over the actual
  bid/deliverable/confirmation data, stored in the `audit_log`
  `'submission'` event since `submissions` has no checksum column. Inserts
  the `submissions` row, sets `bids.status = 'submitted'`, and redirects to
  the receipt — `submissions.bid_id` is unique, so re-visiting `/submit`
  for an already-submitted bid redirects straight there instead of
  double-submitting.
- `/submit/receipt` ← `submission_receipt_desktop` / `_mobile` — reads the
  checksum back from that `audit_log` event; "Transmission Log" is the
  bid's real audit trail (not 3 fabricated entries like "Encryption
  Verified" — no such system exists); "Download Full Audit Log" reuses the
  same `lib/audit/export` helpers as `/admin/audit-log`, scoped to this
  bid; "View Archive" (no archive concept in schema.sql) became "View Bid"
- `submissions` had RLS enabled but zero policies — same recurring gap as
  `organizations`/`team_members`/`matched_opportunities`/`client_reviews`
  before it. Added insert + select policies scoped through `bids`.

### Phase 8 — Cross-cutting platform pages — **done**
- `/settings/security` ← `security_settings_desktop` / `_mobile` — MFA
  enrollment and the active-sessions device list aren't wired to anything
  real (no MFA factors or session table), so those are dropped in favor of
  two things that genuinely work through supabase-js: change password and
  "sign out of all other sessions". API Management is real — it manages
  the actual `api_keys` table (generate shows the secret once, hashed via
  the same `calculateSha256` used for audit exports; revoke sets
  `revoked_at`), gated by `can_manage_team`.
- `/settings/team` ← `team_management_desktop`, `team_directory_mobile`,
  `member_access_detail_mobile` — real roster + inline role editing. There's
  no invite-email flow (no invite-token table, and the browser can't call
  the Admin API to create a user for someone else), so "Create Invite"
  became "Add Team Member": paste in the Auth User UID of someone already
  created via the Supabase dashboard (README step 12, minus the Table
  Editor part) and set their role.
- `/settings/roles` ← `role_permissions_desktop` — edits the 5 real
  `role_permissions` booleans (described in terms of what they actually
  gate in this app), not the ~8 fabricated per-module toggles the mockup
  shows. Gated by `can_view_admin`.
- `/notifications` ← `notification_center_desktop`, `notifications_mobile`
  — reads real `notifications` rows; nothing in the app writes them yet
  (no trigger/job), so a fresh install honestly shows empty rather than
  fake sample items.
- `/analytics` ← `analytics_insights_desktop` / `_mobile` — real KPIs
  (pipeline value, win rate, compliance score, stage distribution); dropped
  the mockup's fabricated period-over-period deltas ("+12.4% vs Q2") since
  there's no historical snapshot to compare against.
- `/market-intelligence` ← `market_intelligence_desktop` — the full
  filterable/sortable browse view of `matched_opportunities` (the
  dashboard only shows a top-4 preview); cards link into the existing
  `/opportunities/[id]`. Value-range filter and deadline/value sort are
  dropped — no such columns.
- `/docs/api` ← `api_documentation_desktop` / `_mobile`,
  `api_documentation_rate_limiting_*` — this app has no public REST route
  handlers, so the page documents the real schema.sql entities instead of
  the mockup's generic model, and labels the curl example as the intended
  future shape rather than something callable today. Rate limits shown are
  real, read from `api_keys.rate_limit_per_min`.
- New RLS: `role_permissions` had no RLS at all (open to any authenticated
  user to rewrite); now readable by anyone signed in, writable only by
  `is_platform_admin()`. `team_members` gained update (role changes) and a
  second insert policy (adding an existing Auth user), both gated by the
  new `can_manage_team()` helper, which also gates `api_keys` writes.
  `notifications` gained an update policy so recipients can mark their own
  read.

All 8 phases / full 6-stage lifecycle are now built.

Reference `bidpulse_fulfillment_flow/code.html` any time the overall
stage-to-stage flow is unclear — it reads as a flow-diagram overview of
how the 6 stages connect.

---

## 4. Notes carried over from the original PRD

- **No automated scraping.** `matched_opportunities` is populated from
  manually-logged solicitations (by staff or contractors), scored by
  whatever matching logic you plug in — not by scraping external sites.
- **No unlinked calculators.** Every score (fit_score, match_score) must
  bind to a real `bids` row — don't build a standalone calculator screen.
- **No upsell banners.** Keep the UI free of promotional clutter per the
  mockups' minimal, "industrial-grade" aesthetic in DESIGN.md.

## 5. Suggested build order for auth/permissions

`role_permissions` table already seeds four roles
(`platform_admin`, `contractor_owner`, `contractor_member`,
`client_reviewer`). Gate `/admin/*` routes server-side by checking the
current user's `team_members.role` against `role_permissions.can_view_admin`
before rendering — don't rely on hiding nav links alone.
