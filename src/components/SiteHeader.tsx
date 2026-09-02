import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Heart, LayoutDashboard, LogOut, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { getMyAccount } from "@/lib/account.functions";

const NAV = [
  { to: "/properti", label: "Properti" },
  { to: "/konstruksi", label: "Konstruksi" },
  { to: "/pertanahan", label: "Pertanahan" },
  { to: "/peta", label: "Peta" },
  { to: "/kpr", label: "KPR" },
  { to: "/tentang", label: "Tentang" },
  { to: "/kontak", label: "Kontak" },
] as const;

export function SiteHeader() {
  const { user, signOut: endSession } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const fetchAccount = useServerFn(getMyAccount);

  const { data: account } = useQuery({
    queryKey: ["account", user?.id],
    queryFn: () => fetchAccount(),
    enabled: Boolean(user),
  });

  const roles = account?.roles ?? [];
  const dashboardTo = roles.includes("admin") ? "/admin" : roles.includes("agent") ? "/agent" : "/favorit";

  async function signOut() {
    await endSession();
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold">
          <img src="/images/logo-anugerah-mulia.png" alt="Logo Anugerah Mulia" className="h-8 w-auto" />
          Anugerah Mulia
        </Link>

        <nav aria-label="Navigasi utama" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="size-4" aria-hidden />
                  <span className="hidden sm:inline">{account?.profile?.name ?? "Akun"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={dashboardTo}>
                    <LayoutDashboard className="mr-2 size-4" aria-hidden /> Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/favorit">
                    <Heart className="mr-2 size-4" aria-hidden /> Favorit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/profil">
                    <User className="mr-2 size-4" aria-hidden /> Profil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 size-4" aria-hidden /> Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Buka menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="font-display text-lg">Menu</SheetTitle>
              <nav className="mt-6 grid gap-1">
                {NAV.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}