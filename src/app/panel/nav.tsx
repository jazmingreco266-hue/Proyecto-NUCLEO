"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; count?: number };

export function Nav({ items }: { items: Item[] }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Secciones del panel">
      {items.map((it) => {
        const active = it.href === "/panel" ? path === "/panel" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}>
            <span>{it.label}</span>
            {it.count ? (
              <span className="count" aria-label={`${it.count} pendientes`}>
                {it.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
