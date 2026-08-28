"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ProfileForm({
  memberId,
  fullName,
  avatarUrl,
  email,
  role,
}: {
  memberId: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
  role: string;
}) {
  const [name, setName] = useState(fullName);
  const [avatar, setAvatar] = useState(avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error: updateError } = await supabase
      .from("team_members")
      .update({ full_name: name, avatar_url: avatar || null })
      .eq("id", memberId);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-primary-container text-on-primary flex items-center justify-center text-title-lg font-bold shrink-0 border border-outline-variant">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={name} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div>
          <p className="text-title-lg text-on-surface">{fullName}</p>
          <p className="text-code-sm text-on-surface-variant">{email}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-label-md capitalize">
            {role.replace("_", " ")}
          </span>
        </div>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {error && <p className="text-body-md text-error">{error}</p>}
        {saved && !error && <p className="text-body-md text-on-tertiary-container">Saved.</p>}

        <label className="flex flex-col gap-1">
          <span className="text-label-md text-on-surface-variant">Full Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-label-md text-on-surface-variant">Avatar URL</span>
          <input
            type="url"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://…"
            className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-secondary"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-label-md text-on-surface-variant">Email</span>
          <input
            type="email"
            value={email}
            disabled
            className="bg-surface-container-low border border-outline-variant rounded px-3 py-2 text-body-md text-on-surface-variant cursor-not-allowed"
          />
        </label>
        <p className="text-code-sm text-on-surface-variant -mt-2">
          Role and email are managed by a team manager on{" "}
          <a href="/settings/team" className="text-secondary hover:underline">
            Team Settings
          </a>
          .
        </p>

        <button
          type="submit"
          disabled={saving}
          className="py-2 px-4 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-start"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
