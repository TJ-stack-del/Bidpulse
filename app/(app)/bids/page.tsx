import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";

// No mockup for this one — AppShell's nav has always linked here, but the
// route never existed. List view only (filtering via Link searchParams), so
// no client component is needed — nothing on this page mutates data.

const STAGES = [
  "intake",
  "compliance_review",
  "assembly_drafting",
  "admin_audit",
  "client_review",
  "submission",
];

const STATUSES = ["drafting", "in_review", "ready", "submitted", "awarded", "lost", "withdrawn"];

// Where a bid's title link should send you, based on its current stage —
// mirrors the per-stage links already used on /dashboard. admin_audit and
// client_review have no page of their own anymore (their pages were
// dropped from this trimmed-down build), so a bid sitting in either of
// those stages renders as plain text instead of a dead link.
const STAGE_HREF: Record<string, (id: string) => string> = {
  intake: (id) => `/intake?bid=${id}`,
  compliance_review: (id) => `/compliance?bid=${id}`,
  assembly_drafting: (id) => `/assembly?bid=${id}`,
  submission: (id) => `/submit?bid=${id}`,
};

const STATUS_STYLE: Record<string, string> = {
  drafting: "bg-surface-container-low text-on-surface-variant border-outline-variant",
  in_review: "bg-surface-container text-secondary border-secondary/20",
  ready: "bg-surface-container-highest text-on-surface border-outline-variant",
  submitted: "bg-[#E6F4EA] text-on-tertiary-container border-on-tertiary-container/20",
  awarded: "bg-[#E6F4EA] text-on-tertiary-container border-on-tertiary-container/20",
  lost: "bg-error-container text-on-error-container border-on-error-container/20",
  withdrawn: "bg-surface-container-low text-on-surface-variant border-outline-variant",
};

export default async function BidsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; status?: string }>;
}) {
  const { stage, status } = await searchParams;
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

  if (!member) {
    return (
      <AppShell activePath="/bids">
        <p className="text-body-md text-error mt-6">
          No team_members record found for this account — see README step 12.
        </p>
      </AppShell>
    );
  }

  let query = supabase
    .from("bids")
    .select("id, title, agency, solicitation_number, stage, status, due_date")
    .eq("org_id", member.org_id)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (stage) query = query.eq("stage", stage);
  if (status) query = query.eq("status", status);

  const { data: bids } = await query;

  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = { stage, status, ...overrides };
    Object.entries(next).forEach(([k, v]) => v && params.set(k, v));
    const s = params.toString();
    return s ? `/bids?${s}` : "/bids";
  };

  return (
    <AppShell activePath="/bids">
      <h1 className="text-headline-lg text-on-surface mt-6 mb-1">Bids</h1>
      <p className="text-body-md text-on-surface-variant mb-4">
        {bids?.length ?? 0} bid{(bids?.length ?? 0) === 1 ? "" : "s"} for your organization.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChip label="All Stages" active={!stage} href={qs({ stage: undefined })} />
        {STAGES.map((s) => (
          <FilterChip key={s} label={s.replace("_", " ")} active={stage === s} href={qs({ stage: s })} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        <FilterChip label="All Statuses" active={!status} href={qs({ status: undefined })} />
        {STATUSES.map((s) => (
          <FilterChip key={s} label={s.replace("_", " ")} active={status === s} href={qs({ status: s })} />
        ))}
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-surface-container-low border-b border-outline-variant text-label-md text-on-surface-variant">
          <div className="col-span-4">Title</div>
          <div className="col-span-2">Agency</div>
          <div className="col-span-2">Stage</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Due Date</div>
        </div>
        {bids && bids.length > 0 ? (
          bids.map((bid) => (
            <div
              key={bid.id}
              className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-outline-variant last:border-b-0 items-center hover:bg-surface-container-low transition-colors"
            >
              <div className="col-span-4 truncate">
                {STAGE_HREF[bid.stage] ? (
                  <Link
                    href={STAGE_HREF[bid.stage](bid.id)}
                    className="text-body-md text-on-surface hover:text-secondary transition-colors truncate block"
                  >
                    {bid.title}
                  </Link>
                ) : (
                  <p className="text-body-md text-on-surface truncate">{bid.title}</p>
                )}
                {bid.solicitation_number && (
                  <p className="text-code-sm font-code text-on-surface-variant truncate">
                    {bid.solicitation_number}
                  </p>
                )}
              </div>
              <div className="col-span-2 text-body-md text-on-surface-variant truncate">{bid.agency}</div>
              <div className="col-span-2 text-body-md text-on-surface-variant capitalize">
                {bid.stage.replace("_", " ")}
              </div>
              <div className="col-span-2">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-label-md capitalize border ${STATUS_STYLE[bid.status]}`}
                >
                  {bid.status.replace("_", " ")}
                </span>
              </div>
              <div className="col-span-2 text-body-md text-on-surface-variant">
                {bid.due_date ? new Date(bid.due_date).toLocaleDateString() : "—"}
              </div>
            </div>
          ))
        ) : (
          <p className="text-body-md text-on-surface-variant px-4 py-6">No bids match these filters.</p>
        )}
      </div>
    </AppShell>
  );
}

function FilterChip({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full border text-label-md capitalize transition-colors ${
        active
          ? "bg-secondary text-on-secondary border-secondary"
          : "bg-surface-container-low text-on-surface-variant border-outline-variant hover:bg-surface-container-high"
      }`}
    >
      {label}
    </Link>
  );
}
