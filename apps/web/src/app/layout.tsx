import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Intra Success Academy",
  description:
    "Courses, coaching, and community for mastering intrapreneurship.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
