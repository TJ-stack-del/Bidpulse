# Test fixtures

Synthetic company-profile documents for testing the extraction routes
(`app/api/extract-company-profile/route.ts`, and `extract-from-document`'s
shared `lib/document-parsing.ts` helper). None of these are real client
data — every company name, contact, and figure is fabricated for this
purpose.

## sunrise-janitorial-specimen.pdf

A real, Chromium-rendered PDF (via `page.pdf()`, not a bare text dump) —
tables, headings, real embedded fonts, so it exercises the parsing/
extraction pipeline against a genuinely PDF-shaped document rather than a
minimal one. Source markup is `sunrise-janitorial-specimen.html`; regenerate
with:

```js
const { chromium } = require("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file:///path/to/sunrise-janitorial-specimen.html");
await page.pdf({ path: "sunrise-janitorial-specimen.pdf", format: "Letter", printBackground: true });
```

Expected extraction:
- `companyName`: "Sunrise Janitorial Solutions, LLC"
- `contactName`: "Marcus T. Reyes"
- `businessPhone`: "(904) 555-0142"
- `businessAddress`: "1180 Riverplace Blvd, Suite 4, Jacksonville, FL 32207"
- `licenseNumber`: "LBT-2026-004821" — **and** `businessRegistrationNumber: null`
  (this document deliberately has no Sunbiz number — the real anti-fabrication
  check is that `licenseNumber` doesn't get confused with a registration
  number when only one of the two is present)
- `insuranceProvider`: "Meridian Specimen Mutual" (a carrier name), correctly
  distinct from `generalLiabilityCoverage`/`workersCompCoverage` (coverage text)
- `certifications`: one entry, `certType: "JSEB"`, `certificationNumber: "JSEB-22087"`, `expirationDate: "2027-01-15"`

## coastal-clean-company-profile.txt

The original mock fixture used to build/verify the extraction feature —
covers the multi-certification case (4 certs across different `cert_type`
values: `DBE/SDB`, `JSEB`, and two `Other` entries) and both a Sunbiz
number **and** a stated NAICS/GL/workers-comp/Commercial Auto set, with no
trade license number stated (so `licenseNumber` should come back `null`
here too). See `PROJECT-STATUS.md`'s document-extraction entries for the
full expected-output reference.
