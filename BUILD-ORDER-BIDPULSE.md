# BidPulse — Build Order

Read `PROJECT-STATUS.md` first for full context, evidence, and history.
This file tracks what's actually queued to work on next.

## 🚀 Pre-launch checklist — do these before client #1
1. ~~Dev/prod Supabase split~~ — **done and verified 2026-09-02.** New
   production project confirmed showing a genuinely empty admin inbox on
   the live site, via a real incognito-window test after a fresh
   redeploy. Full troubleshooting story (env var type/naming issues, the
   stale-deployment build-time gotcha, Auth URL config, OTP-signup
   behavior) is in `PROJECT-STATUS.md`'s Confirmed Working section.
2. ~~Client dashboard missing Preview/Download entirely~~ — **already
   done, older than this checklist realized. Confirmed 2026-09-03**:
   `app/dashboard/DeliverablesSection.tsx` mounts `PacketButtons` with
   `viewerRole="client"`, and `PacketButtons.tsx`'s auto-advance
   (`maybeAdvanceOnPreview`) is gated to `viewerRole === "client"` only —
   an admin's QA preview never reaches it. This was actually built and
   verified end-to-end in commit `386e1df` ("Pipeline redesign:
   auto-trigger client_review, remove confirmed_submitted"), which
   predates this checklist. See item #1 below for the full original
   write-up (kept as-is since the underlying description of *why* it
   mattered is still accurate) — just no longer an open item.
3. **"Request info from client": wrong voice, duplicated pre-fill text**
   — **confirmed still open, 2026-09-03.** Checked
   `app/admin/inbox/[id]/page.tsx`: still passes
   `submission.fit_explanation` straight into `RequestInfoForm`'s
   `prefillText` prop with zero transformation — still raw, third-person,
   admin-facing text. (Didn't re-check the "duplicated twice" half of the
   original report — that needs a real submission with fit-check output
   to reproduce against, not just a code read.) See item #2 below. Real
   remaining work.
4. ~~File upload broken on the new production project~~ — **done and
   verified, 2026-09-03** (was open when this checklist was written).
   Commit `5a0d963` ("Fix new-project file upload, remove
   submitted-report button, add admin delete") confirms the leading
   theory in item #3 below was exactly right: the `rfp-documents` bucket
   itself, and the submission-scoped storage RLS policies, were both
   created out-of-band before tracked migrations existed and were never
   actually migrated. Two new migrations fixed both; the commit message
   documents a real end-to-end verification (disposable test client
   uploaded a real PDF through the real intake UI, confirmed via the UI,
   a direct `submission_documents` read, and a direct Storage listing).
5. **Certifications: make document upload optional at logging time** —
   **confirmed still open, 2026-09-03.** Checked
   `app/dashboard/profile/CertificationsSection.tsx:63` — the exact
   save-blocking error text from the original report ("Attach the
   certificate document — that's what our team reviews to verify it.")
   is still there unchanged. See item #4 below. Real remaining work.
6. **Inbound bid email pipeline** — unchanged, still blocked on Mike's
   IONOS/Gmail/Apps Script setup, not a code item. See item #5 below.
   Lower urgency; can wait until after launch if needed.
7. ~~"Message admin" UI~~ — **done and verified, 2026-09-03** (was "sent
   to Claude Code, no results yet" when this checklist was written).
   Commit `1ab6d84` ("Add two-way 'Message admin' thread on a
   submission") ships `components/ui/SubmissionMessages.tsx` and
   migration `20260903013813_add_admin_message_thread_support.sql`. The
   commit message documents the exact verification this checklist asked
   for: a real disposable client/admin round-trip confirmed via direct DB
   reads, the anonymous contact-form path confirmed unmodified, and an
   explicit RLS negative test (a second client can't read the first
   client's messages).
8. **Final pass on `PROJECT-STATUS.md`'s Known Issues** — not evaluated
   this session; confirm nothing still genuinely open has been missed
   before launch.

**Also already done, found during today's check, not on this checklist's
radar at all:** the "remove `ReportSubmittedButton.tsx`" decision (see the
"New decision" note below) and the admin single-record delete action (see
item #9 below) were both shipped in commit `5a0d963` alongside the file-
upload fix — `DeleteSubmissionButton.tsx` exists, `ReportSubmittedButton`
and every reference to `client_reported_submitted_at` are gone. Commit
message documents real verification for both (a disposable submission
with a real child row in every cascading table, confirmed full cascade +
surviving audit_log entry; confirmed zero rows ever used
`client_reported_submitted_at` before removing references).

## Status as of 2026-09-02
The watermark, the 5-stage pipeline redesign (auto-triggers +
`confirmed_submitted` removal), the Board/Kanban inbox, the intake
confirmation page nav fix, the Gallery trade-card mismatch, the
document-upload timeout fix, and — as of today — **the dev/prod Supabase
split** are all closed with real evidence — see `PROJECT-STATUS.md`'s
"Confirmed Working" and "Known Issues / Recently Fixed" sections for what
was tested and how.

**New decision, this session:** now that `confirmed_submitted` is gone,
the client-facing "I've submitted this" button (`ReportSubmittedButton.tsx`)
is being **removed**, not kept — see item #7 below. Reasoning: a signal
that's rarely used is worse than no signal, since it invites false
conclusions, and keeping both a formal button *and* the informal
`admin_notes` fallback the original brief proposed means two overlapping
ways to track the same thing. One source of truth is simpler.
(**Update 2026-09-03:** done — see the note above the checklist.)

## Active + deferred

### 1. Client dashboard missing Preview/Download entirely — breaks pipeline automation too
**Status: done, see checklist item #2 above.** Original write-up kept
below for context on why this mattered.

Real finding 2026-09-02, confirmed with a real submission that has actual
deliverables prepared — the client dashboard's "Your deliverables"
section shows only static text ("Being prepared.") with **no Preview or
Download action at all**, regardless of whether content is ready.
`PacketButtons.tsx`'s own comment says it's meant to be mounted on "both
the admin submission detail page and the client dashboard" — it appears
only the admin side actually has it.

**This is more serious than a missing convenience feature — it breaks
two things:**
1. **Core paid functionality.** Clients can't preview or download their
   own deliverables at all, on any submission, regardless of stage or
   readiness.
2. **The pipeline automation shipped in the recent redesign.** The
   `deliverables_ready` → `client_review` auto-trigger was specifically
   built to fire when a real client clicks Preview on their own
   dashboard. With no Preview button there, that automation **can never
   fire from an actual client action** — the only path to `client_review`
   right now is the admin's manual override, which defeats the purpose of
   having built the automation. (This also explains how the reported
   submission reached "Client review" despite deliverables still being
   prepared — it was very likely advanced manually.)

**Needs:** mount `PacketButtons.tsx` (or equivalent) on the client
dashboard's submission view, matching its own stated intent. Confirm the
component correctly distinguishes a client's own preview click from an
admin's QA preview click (per the pipeline redesign's requirement — the
auto-trigger must only fire on a genuine client action), since this may
already be partially built into the component and just not mounted, or
may need the role-detection logic added at the same time as mounting it.

**Verification required:** real client login, real submission with
deliverables prepared, confirm Preview and Download both work and
produce correct content. Confirm clicking Preview as the client actually
advances a submission sitting in `deliverables_ready` to `client_review`
— the real test the pipeline automation was supposed to pass but
couldn't, since the button didn't exist. Confirm admin-side preview
(QA/testing) does *not* trigger this same auto-advance.

### 2. "Request info from client": wrong voice, duplicated pre-fill text
**Status: still open, see checklist item #3 above.**

Real finding 2026-09-02, real screenshot evidence — the "Request info
from client" text box pre-fills directly from the Fit Check panel's raw
text, which is written in third person for admin's own reading
("Palmetto Grounds & Facility Care, LLC has NAICS codes on file... so the
team can confirm and use them"). Two real problems, same root area:
- **Wrong voice entirely.** Fit Check text talks *about* the client to
  the admin — it was never written to be read *by* the client. Sending it
  as-is would read as confusing or impersonal ("who's 'the team'? is this
  about me?"). This is a genuine content bug, not just a display issue —
  the pre-fill needs to either not draw from Fit Check verbatim, or
  transform it into direct, second-person, plain-language client copy
  ("You don't have your NAICS codes on file yet — could you add them to
  your Company Profile?") matching the 8th-grade-reading-level standard
  already used elsewhere in client-facing copy.
- **The exact same paragraph appears twice, concatenated**, in the
  screenshot evidence. Likely a pre-fill effect firing twice (e.g. a
  React effect re-running and appending instead of replacing, or the
  fill happening on every render). Needs a real fix, not just a
  workaround — find where the pre-fill is set and make it idempotent.

**Why this wasn't caught earlier:** the feature's original verification
(real Mailinator inbox check) only confirmed the *subject line* was
correct — it didn't inspect real body content once actual Fit Check text
got pre-filled in. Worth keeping in mind for future verification: correct
delivery mechanics don't guarantee correct content.

**Also flagged in the same review, smaller and separate:** the "Strong
fit" / "Moderate fit" badge at the top of the Fit Check panel is sized
too small relative to the surrounding text — a quick visual fix, bundle
with the above since both touch the same Fit Check component.

**Verification required:** real screenshot of the "Request info from
client" box after Fit Check has generated real content, confirming
single (not doubled) text, written in second person addressed to the
client, not third person about them. Real screenshot confirming the
fit-badge is appropriately sized relative to surrounding text.

### 3. File upload broken on new production project — "Failed to fetch"
**Status: done, see checklist item #4 above.** Original write-up kept
below for context.

Real finding 2026-09-02, during the first genuine end-to-end intake test
against the *new* production Supabase project — "Your bid file" upload
step fails with **"Failed to fetch"**, "No files attached yet." Real
screenshot evidence. This is the first time anyone's tried a file upload
against the new project since the dev/prod split, and there's a specific
reason to suspect it's not a fluke:

**Leading theory (confirmed correct):** `schema.sql` includes a line
creating the `rfp-documents` storage bucket (`insert into
storage.buckets...`), but that line predates the tracked-migrations
discipline adopted partway through this project's history — bucket
creation itself was never captured as its own migration file. Replaying
all tracked migrations against the new project (done during the split)
correctly recreated every table and RLS policy, but silently skipped
creating the actual storage bucket and the submission-scoped storage RLS
policies, since neither was ever a tracked migration to begin with.

**Verification required:** ~~a real file upload succeeds against the new
production project~~ — done; see commit `5a0d963`'s message for the real
end-to-end evidence (disposable test client, real PDF, confirmed in the
UI, a direct `submission_documents` read, and a direct Storage listing).

### 4. Certifications: make document upload optional at logging time
**Status: still open, see checklist item #5 above.**

Real ask 2026-09-02: the Certifications section on Company Profile
currently blocks *saving a certification claim at all* without a
document attached ("Attach the certificate document — that's what our
team reviews to verify it."). Real friction — a client should be able to
log "I hold JSEB" without needing the actual certificate file in hand
that exact moment.

**Decided approach — a middle path, not full removal:** the core
protection stays intact. Unverified certifications must never be treated
as confirmed fact anywhere generated paperwork (fit-check, compliance
matrix, capability statement) — that's the whole reason `verified` exists
as a gate on `client_certifications`, and it stays exactly as strict as
it is today. What changes is *when* a document is required:
- Saving a certification entry (type, number, expiration) should work
  with **no document required** — it just sits as "Not yet reviewed"
  indefinitely if nothing's ever attached.
- A document should only become necessary at the point someone (client or
  admin) actually wants it marked **Verified** — i.e., the existing admin
  verification toggle should require `file_url` to be non-null before it
  can be flipped to `verified = true`, rather than the *entry* itself
  requiring a file to exist.

**Needs:**
- Remove the current save-blocking validation on the certification form
  (the red "Attach the certificate document" error) — file upload becomes
  genuinely optional on this form.
- Add a guard on the admin-side verification action instead: block
  marking a certification `verified = true` if `file_url` is still null,
  with a clear message (something like "Can't verify without a
  certificate document on file").
- Confirm the fit-check and compliance-matrix logic that reads
  `client_certifications` already correctly ignores unverified rows (it
  should, per existing design) — this change doesn't touch that logic,
  but worth a real check that nothing downstream assumes "certification
  exists" means "certification is real."

**Verification required:** save a certification with no document
attached, confirm it saves successfully and shows "Not yet reviewed."
Confirm the admin verification toggle is blocked (with a clear message)
when no document is attached. Attach a document afterward, confirm the
toggle becomes available. Confirm an unverified certification (with or
without a document) still doesn't appear as a confirmed fact in a real
fit-check or compliance-matrix output — the one thing that must not
regress.

### 5. Inbound bid email pipeline — built, blocked on Mike's email setup
Code is done and verified (`app/api/inbound-bid-email/route.ts`, a second
producer into `matched_opportunities` alongside the existing scraper) —
real extraction calls and direct DB read-backs confirmed it works.
`INBOUND_BID_EMAIL_SECRET` has already been rotated/replaced in the
script per Mike. **Not yet live in production** — still needs Mike's
IONOS/Gmail forwarding rule, label/filter, and Apps Script trigger set up
per `scripts/README.md`, plus the real secret added to Vercel's
**production** environment specifically (not just wherever it currently
lives). Until that's done, no real emails reach the route.

### 6. "Message admin" UI tied to a specific bid — active brief
**Status: done, see checklist item #7 above.** Original write-up kept
below for context.

**Decided approach:** build as a genuine two-way message thread on a
submission, kept separate from the existing "Request info from client"
feature (which stays as-is for formal one-way requests with a checklist
item attached) rather than extending `support_messages` to serve both
purposes.

**Schema:** one nullable column via a real tracked migration —
`support_messages.sent_by_admin_id uuid references team_members(id)`.
Direction inferred from which actor field is set (`client_id` set +
`sent_by_admin_id` null = client message; `sent_by_admin_id` set = admin
message), no new enum needed.

**RLS:** clients need a new SELECT policy scoped to their own
submission's messages (none currently exists), a tightened INSERT policy
scoped to their own `submission_id`/`client_id` (current `with check
(true)` is too permissive for this use case — must not break the existing
anonymous contact-form path), and admins need an explicit INSERT policy
tied to `sent_by_admin_id` (currently only SELECT/UPDATE exist for
admins on this table).

**UI:** new `SubmissionMessages.tsx` thread component, chronological,
visually distinguishing admin vs. client sender, mounted on both the
admin submission detail page (alongside, not replacing, "Request info
from client") and the client dashboard's submission view. No real-time
subscription for v1 — refresh-on-load is fine.

**Decision made:** email notification via `sendEmail()` on admin reply
only (not client→admin, since admin already has the daily digest and
checks the inbox regularly).

**Verification required:** ~~real DB-backed test~~ — done; see commit
`1ab6d84`'s message for the full evidence (client sends, admin sees and
replies, client sees the reply, each confirmed via direct query; the
anonymous contact-form path confirmed unmodified; the RLS negative test —
a second client cannot read the first client's messages — confirmed
explicitly).

### 7. Remove "I've submitted this" client-facing button — decided
**Status: done, see the note above the checklist.** Original write-up
kept below for context.

**Decision made 2026-09-02:** remove `ReportSubmittedButton.tsx` and the
`client_reported_submitted_at` field/usage entirely, rather than keep it
now that `confirmed_submitted` no longer exists as a pipeline stage. If a
"client told us they submitted" signal is ever wanted later, handle it as
an informal `admin_notes` entry when it happens to come up in
conversation, not a formal tracked feature.
**Needs:** remove the component, remove its mount point(s) from the
client dashboard, remove/deprecate `client_reported_submitted_at` (real
tracked migration if actually dropping the column, or just stop
referencing it if a cleaner rollback path is preferred — Claude Code's
call on which is less risky given current usage).
**Verification required:** ~~confirm the button no longer renders
anywhere, confirm nothing else in the app still reads
`client_reported_submitted_at`~~ — done; commit `5a0d963` removed the
component and every reference (column itself kept on `submissions` per
Mike's call to hold off on that specific drop), and confirmed zero rows
ever used the field before removing references.

### 8. Law enforcement/detention agency-type integration check
`TRADE_SPECIFIC_CERTIFICATIONS` already covers background-check/
bloodborne-pathogen requirements for these facility types and is
confirmed working via keyword detection. **Checked 2026-09-03: still not
integrated** — `lib/agency-type.ts` has no `detention` or
`law enforcement` keyword matching yet, alongside its existing airport/
school/transit/`va` detection. Quick check, not a full build — do this
the next time `agency-type.ts` is touched for any other reason rather
than as a standalone brief.

### 9. Admin delete action for submissions/matched opportunities
**Status: done, see the note above the checklist.** Original write-up
kept below for context.

Real ask 2026-09-02: with production now live and genuinely empty, direct
testing against it (e.g. the inbound bid email pipeline) will keep
creating real rows that need cleaning up afterward — currently only
possible via the Supabase dashboard's Table Editor by hand.

**Scoped deliberately narrow, matching the project's existing caution
around deletes:** a single-record "Delete" action, admin-only, on the
submission detail page and the matched-opportunities review screen —
**not** a bulk "clean up all test data" tool. Bulk deletion based on
`is_test`/flags specifically isn't safe here, since that flag has already
been found wrong on at least one real-looking row (Dar Mano Consulting) —
a targeted, one-at-a-time action the admin explicitly confirms is the
same safety pattern already used for the earlier data-mapping backfill.

**Verification required:** ~~delete a real test submission with related
child rows~~ — done; commit `5a0d963`'s message confirms a disposable
submission with a real child row in every cascading table was deleted,
full cascade confirmed with no orphaned rows, a real `audit_log` entry
confirmed to survive (via `ON DELETE SET NULL`, not `CASCADE`, on
`audit_log.submission_id` specifically so the record survives), and the
client account itself confirmed to stay intact afterward.

### 10. Retainer package usage tracking
Track how many bids a retainer client has used this month against the
"up to 2/month" promise. No schema yet — needs a usage-count field or
derived query against `submissions`/`packages`, plus a decision on how
resets are timed (calendar month vs. rolling 30 days). Explicitly
deferred until there's a real retainer client to test against.

## Not building yet (still explicitly deferred)
- Stripe checkout — manual invoicing continues
- Automated recurring bid matching/shortlist delivery — admin-curated
  matching (assign flow) stays as-is
- Any further logo/branding work beyond what's already shipped — paused
  pending the BidPulse trademark question (see `PROJECT-STATUS.md`'s
  Business/Naming Note)
