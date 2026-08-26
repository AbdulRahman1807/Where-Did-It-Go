"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function TopBar({ right }: { right?: React.ReactNode }) {
  const pathname = usePathname();
  const onInvestigations = pathname?.startsWith("/investigations");

  return (
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-primary">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="focus-ring flex items-baseline gap-2">
            <span className="font-display text-sm font-medium tracking-tight text-text-primary">
              WHERE DID IT GO?
            </span>
            <span className="hidden text-[11px] uppercase tracking-widest text-text-tertiary sm:inline">
              Fulfillment exception investigator
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              href="/investigations"
              className={clsx(
                "focus-ring rounded px-2.5 py-1 text-xs font-medium uppercase tracking-widest transition-colors",
                onInvestigations ? "text-cyan" : "text-text-tertiary hover:text-text-primary"
              )}
            >
              Investigations
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">{right}</div>
      </div>
    </header>
  );
}
