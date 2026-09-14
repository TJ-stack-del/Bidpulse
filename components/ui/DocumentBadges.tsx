import { CERT_REVIEWED_TOOLTIP } from "@/lib/brand";

// Extracted from InsuranceBondingSection.tsx -- a review caught the exact
// same badge/link markup still inlined in CertificationsSection.tsx in the
// same diff that introduced this component elsewhere. Shared by every
// Compliance Vault list (certifications, insurance policies, bonding
// capacity) that shows an admin-verified document.
export function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span
      title={verified ? CERT_REVIEWED_TOOLTIP : undefined}
      className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${
        verified ? "bg-secondary-container text-on-secondary-container border-primary/20" : "bg-surface-container-low text-on-surface-variant border-outline-variant"
      }`}
    >
      {verified ? "Document Reviewed" : "Not yet reviewed"}
    </span>
  );
}

export function DocLink({ url, name }: { url: string | null; name: string | null }) {
  if (!url) return null;
  return (
    <>
      {" · "}
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
        {name ?? "View document"}
      </a>
    </>
  );
}
