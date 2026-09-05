#!/usr/bin/env node
/**
 * Regression checks for two real bugs found and fixed this week:
 *
 *   1. Ambiguous-FK admin-inbox query — a second foreign key from
 *      submissions to clients broke PostgREST's ability to infer which
 *      relationship to use in any query embedding clients(...).
 *   2. RLS silently blocking the client-side stage-advance write
 *      (deliverables_ready -> client_review on a real client Preview
 *      click) — an unrelated migration dropped the RLS policy this
 *      write depended on, with no error surfaced anywhere.
 *
 * IMPORTANT — both tests check the FIXED code paths, not the original
 * broken ones. The second FK (submissions.info_attested_by) is permanent
 * and correct by design; a *bare* `clients(...)` embed is expected to
 * fail forever now, which would make that a useless test (always red,
 * signal-free). Test 1 instead checks the disambiguated embed syntax
 * every real call site actually uses. Likewise, the real fix for bug 2
 * deliberately keeps the client's own RLS restrictive and moves the
 * write through the service role inside the route — so a raw
 * client-session UPDATE is *supposed* to keep failing forever now. Test
 * 2 instead mirrors what the fixed route actually does: the ownership/
 * stage check under the client's own session (the real authorization
 * boundary), then the write via service role.
 *
 * Run this after ANY migration touching `submissions` or its RLS
 * policies, before calling anything "verified." Takes under a minute.
 *
 * Place this file at scripts/regression-check.mjs in the repo.
 * Run with: node scripts/regression-check.mjs
 *
 * Requires these env vars set (use DEV values — this script writes
 * test data):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY
 *   TEST_CLIENT_EMAIL       (a real disposable test client's login)
 *   TEST_CLIENT_PASSWORD
 *
 * Requires an existing is_test=true submission sitting in
 * `deliverables_ready`, owned by the TEST_CLIENT_EMAIL account, for
 * Test 2 to run against. Test 1 needs no setup.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error(
    'Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY'
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey);

async function testDisambiguatedFKEmbed() {
  console.log('\n=== Test 1: disambiguated submissions -> clients embed ===');
  const attempts = 5;
  let failures = 0;

  for (let i = 1; i <= attempts; i++) {
    // Every real call site (admin inbox, generate-fit-check,
    // PacketButtons, etc.) uses this exact disambiguated form per
    // CLAUDE.md's rule -- this is what should keep working, not a bare
    // clients(...) embed, which is expected to stay ambiguous forever
    // now that info_attested_by is a permanent second FK.
    const { data, error } = await admin
      .from('submissions')
      .select('id, stage, agency, clients!submissions_client_id_fkey(company_name)')
      .limit(20);

    if (error) {
      failures++;
      console.error(`  Attempt ${i}: FAILED - ${error.message}`);
    } else {
      console.log(`  Attempt ${i}: OK - ${data.length} rows returned`);
    }
  }

  if (failures > 0) {
    console.error(
      `FAIL: ${failures}/${attempts} attempts errored. The disambiguated embed itself is broken -- check whether the submissions_client_id_fkey constraint was renamed or dropped in a recent migration. See CLAUDE.md for the full rule.`
    );
    return false;
  }
  console.log('PASS: all attempts succeeded consistently.');
  return true;
}

async function testClientPreviewAdvance() {
  console.log(
    '\n=== Test 2: client-side stage-advance write (deliverables_ready -> client_review) ==='
  );

  const { data: testSub, error: findErr } = await admin
    .from('submissions')
    .select('id, client_id, stage')
    .eq('stage', 'deliverables_ready')
    .eq('is_test', true)
    .limit(1)
    .maybeSingle();

  if (findErr || !testSub) {
    console.error(
      '  Could not find a disposable is_test=true submission in deliverables_ready. Create one manually before running this test.'
    );
    return false;
  }

  const testEmail = process.env.TEST_CLIENT_EMAIL;
  const testPassword = process.env.TEST_CLIENT_PASSWORD;
  if (!testEmail || !testPassword) {
    console.error('  Missing TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD env vars.');
    return false;
  }

  // Sign in with a throwaway client first just to get a real access
  // token, then build the actual query client with that token explicitly
  // set as the Authorization header. Plain signInWithPassword() on the
  // same client object doesn't reliably propagate the session to
  // subsequent .from() calls in a bare Node process (no browser storage
  // for supabase-js to persist/attach it from) -- confirmed directly: an
  // identical setup returned no error but a null row, the same silent-
  // failure shape this whole script exists to catch elsewhere.
  const signInClient = createClient(url, anonKey);
  const { data: signInData, error: signInErr } = await signInClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signInErr) {
    console.error(`  Sign-in failed: ${signInErr.message}`);
    return false;
  }

  const clientSideClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${signInData.session.access_token}` } },
  });

  // Step 1: the real authorization boundary -- confirm the client's own
  // RLS-scoped session can still read (and therefore prove ownership of)
  // this exact submission at this exact stage. If this fails, the real
  // route's own ownership/stage check would also fail, and that's a
  // genuine problem worth catching.
  const { data: verifiedSub, error: readErr } = await clientSideClient
    .from('submissions')
    .select('id, stage, client_id')
    .eq('id', testSub.id)
    .maybeSingle();

  if (readErr || !verifiedSub || verifiedSub.stage !== 'deliverables_ready') {
    console.error(
      `  FAIL: client's own session could not verify ownership/stage of the test submission (error: ${readErr?.message ?? 'none'}, row: ${JSON.stringify(verifiedSub)}).`
    );
    return false;
  }
  console.log('  Ownership/stage check under client session: OK');

  // Step 2: the actual write, via service role -- exactly what
  // app/api/advance-on-client-preview/route.ts does after its own
  // identical ownership/stage check above passes. A client's own
  // session is *supposed* to fail this exact UPDATE now (that's the fix,
  // not a bug) -- this test intentionally does not attempt that.
  const { data: updateData, error: updateErr } = await admin
    .from('submissions')
    .update({ stage: 'client_review' })
    .eq('id', testSub.id)
    .eq('stage', 'deliverables_ready')
    .select();

  if (updateErr) {
    console.error(`  FAIL: service-role UPDATE returned an explicit error: ${updateErr.message}`);
    return false;
  }
  if (!updateData || updateData.length === 0) {
    console.error(
      '  FAIL: service-role UPDATE affected zero rows -- something is filtering this write out even for the service role, which should never happen.'
    );
    return false;
  }

  console.log(`  PASS: write succeeded, stage now: ${updateData[0].stage}`);

  // Reset so this test is repeatable on the next run.
  await admin
    .from('submissions')
    .update({ stage: 'deliverables_ready' })
    .eq('id', testSub.id);

  return true;
}

async function main() {
  const results = [await testDisambiguatedFKEmbed(), await testClientPreviewAdvance()];

  const allPassed = results.every(Boolean);
  console.log(`\n=== ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'} ===`);
  process.exit(allPassed ? 0 : 1);
}

main();
