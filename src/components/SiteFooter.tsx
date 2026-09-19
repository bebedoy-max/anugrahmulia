import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t bg-primary text-primary-foreground">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div className="space-y-3">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold">
            <img src="/images/logo-anugerah-mulia.png" alt="Logo Anugerah Mulia" className="h-8 w-auto" />
            Anugerah Mulia
          </Link>
          <p className="text-sm text-primary-foreground/70">
            Marketplace properti Indonesia untuk jual, beli, dan sewa hunian dengan proses yang
            transparan.
          </p>
        </div>
        <nav aria-label="Jelajahi" className="space-y-2 text-sm">
          <p className="font-semibold">Jelajahi</p>
          <Link to="/properti" className="block text-primary-foreground/70 hover:text-accent">Semua Properti</Link>
          <Link to="/peta" className="block text-primary-foreground/70 hover:text-accent">Pencarian Peta</Link>
          <Link to="/kpr" className="block text-primary-foreground/70 hover:text-accent">Kalkulator KPR</Link>
        </nav>
        <nav aria-label="Perusahaan" className="space-y-2 text-sm">
          <p className="font-semibold">Perusahaan</p>
          <Link to="/tentang" className="block text-primary-foreground/70 hover:text-accent">Tentang Kami</Link>
          <Link to="/kontak" className="block text-primary-foreground/70 hover:text-accent">Kontak</Link>
          
        </nav>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Hubungi Kami</p>
          <p className="text-primary-foreground/70">halo@anugerahmulia.id</p>
          <p className="text-primary-foreground/70">+6281312778888</p>
          <p className="text-primary-foreground/70">Senin–Sabtu, 08.00–18.00 WIB</p>
        </div>
      </div>
      <div className="border-t border-primary-foreground/15 py-5 text-center text-xs text-primary-foreground/60">
        © {new Date().getFullYear()} Anugerah Mulia. Seluruh hak cipta dilindungi.
      </div>
    </footer>
  );
}