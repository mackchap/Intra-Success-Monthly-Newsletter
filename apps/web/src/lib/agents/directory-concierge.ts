import { prisma, ListingStatus } from "@platform/db";
import { runAgentWithTools, type AgentTool } from "./run";

const SEARCH_TOOL: AgentTool = {
  name: "search_listings",
  description: "Search this directory's published business listings by name, description, or city.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Keyword or phrase to search for (business type, name, or city)." },
    },
    required: ["query"],
  },
};

function buildSystemPrompt(directoryName: string): string {
  return `You are a helpful local concierge for "${directoryName}", a directory of local businesses. Use
search_listings to find businesses matching what the visitor is looking for before recommending
anything — don't invent businesses that aren't in the directory. If a search finds nothing
relevant, say so honestly and suggest they browse by category instead. Keep answers concise (a
few sentences) and mention the business name and what makes it a good match.`;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Deliberately simple substring search, same approach as the student-support
// agent's search_course_content — no vector search/embeddings for this
// phase. Scoped to directoryId and PUBLISHED status so a visitor's chat can
// only ever surface listings that are actually live on this directory.
async function searchListings(directoryId: string, query: string) {
  const listings = await prisma.listing.findMany({
    where: {
      directoryId,
      status: ListingStatus.PUBLISHED,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
      ],
    },
    include: { category: true },
    take: 5,
  });
  if (listings.length === 0) return { results: [] };

  return {
    results: listings.map((listing) => ({
      name: listing.name,
      category: listing.category?.name ?? null,
      city: listing.city,
      description: listing.description,
    })),
  };
}

// Public-facing (no auth required, unlike the portal's student-support
// chat) but otherwise the same shape: a genuine multi-turn conversation
// carrying prior turns as plain text history.
export async function askDirectoryConcierge(
  directoryId: string,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const directory = await prisma.directory.findUniqueOrThrow({ where: { id: directoryId }, select: { name: true } });

  const result = await runAgentWithTools({
    system: buildSystemPrompt(directory.name),
    history: history.map((message) => ({ role: message.role, content: message.content })),
    userMessage,
    tools: [SEARCH_TOOL],
    maxTurns: 4,
    executeTool: async (name, input) => {
      if (name !== "search_listings") throw new Error(`Unknown tool: ${name}`);
      const { query } = input as { query: string };
      return searchListings(directoryId, query);
    },
  });

  return result.finalText || "I wasn't able to find a good match for that in this directory.";
}
