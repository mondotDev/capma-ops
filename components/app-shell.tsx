"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">CAPMA Ops Hub</div>
        <nav className="sidebar__nav" aria-label="Primary">
          <Link className={pathname === "/" ? "sidebar__link active" : "sidebar__link"} href="/">
            Dashboard
          </Link>
          <Link
            className={pathname === "/action" ? "sidebar__link active" : "sidebar__link"}
            href="/action"
          >
            Action View
          </Link>
        </nav>
      </aside>
      <div className="content">
        <header className="topbar">
          <button className="topbar__button" type="button">
            + Add Item
          </button>
          <input
            aria-label="Search"
            className="topbar__search"
            placeholder="Search"
            type="search"
          />
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
