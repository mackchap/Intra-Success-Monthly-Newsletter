import type { Activity } from "@platform/db";
import { describeActivity } from "@/lib/crm/describe-activity";
import { formatDate } from "@/lib/format";

export function Timeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-slate-500">No activity yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {activities.map((activity) => (
        <li key={activity.id} className="border-l-2 border-slate-200 pl-3 text-sm">
          <div>{describeActivity(activity)}</div>
          <div className="text-xs text-slate-400">{formatDate(activity.createdAt)}</div>
        </li>
      ))}
    </ol>
  );
}
