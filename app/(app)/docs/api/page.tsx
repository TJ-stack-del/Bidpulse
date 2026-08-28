import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";

// Converted from mockups-reference/api_documentation_desktop/code.html (and
// _mobile) plus api_documentation_rate_limiting_desktop/_mobile. This app
// has no public REST route handlers (no app/api/**) — it talks to
// Supabase directly from the browser — so the "Core Concepts" section
// below documents the real schema.sql entities instead of the mockup's
// generic "Opportunities / Submissions" model, and the curl example is
// explicitly labeled as the intended shape for a future public API rather
// than something you can call today. The rate-limit numbers ARE real: they
// read straight from this org's api_keys.rate_limit_per_min (managed on
// /settings/security).

export default async function ApiDocsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("team_members")
    .select("org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const { data: apiKeys } = member
    ? await supabase
        .from("api_keys")
        .select("key_prefix, rate_limit_per_min, revoked_at")
        .eq("org_id", member.org_id)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <AppShell activePath="/docs/api">
      <div className="max-w-3xl mt-6">
        <div className="flex items-center gap-2 mb-4 text-on-surface-variant text-label-md">
          <span>BidPulse API</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-on-surface">Introduction</span>
        </div>
        <h1 className="text-display-lg text-on-surface mb-4">Introduction to the BidPulse Data Model</h1>
        <p className="text-body-lg text-on-surface-variant mb-6">
          BidPulse doesn't expose public REST endpoints yet — everything below documents the real
          data model (schema.sql) so an integration can be planned against it. Keys generated on{" "}
          <Link href="/settings/security" className="text-secondary hover:underline">
            Security Settings
          </Link>{" "}
          are the credential this documentation assumes a future API would use.
        </p>

        <section className="mb-12" id="authentication">
          <h2 className="text-headline-md text-on-surface mb-4 pb-2 border-b border-outline-variant">
            Authentication
          </h2>
          <p className="text-body-md text-on-surface-variant mb-4">
            Requests would be authenticated with a bearer token generated from{" "}
            <Link href="/settings/security" className="text-secondary hover:underline">
              your API keys
            </Link>
            .
          </p>
          <div className="bg-primary-container rounded-lg p-4 mb-6 font-code text-code-sm text-on-primary">
            <pre>
              <code>Authorization: Bearer bp_live_xxxxxxxxxxxxxxxxxxxx</code>
            </pre>
          </div>
          <div className="bg-surface-container-low border-l-4 border-on-tertiary-container p-4 rounded-r-lg flex items-start gap-3">
            <span className="material-symbols-outlined text-on-tertiary-container mt-0.5">security</span>
            <p className="text-body-md text-on-surface-variant">
              Never expose API keys in client-side code or public repositories.
            </p>
          </div>
        </section>

        <section className="mb-12" id="core-concepts">
          <h2 className="text-headline-md text-on-surface mb-4 pb-2 border-b border-outline-variant">
            Core Concepts
          </h2>
          <p className="text-body-md text-on-surface-variant mb-6">
            The 6-stage RFP lifecycle (see <code className="font-code text-code-sm">bid_stage</code> in
            schema.sql) is modeled as one <code className="font-code text-code-sm">bids</code> row moving
            through <code className="font-code text-code-sm">intake → compliance_review →
            assembly_drafting → admin_audit → client_review → submission</code>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConceptCard title="bids" description="One RFP/proposal. Title, agency, stage, status, fit_score, scoring_breakdown." />
            <ConceptCard title="compliance_items" description="Per-clause requirements tracked against a bid — status, notes, reviewed_by." />
            <ConceptCard title="deliverables" description="Drafted artifacts (capability statement, technical narrative, pricing sheet) with sign-off." />
            <ConceptCard title="client_reviews" description="Client feedback and Approve / Request Changes decisions per deliverable." />
            <ConceptCard title="submissions" description="The final dispatch record — method, confirmation number, one per bid." />
            <ConceptCard title="audit_log" description="Append-only trail of every compliance/legal action across a bid." />
          </div>
        </section>

        <section className="mb-12" id="rate-limiting">
          <h2 className="text-headline-md text-on-surface mb-4 pb-2 border-b border-outline-variant">
            Rate Limiting
          </h2>
          <p className="text-body-md text-on-surface-variant mb-4">
            Each API key carries its own limit, in requests per minute.
          </p>
          {apiKeys && apiKeys.length > 0 ? (
            <div className="border border-outline-variant rounded overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low text-label-md text-on-surface-variant border-b border-outline-variant">
                  <tr>
                    <th className="py-2 px-3 font-medium">Key</th>
                    <th className="py-2 px-3 font-medium text-right">Limit</th>
                  </tr>
                </thead>
                <tbody className="text-body-md text-on-surface">
                  {apiKeys.map((k) => (
                    <tr key={k.key_prefix} className="border-b border-outline-variant last:border-b-0">
                      <td className="py-2 px-3 font-code text-code-sm">{k.key_prefix}…</td>
                      <td className="py-2 px-3 text-right">{k.rate_limit_per_min}/min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-body-md text-on-surface-variant">
              No active API keys yet —{" "}
              <Link href="/settings/security" className="text-secondary hover:underline">
                generate one
              </Link>
              .
            </p>
          )}
        </section>

        <section id="quick-example">
          <h2 className="text-headline-md text-on-surface mb-4 pb-2 border-b border-outline-variant">
            Quick Example (planned shape)
          </h2>
          <div className="rounded-xl overflow-hidden border border-outline-variant/50">
            <div className="bg-surface-container-highest px-4 py-2 border-b border-outline-variant/50 text-label-md text-on-surface-variant">
              cURL
            </div>
            <div className="bg-primary-container p-4 font-code text-code-sm text-inverse-surface overflow-x-auto">
              <pre>
                <code>{`curl -X GET \\
  https://api.bidpulse.example/v1/bids?stage=compliance_review \\
  -H 'Authorization: Bearer bp_live_xxxxxx' \\
  -H 'Accept: application/json'`}</code>
              </pre>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ConceptCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="border border-outline-variant rounded-lg p-4 hover:bg-surface-container-low transition-colors">
      <h3 className="font-bold text-on-surface mb-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-secondary-container" />
        <code className="font-code text-code-sm">{title}</code>
      </h3>
      <p className="text-body-md text-on-surface-variant">{description}</p>
    </div>
  );
}
