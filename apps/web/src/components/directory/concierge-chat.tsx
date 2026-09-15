"use client";

import { useState } from "react";
import { askDirectoryConciergeAction } from "@/app/t/[tenantSlug]/directory/chat-actions";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function ConciergeChat({ tenantSlug }: { tenantSlug: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!question) return;

    const history = messages;
    setMessages([...history, { role: "user", content: question }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const answer = await askDirectoryConciergeAction(tenantSlug, history, question);
      setMessages([...history, { role: "user", content: question }, { role: "assistant", content: answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong asking that.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
      <h2 className="font-medium">Ask the concierge</h2>

      {messages.length === 0 && (
        <p className="text-sm text-slate-500">
          Tell us what you&apos;re looking for and an AI assistant will search this directory for you.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {messages.map((message, index) => (
          <li
            key={index}
            className={
              message.role === "user"
                ? "self-end rounded-md bg-brand-600 px-3 py-2 text-sm text-white"
                : "self-start rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-800"
            }
          >
            {message.content}
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="e.g. a good coffee shop downtown"
          disabled={sending}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {sending ? "Asking..." : "Ask"}
        </button>
      </form>
    </div>
  );
}
