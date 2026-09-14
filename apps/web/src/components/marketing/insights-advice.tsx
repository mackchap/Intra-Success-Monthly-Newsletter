"use client";

import { useState } from "react";
import { getMarketingRecommendationsAction } from "@/app/admin/marketing/actions";

export function InsightsAdvice() {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const result = await getMarketingRecommendationsAction();
      setAdvice(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get recommendations.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">AI strategy recommendations</h2>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Researching..." : "Get recommendations"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Looks at our own published post performance plus current public research on what&apos;s
        working elsewhere — advisory only, nothing is posted automatically.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {advice && <p className="whitespace-pre-wrap text-sm text-slate-700">{advice}</p>}
    </div>
  );
}
