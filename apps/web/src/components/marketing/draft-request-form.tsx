"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestDraftAction } from "@/app/admin/marketing/actions";

interface Account {
  id: string;
  displayName: string;
  platform: string;
}

export function DraftRequestForm({ campaignId, accounts }: { campaignId: string; accounts: Account[] }) {
  const router = useRouter();
  const [socialAccountId, setSocialAccountId] = useState(accounts[0]?.id ?? "");
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!socialAccountId || !brief.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await requestDraftAction(campaignId, socialAccountId, brief);
      setBrief("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to draft a post.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <select
          value={socialAccountId}
          onChange={(event) => setSocialAccountId(event.target.value)}
          required
          disabled={loading}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.displayName} ({account.platform})
            </option>
          ))}
        </select>
        <input
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          required
          disabled={loading}
          placeholder="What should this post be about?"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Drafting..." : "Draft with AI"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
