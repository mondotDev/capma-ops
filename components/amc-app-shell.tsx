"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRODUCT_NAME } from "@/lib/amc-domain";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/work", label: "Work" }
];

export function AmcAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="amc-shell">
      <aside className="amc-sidebar">
        <div className="amc-sidebar__brand">
          <span>{PRODUCT_NAME}</span>
          <small>Multi-client operations</small>
        </div>
        <nav className="amc-sidebar__nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <Link
              className={pathname === item.href ? "amc-sidebar__link active" : "amc-sidebar__link"}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="amc-content">
        <header className="amc-topbar">
          <div>
            <div className="amc-topbar__eyebrow">Reusable AMC workspace</div>
            <div className="amc-topbar__title">Client-scoped event and program operations</div>
          </div>
        </header>
        <main className="amc-page">{children}</main>
      </div>
    </div>
  );
}
