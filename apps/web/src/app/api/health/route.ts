import { NextResponse } from "next/server";
import { prisma } from "@platform/db";

// Railway health check target. Verifies the process is up and can reach
// Postgres so a bad deploy fails the health check instead of serving 500s.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch {
    return NextResponse.json(
      { status: "error", db: "unreachable" },
      { status: 503 },
    );
  }
}
