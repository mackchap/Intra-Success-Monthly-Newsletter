import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface CertificatePdfInput {
  studentName: string;
  courseTitle: string;
  issuedAt: Date;
}

// Rendered on demand per request rather than pre-generated and uploaded to
// R2 (see lib/academy/certificates.ts) — a plain, dependency-light PDF via
// pdf-lib, no native bindings, safe to run in any Node environment.
export async function renderCertificatePdf({ studentName, courseTitle, issuedAt }: CertificatePdfInput) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([792, 612]); // US Letter, landscape
  const { width, height } = page.getSize();

  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);

  const brand = rgb(0.15, 0.25, 0.62);
  const ink = rgb(0.15, 0.15, 0.18);

  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: brand, borderWidth: 3 });

  const drawCentered = (text: string, y: number, font = serif, size = 16, color = ink) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - textWidth) / 2, y, size, font, color });
  };

  drawCentered("CERTIFICATE OF COMPLETION", height - 130, serifBold, 28, brand);
  drawCentered("Intra Success Academy", height - 165, serif, 14);
  drawCentered("This certifies that", height - 230, serif, 14);
  drawCentered(studentName, height - 270, serifBold, 26);
  drawCentered("has successfully completed", height - 310, serif, 14);
  drawCentered(courseTitle, height - 345, serifBold, 20);
  drawCentered(
    issuedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    height - 400,
    serif,
    12,
  );

  return doc.save();
}
