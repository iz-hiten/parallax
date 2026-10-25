"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AuthLink } from "./AuthProvider";

const LINKS = [
  { href: "/app", label: "Today" },
  { href: "/app/curve", label: "Curve" },
  { href: "/app/backtest", label: "Backtest" },
  { href: "/app/contracts", label: "Contracts" },
  { href: "/app/alerts", label: "Alerts" },
  { href: "/app/data", label: "Data" },
];

export function AppNav() {
  const path = usePathname();
  const q = useSearchParams();
  const asof = q.get("date");
  return (
    <nav className="nav">
      <div className="wrap-wide nav-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" />
          Parallax
        </Link>
        <div className="nav-links">
          {LINKS.map((l) => (
            <Link key={l.href} href={asof && (l.href === "/app" || l.href === "/app/curve") ? `${l.href}?date=${asof}` : l.href} className={path === l.href ? "active" : ""}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="nav-right">
          <AuthLink />
        </div>
      </div>
    </nav>
  );
}
