// FunnelStep.content stores an ordered array of these as JSON. Each block
// type has a matching renderer in the public funnel page and a matching
// set of fields in the admin "add block" form. Keeping this a flat union
// (not a class hierarchy) mirrors how Quiz.questions is kept intentionally
// simple elsewhere in the schema.

export type LeadFormField = "email" | "firstName" | "lastName" | "phone";

export type FunnelBlock =
  | { type: "heading"; text: string }
  | { type: "text"; body: string }
  | { type: "image"; url: string; alt?: string }
  | { type: "button"; label: string; href: string }
  | { type: "form"; fields: LeadFormField[]; submitLabel: string }
  | { type: "buy"; productId: string; label: string };

export function parseBlocks(content: unknown): FunnelBlock[] {
  if (!Array.isArray(content)) return [];
  return content as FunnelBlock[];
}
