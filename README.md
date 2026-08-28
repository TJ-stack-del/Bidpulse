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

**This is a checklist, not something you run.** Nothing in this section
is a command. Each line means "a page at this URL path still needs to be
created, converted from this mockup folder" — until you (or an AI
assistant) actually create that file, it doesn't exist yet.

Right now, six pages exist: `/intake`, `/admin/audit-log`, `/login`,
`/signup`, `/dashboard`, and `/opportunities` — Phases 1 and 2 are fully
done. Phases 3 through 8 are still just mockups sitting in
`mockups-reference/`, not yet built.

**To build one:** ask an AI assistant (here, or the Claude Code
extension in your Codespace) something like *"Convert
mockups-reference/bidpulse_dashboard/code.html into
app/(app)/dashboard/page.tsx, following the same pattern as
app/(app)/intake/page.tsx."* That produces new files, which you then add
to your project the same way you added the audit log page: copy the new
folder in, `git add -A && git commit -m "..." && git push`.

### Phase 1 — Platform shell + Auth (do first, everything depends on it)
- `middleware.ts` — **done**, keeps Supabase sessions refreshed on every request
- `/login` — **done**
- `/signup` — **done**; creates the auth user, then inserts the matching
  `organizations` + `team_members` rows (role: `contractor_owner`)
- `/dashboard` ← `bidpulse_dashboard` — **done**
- `components/ui/AppShell.tsx` — **done**
- `components/ui/LifecycleStepper.tsx` — **done**

### Phase 2 — Stage 1: Discovery & Intake
- `/intake` ← `rfp_intake_attestation` — **done, see worked example**
- `/opportunities` ← `matched_opportunities_detail` — **done** (built as a
  list page, not a `[id]` detail route — the mockup was actually a list
  of opportunity cards despite the folder name). Includes Shortlist,
  Dismiss, and Start Intake (creates a real `bids` row and redirects to
  `/intake?bid=<id>`)

### Phase 3 — Stage 2: Compliance Review
- `/compliance` ← `compliance_review` — **not built yet**
- `/compliance/matrix` ← `compliance_matrix_desktop` — **not built yet**
- `/compliance/[itemId]` ← `compliance_check_detail_desktop` / `_mobile` — **not built yet**

### Phase 4 — Stage 3: Assembly & Drafting
- `/assembly` ← `assembly_drafting_desktop` / `_mobile` — **not built yet**
- `/fit-score/[bidId]` ← `fit_analysis_detail` — **not built yet**

### Phase 5 — Stage 4: Quality & Admin Audit
- `/admin` ← `admin_operations_dashboard` — **not built yet**
- `/admin/review` ← `admin_review_audit` — **not built yet**
- `/admin/sign-off` ← `admin_audit_sign_off_desktop` / `_mobile` — **not built yet**
- `/admin/audit-log` ← `audit_log_export_desktop` / `_mobile` — **done, see worked example**
- `/deliverables/sign-off` ← `deliverables_sign_off` — **not built yet**

### Phase 6 — Stage 5: Client Review
- `/review/portal` ← `client_review_portal_desktop` / `_mobile` — **not built yet**
- `/review/feedback` ← `client_review_feedback` / `_desktop` — **not built yet**

### Phase 7 — Stage 6: Submission Execution
- `/submit` ← `submission_execution` / `_desktop` — **not built yet**
- `/submit/receipt` ← `submission_receipt_desktop` / `_mobile` — **not built yet**

### Phase 8 — Cross-cutting platform pages (build alongside whichever stage needs them)
- `/settings/security` ← `security_settings_desktop` / `_mobile` — **not built yet**
- `/settings/team` ← `team_management_desktop`, `team_directory_mobile`, `member_access_detail_mobile` — **not built yet**
- `/settings/roles` ← `role_permissions_desktop` — **not built yet**
- `/notifications` ← `notification_center_desktop`, `notifications_mobile` — **not built yet**
- `/analytics` ← `analytics_insights_desktop` / `_mobile` — **not built yet**
- `/market-intelligence` ← `market_intelligence_desktop` — **not built yet**
- `/docs/api` ← `api_documentation_desktop` / `_mobile`, `api_documentation_rate_limiting_*` — **not built yet**

Reference `bidpulse_fulfillment_flow/code.html` any time the overall
stage-to-stage flow is unclear — it reads as a flow-diagram overview of
how the 6 stages connect.

---

## 4. Notes carried over from the original PRD

- **Automated scraping — overridden.** The original PRD said no
  scraping; that's been superseded. `matched_opportunities` will also be
  populated by scrapers targeting state/local procurement portals
  (starting with Duval County Public Schools), in addition to any
  manually-logged solicitations. **Before adding a scraper for any new
  portal:** confirm the actual URL where that portal posts solicitations
  (many districts use a third-party platform like DemandStar, Vendor
  Registry, or BidNet rather than their own site), check that platform's
  `robots.txt` and Terms of Service for restrictions on automated
  access, and only proceed once that's been checked for that specific
  site. Treat each new portal as its own decision, not a blanket
  allowance.
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
