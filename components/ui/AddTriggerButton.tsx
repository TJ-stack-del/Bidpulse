// Shared "+ Add X" trigger that reveals an add-form on click, used across
// every Compliance Vault section (certifications, insurance, bonding,
// documents, past performance). A UX review found all five sections'
// add-forms permanently expanded by default -- reasonable individually,
// but together the page read as a wall of forms before any data existed,
// quietly reintroducing the same "too much on one page" complaint that had
// just been fixed at the page level. Each caller still owns its own
// default-open decision (typically open when the section is empty, closed
// once it has data) -- this is just the collapsed-state trigger.
export function AddTriggerButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 rounded-lg border border-dashed border-primary/50 text-primary text-label-md font-bold hover:bg-surface-container-low hover:border-primary transition flex items-center gap-2 w-fit focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="material-symbols-outlined text-[18px]">add</span>
      {label}
    </button>
  );
}
