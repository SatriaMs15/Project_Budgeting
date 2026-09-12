import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import "./globals.css";

/** Display face: headings and every large figure. Never heavier than 600. */
const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

/** Body face: prose, labels, table data. Carries tabular-nums for columns. */
const lora = Lora({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Buku Kas",
  description: "Track income, expenses and budgets in Rupiah.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Ledger masthead: brand set in the display face, links as plain ink
            that turn gold on hover/current — no pills, no filled states. */}
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-divider px-5 py-3.5">
          <Link
            href="/"
            className="mr-auto font-heading text-[18px] font-semibold tracking-tight"
          >
            Buku Kas
          </Link>
          <NavLinks />
        </nav>
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-5 py-8 sm:px-10 sm:py-9">
          {children}
        </main>
      </body>
    </html>
  );
}
