import type { Activity } from "@platform/db";

// Turns a stored Activity row into a one-line human-readable timeline entry.
export function describeActivity(activity: Activity): string {
  const metadata = (activity.metadata as Record<string, unknown> | null) ?? {};

  switch (activity.type) {
    case "NOTE_ADDED":
      return "Note added";
    case "TASK_CREATED":
      return `Task created: ${metadata.title ?? ""}`;
    case "TASK_COMPLETED":
      return `Task completed: ${metadata.title ?? ""}`;
    case "STAGE_CHANGED":
      return `Deal moved to stage: ${metadata.stageName ?? ""}`;
    case "DEAL_CREATED":
      return `Deal created: ${metadata.title ?? ""}`;
    case "DEAL_WON":
      return "Deal won 🎉";
    case "DEAL_LOST":
      return "Deal lost";
    case "EMAIL_SENT":
      return "Email sent";
    case "SMS_SENT":
      return "SMS sent";
    case "CALL_LOGGED":
      return "Call logged";
    case "MEETING_LOGGED":
      return "Meeting logged";
    case "FUNNEL_SUBMISSION":
      return "Submitted a funnel form";
    case "ORDER_PAID":
      return "Order paid";
    case "SYSTEM":
      if (metadata.action === "ai_lead_qualification") {
        return `AI lead qualification: ${metadata.score}/10 — ${metadata.summary ?? ""}`;
      }
      return "Activity";
    default:
      return "Activity";
  }
}
