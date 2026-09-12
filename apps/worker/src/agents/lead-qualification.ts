import { prisma, ActivityType, type Contact, type Deal } from "@platform/db";
import { runAgentWithTools, type AgentTool } from "./run";

const SYSTEM_PROMPT = `You qualify inbound leads for Intra Success Academy, an intrapreneurship
courses and coaching business. Given a lead's contact details, decide how strong a fit they are
for our paid courses/coaching based on the information available (source, any deal context,
provided name/phone). Score conservatively when little information is available — a bare email
with no other signal is a low-to-medium score, not automatically high. Always call
record_qualification exactly once with your result; never call it more than once.`;

const RECORD_QUALIFICATION_TOOL: AgentTool = {
  name: "record_qualification",
  description: "Record this lead's qualification result on their contact record.",
  input_schema: {
    type: "object",
    properties: {
      score: {
        type: "integer",
        description: "Lead quality score from 1 (poor fit) to 10 (excellent fit).",
      },
      summary: {
        type: "string",
        description: "One or two sentence summary of why this lead was scored this way.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Short lowercase-hyphenated tags to attach, e.g. \"high-intent\", \"cold-lead\".",
      },
    },
    required: ["score", "summary", "tags"],
  },
};

interface RecordQualificationInput {
  score: number;
  summary: string;
  tags: string[];
}

function buildUserMessage(contact: Contact, deals: Deal[]): string {
  const lines = [
    `Email: ${contact.email}`,
    `Name: ${[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "not provided"}`,
    `Phone: ${contact.phone ?? "not provided"}`,
    `Source: ${contact.source ?? "unknown"}`,
  ];
  if (deals.length > 0) {
    lines.push(`Associated deals: ${deals.map((d) => `"${d.title}" (${d.currency} ${d.valueCents / 100})`).join(", ")}`);
  }
  return `New lead to qualify:\n${lines.join("\n")}`;
}

async function recordQualification(contactId: string, input: RecordQualificationInput) {
  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  const existingCustomFields = (contact.customFields as Record<string, unknown> | null) ?? {};

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      customFields: {
        ...existingCustomFields,
        aiQualification: {
          score: input.score,
          summary: input.summary,
          tags: input.tags,
          qualifiedAt: new Date().toISOString(),
        },
      },
      tags: { set: Array.from(new Set([...contact.tags, ...input.tags])) },
    },
  });

  await prisma.activity.create({
    data: {
      type: ActivityType.SYSTEM,
      contactId,
      metadata: { action: "ai_lead_qualification", score: input.score, summary: input.summary, tags: input.tags },
    },
  });

  return { ok: true };
}

// Triggered on new Contact creation (see apps/web's lib/crm/contacts.ts and
// lib/funnels/leads.ts) — a background agent, not a human waiting
// synchronously, so it belongs in the worker per CLAUDE.md's stack split.
export async function qualifyLead(contactId: string) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId }, include: { deals: true } });
  if (!contact) return; // contact may have been deleted since this job was enqueued

  await runAgentWithTools({
    system: SYSTEM_PROMPT,
    userMessage: buildUserMessage(contact, contact.deals),
    tools: [RECORD_QUALIFICATION_TOOL],
    forceTool: "record_qualification",
    executeTool: async (name, input) => {
      if (name !== "record_qualification") throw new Error(`Unknown tool: ${name}`);
      return recordQualification(contactId, input as RecordQualificationInput);
    },
  });
}
