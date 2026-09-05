# BidPulse — Admin Review Rubric

Purpose: replace freeform "read the whole document carefully" review with
a structured, consistent checklist per deliverable type. Same review
quality, less cognitive load, faster and more consistent across
documents.

Print this or keep it open in a side window while reviewing. Check off
each item; don't move to the next deliverable until every box is either
checked or has a written reason it's being overridden.

---

## Every deliverable, every time (do this first, before the type-specific list)

- [ ] No bracketed placeholder (`[ADD: ...]`, `[Client name]`, etc.)
      remains anywhere in the final version — every one has either been
      filled with real client-provided data or deliberately left as a
      clearly-marked gap the client still needs to supply.
- [ ] Every fact stated (certification number, insurance amount, years in
      business, NAICS code) traces back to something the client actually
      entered — not something that reads as plausible but wasn't
      explicitly provided.
- [ ] No certification is referenced as held/valid unless it shows
      "Document Reviewed" (verified) status on the Company Profile.
- [ ] Agency name, solicitation number, and due date match the actual
      submission record exactly (copy-paste error check).
- [ ] Plain-language check: would an 8th-grade reader understand every
      sentence? No unexplained jargon.

---

## Capability Statement

- [ ] Company overview paragraph reflects the client's actual
      differentiators field, not generic filler.
- [ ] Trade/service description matches the client's stated NAICS
      codes and trade keywords — not a mismatched or overly broad claim.
- [ ] Years in business, license number, and insurance figures match the
      Company Profile exactly.
- [ ] No implied claim of past performance/project history beyond what
      the client actually entered in Differentiators or past-performance
      fields.

## Compliance Matrix

- [ ] Every `ALWAYS_MANDATORY` item from `requirements-reference.ts`
      appears on the matrix — nothing silently dropped.
- [ ] Agency-type-specific items are present when they should be
      (airport → SIDA badging; school → background checks; transit →
      DBE; law enforcement/detention → background check + bloodborne
      pathogen cert) and absent when they shouldn't be.
- [ ] Conditional items (bid bond, socioeconomic certs, quality
      accreditations) are marked mandatory only if the actual
      solicitation text supports it — not assumed by default.
- [ ] Every row says "NEEDS VERIFICATION" or similar, not a confirmed
      claim the client actually holds/has completed the item.
- [ ] If the row-format is pipe-delimited (for the real-table rendering
      in the generated PDF), confirm it actually renders as a table in a
      real preview, not broken/malformed text.

## Technical Narrative

- [ ] Proposed approach is plausible for the actual trade and scope —
      not a generic or mismatched methodology copy-pasted from a
      different trade type.
- [ ] No specific equipment brand, methodology name, or certification is
      invented — bracketed placeholders used correctly where the client
      hasn't specified real details.
- [ ] Staffing/approach described is consistent with what the client
      described in their own scope/differentiators fields.

---

## Before marking "Deliverables Ready"

- [ ] All three deliverables above have passed their own checklist.
- [ ] A real Preview of the combined packet has been opened and skimmed
      end-to-end at least once — not just each deliverable reviewed in
      isolation.
- [ ] Any compliance checklist items still outstanding for this client
      have been either resolved or explicitly flagged to the client via
      "Request info from client" before moving forward.

---

*This rubric is a living document — if a real mistake gets through
despite checking every box, that's a sign this rubric needs a new line
item, not that the process failed. Update it the same day it happens.*
