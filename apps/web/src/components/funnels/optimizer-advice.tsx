"use client";

import { useState } from "react";
import { getFunnelOptimizationAdviceAction } from "@/app/admin/funnels/[id]/analytics/actions";

export function OptimizerAdvice({ funnelId }: { funnelId: string }) {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const result = await getFunnelOptimizationAdviceAction(funnelId);
      setAdvice(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get suggestions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">AI suggestions</h2>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Get AI suggestions"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {advice && <p className="whitespace-pre-wrap text-sm text-slate-700">{advice}</p>}
    </div>
  );
}
