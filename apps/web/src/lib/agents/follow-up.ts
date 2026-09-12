import { prisma } from "@platform/db";
import { runAgentWithTools, type AgentTool } from "./run";

const SYSTEM_PROMPT = `You draft follow-up emails for staff at Intra Success Academy, an
intrapreneurship courses and coaching business. Given a contact's details, recent notes, and
deal/activity history, write a short, warm, non-pushy follow-up email a staff member could send
as-is. Reference concrete details from the context when there are any; keep it brief (3-6
sentences). Always call save_draft_email exactly once with your result; never call it more than
once, and never send anything yourself — a human reviews the draft before it goes out.`;

const SAVE_DRAFT_EMAIL_TOOL: AgentTool = {
  name: "save_draft_email",
  description: "Save the drafted follow-up email for staff review.",
  input_schema: {
    type: "object",
    properties: {
      subject: { type: "string", description: "Email subject line." },
      body: { type: "string", description: "Email body, plain text." },
    },
    required: ["subject", "body"],
  },
};

export interface DraftedEmail {
  subject: string;
  body: string;
}

function buildUserMessage(contact: {
  email: string;
  firstName: string | null;
  lastName: string | null;
  notes: { body: string }[];
  deals: { title: string; status: string }[];
  activities: { type: string; createdAt: Date }[];
}): string {
  const lines = [
    `Contact: ${[contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email} (${contact.email})`,
  ];
  if (contact.deals.length > 0) {
    lines.push(`Deals: ${contact.deals.map((d) => `"${d.title}" (${d.status})`).join(", ")}`);
  }
  if (contact.notes.length > 0) {
    lines.push(`Recent notes:\n${contact.notes.map((n) => `- ${n.body}`).join("\n")}`);
  }
  if (contact.activities.length > 0) {
    lines.push(`Recent activity: ${contact.activities.map((a) => a.type).join(", ")}`);
  }
  return `Draft a follow-up email for this contact:\n${lines.join("\n")}`;
}

// Drafts only — nothing is persisted or sent here. The draft is shown to
// staff for review; sendFollowUpEmail (called separately, only after a
// human clicks "Send") is what actually dispatches it.
export async function draftFollowUpEmail(contactId: string): Promise<DraftedEmail> {
  const contact = await prisma.contact.findUniqueOrThrow({
    where: { id: contactId },
    include: {
      deals: { orderBy: { createdAt: "desc" }, take: 3 },
      notes: { orderBy: { createdAt: "desc" }, take: 5 },
      activities: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  const result = await runAgentWithTools({
    system: SYSTEM_PROMPT,
    userMessage: buildUserMessage(contact),
    tools: [SAVE_DRAFT_EMAIL_TOOL],
    forceTool: "save_draft_email",
    executeTool: async (name, input) => {
      if (name !== "save_draft_email") throw new Error(`Unknown tool: ${name}`);
      return input;
    },
  });

  const draftCall = result.toolCalls.find((call) => call.name === "save_draft_email");
  if (!draftCall) {
    throw new Error("The agent did not produce a draft email.");
  }
  return draftCall.result as DraftedEmail;
}
