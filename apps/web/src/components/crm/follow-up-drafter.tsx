"use client";

import { useState } from "react";
import { draftFollowUpEmailAction, sendFollowUpEmailAction } from "@/app/staff/contacts/[id]/agent-actions";

export function FollowUpDrafter({ contactId }: { contactId: string }) {
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDraft() {
    setDrafting(true);
    setError(null);
    setSent(false);
    try {
      const result = await draftFollowUpEmailAction(contactId);
      setDraft(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to draft a follow-up email.");
    } finally {
      setDrafting(false);
    }
  }

  async function handleSend() {
    if (!draft) return;
    setSending(true);
    setError(null);
    try {
      await sendFollowUpEmailAction(contactId, draft.subject, draft.body);
      setSent(true);
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send the email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">AI follow-up email</h2>
        <button
          type="button"
          onClick={handleDraft}
          disabled={drafting}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {drafting ? "Drafting..." : "Draft follow-up"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {sent && <p className="text-sm text-green-700">Email queued to send.</p>}

      {draft && (
        <div className="flex flex-col gap-2">
          <input
            value={draft.subject}
            onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
          />
          <textarea
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            rows={6}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="self-start rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send email"}
          </button>
          <p className="text-xs text-slate-400">
            Review before sending — this draft isn&apos;t saved or sent automatically.
          </p>
        </div>
      )}
    </div>
  );
}
