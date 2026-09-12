import { prisma } from "@platform/db";
import { runAgentWithTools, type AgentTool } from "./run";

const SEARCH_TOOL: AgentTool = {
  name: "search_course_content",
  description: "Search this course's lesson titles and content for a keyword or phrase.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Keyword or phrase to search for." },
    },
    required: ["query"],
  },
};

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function buildSystemPrompt(courseTitle: string): string {
  return `You are a support assistant for a student inside the course "${courseTitle}" on Intra
Success Academy. Use search_course_content to look up relevant lesson material before answering
substantive questions about the course content — don't invent content that isn't in the course.
If a search finds nothing relevant, say so honestly rather than guessing. Keep answers concise
(a few sentences). You may answer general/logistics questions without searching.`;
}

// Simple substring search over this course's lessons — no vector search,
// deliberately (see CLAUDE.md's Phase 6 notes). Scoped to courseId so a
// student's chat can only surface content from the course they're in.
async function searchCourseContent(courseId: string, query: string) {
  const lessons = await prisma.lesson.findMany({
    where: {
      module: { courseId },
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { title: true, content: true },
    take: 5,
  });
  if (lessons.length === 0) return { results: [] };
  return {
    results: lessons.map((lesson) => ({
      lessonTitle: lesson.title,
      excerpt: (lesson.content ?? "").slice(0, 500),
    })),
  };
}

// A genuine multi-turn chat: each call carries the prior turns as plain
// text history (see runAgentWithTools) and can invoke search_course_content
// fresh for the new question.
export async function askStudentSupport(
  courseId: string,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { title: true } });

  const result = await runAgentWithTools({
    system: buildSystemPrompt(course.title),
    history: history.map((message) => ({ role: message.role, content: message.content })),
    userMessage,
    tools: [SEARCH_TOOL],
    maxTurns: 4,
    executeTool: async (name, input) => {
      if (name !== "search_course_content") throw new Error(`Unknown tool: ${name}`);
      const { query } = input as { query: string };
      return searchCourseContent(courseId, query);
    },
  });

  return result.finalText || "I wasn't able to find an answer to that in this course.";
}
