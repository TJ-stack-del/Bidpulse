"use client";

// Shared by the intake wizard and the Company Profile page for the
// small-business-status / set-aside / NAICS checkbox lists — same toggle
// behavior and styling in both places instead of two hand-rolled copies.
export function CheckboxGroup({
  legend,
  options,
  selected,
  onChange,
}: {
  legend: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <fieldset>
      <legend className="text-label-md text-on-surface-variant block mb-1">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 text-body-md text-on-surface cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              className="rounded border-outline-variant text-secondary focus:ring-secondary focus:ring-offset-0"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
