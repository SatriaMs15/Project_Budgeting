"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/budgets", label: "Budgets" },
  { href: "/categories", label: "Categories" },
  { href: "/goals", label: "Goals" },
  { href: "/recurring", label: "Recurring" },
  { href: "/import", label: "Import" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
      {links.map(({ href, label }) => {
        // "/" would prefix-match everything, so it only ever matches exactly.
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "text-[color:var(--accent-700)]"
                : "text-foreground transition-colors hover:text-[color:var(--accent-700)]"
            }
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
