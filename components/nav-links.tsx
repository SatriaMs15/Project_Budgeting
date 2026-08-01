"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Wallet,
  Target,
  Repeat,
  Upload,
  type LucideIcon,
} from "lucide-react";

const links: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/transactions", label: "Transactions", Icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", Icon: Wallet },
  { href: "/goals", label: "Goals", Icon: Target },
  { href: "/recurring", label: "Recurring", Icon: Repeat },
  { href: "/import", label: "Import", Icon: Upload },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1 text-sm">
      {links.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-all duration-200 active:scale-95 ${
              active
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
            }`}
          >
            <Icon className={`size-4 ${active ? "text-primary" : ""}`} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
