import { NextResponse } from "next/server";
import { prisma } from "@platform/db";
import { auth } from "@/auth";
import { renderCertificatePdf } from "@/lib/academy/certificate-pdf";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: { user: true, course: true },
  });
  if (!certificate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = certificate.userId === session.user.id;
  const isStaff = session.user.role === "ADMIN" || session.user.role === "STAFF";
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pdfBytes = await renderCertificatePdf({
    studentName: certificate.user.name ?? certificate.user.email ?? "Student",
    courseTitle: certificate.course.title,
    issuedAt: certificate.issuedAt,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="certificate-${certificate.id}.pdf"`,
    },
  });
}
