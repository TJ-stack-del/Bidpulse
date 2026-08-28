import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";
import { LifecycleStepper } from "@/components/ui/LifecycleStepper";
import { IntakeActions } from "./IntakeActions";
import { BidDocuments } from "@/components/ui/BidDocuments";

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ bid?: string }>;
}) {
  const { bid: bidId } = await searchParams;
  const supabase = await createClient();

  const { data: bid } = bidId
    ? await supabase.from("bids").select("*").eq("id", bidId).single()
    : { data: null };

  return (
    <AppShell activePath="/intake">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-6">
        <div>
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
            RFP Intake Screen
          </p>
          <h1 className="text-headline-lg text-on-surface">
            {bid?.title ?? "New Solicitation"}
          </h1>
        </div>
        <button className="px-4 py-2 bg-surface border border-outline-variant rounded hover:bg-surface-container-high transition-colors text-label-md text-on-surface">
          Save Draft
        </button>
      </div>

      <LifecycleStepper currentStage={1} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h2 className="text-title-lg text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-on-surface-variant">info</span>
              Solicitation Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
              <Field label="Agency Name" value={bid?.agency ?? "—"} />
              <Field label="Solicitation Number" value={bid?.solicitation_number ?? "—"} mono />
              <Field
                label="Bid Due Date"
                value={bid?.due_date ? new Date(bid.due_date).toLocaleString() : "—"}
                warn
              />
              <Field
                label="Estimated Value"
                value={
                  bid?.estimated_value_low
                    ? `$${Number(bid.estimated_value_low).toLocaleString()} - $${Number(
                        bid.estimated_value_high
                      ).toLocaleString()}`
                    : "—"
                }
              />
              <Field label="Summary Description" value={bid?.scope ?? "—"} full />
            </div>
          </div>

          <div className="bg-surface-container-lowest border-l-4 border-l-secondary border border-outline-variant rounded-r-xl p-6">
            <h2 className="text-title-lg text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">gavel</span>
              Procurement Integrity Act Attestation
            </h2>
            <p className="text-body-md text-on-surface-variant mb-6 bg-surface p-4 rounded border border-outline-variant/30">
              By submitting this intake form, you acknowledge and certify compliance with
              the Procurement Integrity Act (41 U.S.C. §§ 2101-2107).
            </p>
            <IntakeActions bidId={bid?.id ?? null} alreadyAttested={bid?.pia_attested ?? false} />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 sticky top-[88px]">
            <h3 className="text-title-lg text-on-surface mb-4">Files</h3>
            {bid ? (
              <BidDocuments bidId={bid.id} orgId={bid.org_id} />
            ) : (
              <p className="text-body-md text-on-surface-variant">
                Save this job first, then you can attach files here — the RFP
                document, your insurance certificate, your W-9, anything you need.
              </p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  mono,
  warn,
  full,
}: {
  label: string;
  value: string;
  mono?: boolean;
  warn?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : undefined}>
      <label className="text-label-md text-on-surface-variant block mb-1">{label}</label>
      <div
        className={`text-body-md bg-surface-container-low px-3 py-2 rounded border border-outline-variant/50 ${
          mono ? "font-code text-code-sm" : ""
        } ${warn ? "text-error" : "text-on-surface"}`}
      >
        {value}
      </div>
    </div>
  );
}