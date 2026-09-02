import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

export function DashboardShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-secondary/40">
      <SiteHeader />
      <div className="container-page py-8">
        <nav aria-label="Menu dashboard" className="mb-6 flex flex-wrap gap-2 text-sm">
          {[
            { to: "/favorit", label: "Favorit" },
            { to: "/profil", label: "Profil" },
            { to: "/agent", label: "Agen" },
            { to: "/admin", label: "Admin" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md border bg-card px-3 py-1.5 font-medium hover:border-accent"
              activeProps={{ className: "border-accent text-accent" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <h1 className="font-display text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}