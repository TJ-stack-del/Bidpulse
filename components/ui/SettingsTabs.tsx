import Link from "next/link";

const TABS = [
  { href: "/settings/security", label: "Security" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/roles", label: "Roles" },
];

export function SettingsTabs({ active }: { active: string }) {
  return (
    <div className="flex gap-2 border-b border-outline-variant mb-2">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`px-3 py-2 text-label-md border-b-2 transition-colors ${
            active === tab.href
              ? "border-secondary text-secondary font-bold"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
