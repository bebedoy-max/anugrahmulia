import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { PublicLayout } from "@/components/PublicLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatRupiahFull } from "@/lib/format";

const searchSchema = z.object({
  harga: fallback(z.number(), 1_500_000_000).default(1_500_000_000),
});

export const Route = createFileRoute("/kpr")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Kalkulator Simulasi KPR — Anugerah Mulia" },
      {
        name: "description",
        content: "Hitung estimasi cicilan KPR bulanan dari harga properti, uang muka, bunga, dan tenor.",
      },
      { property: "og:title", content: "Kalkulator Simulasi KPR — Anugerah Mulia" },
      { property: "og:description", content: "Simulasi cicilan KPR properti Indonesia." },
    ],
  }),
  component: KprPage,
});

function KprPage() {
  const { harga } = Route.useSearch();
  const [price, setPrice] = useState(Math.max(50_000_000, harga));
  const [dpPercent, setDpPercent] = useState(20);
  const [rate, setRate] = useState(6.5);
  const [years, setYears] = useState(15);

  const result = useMemo(() => {
    const dp = (price * dpPercent) / 100;
    const loan = Math.max(0, price - dp);
    const months = years * 12;
    const monthlyRate = rate / 100 / 12;
    const installment =
      monthlyRate === 0
        ? loan / months
        : (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
    return { dp, loan, months, installment, total: installment * months };
  }, [price, dpPercent, rate, years]);

  return (
    <PublicLayout>
      <div className="container-page py-12">
        <h1 className="font-display text-3xl">Kalkulator simulasi KPR</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estimasi cicilan bulanan dengan metode anuitas. Hasil hanya perkiraan.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="space-y-6 rounded-xl border bg-card p-6 shadow-soft">
            <div className="space-y-2">
              <Label htmlFor="price">Harga properti</Label>
              <Input
                id="price"
                type="number"
                min={50_000_000}
                step={10_000_000}
                value={price}
                onChange={(event) => setPrice(Math.max(0, Number(event.target.value)))}
              />
              <p className="text-sm text-muted-foreground">{formatRupiahFull(price)}</p>
            </div>

            <div className="space-y-3">
              <Label>Uang muka: {dpPercent}% ({formatRupiahFull(result.dp)})</Label>
              <Slider value={[dpPercent]} min={0} max={80} step={1} onValueChange={([v]) => setDpPercent(v ?? 0)} />
            </div>

            <div className="space-y-3">
              <Label>Suku bunga: {rate.toFixed(2)}% per tahun</Label>
              <Slider value={[rate]} min={0} max={20} step={0.25} onValueChange={([v]) => setRate(v ?? 0)} />
            </div>

            <div className="space-y-3">
              <Label>Tenor: {years} tahun</Label>
              <Slider value={[years]} min={1} max={30} step={1} onValueChange={([v]) => setYears(v ?? 1)} />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border bg-secondary p-6">
            <div>
              <p className="text-sm text-muted-foreground">Estimasi cicilan per bulan</p>
              <p className="font-display text-4xl text-accent">{formatRupiahFull(result.installment)}</p>
            </div>
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <dt className="text-muted-foreground">Uang muka</dt>
                <dd className="font-medium">{formatRupiahFull(result.dp)}</dd>
              </div>
              <div className="flex justify-between border-b pb-2">
                <dt className="text-muted-foreground">Pokok pinjaman</dt>
                <dd className="font-medium">{formatRupiahFull(result.loan)}</dd>
              </div>
              <div className="flex justify-between border-b pb-2">
                <dt className="text-muted-foreground">Jumlah angsuran</dt>
                <dd className="font-medium">{result.months} bulan</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total pembayaran</dt>
                <dd className="font-medium">{formatRupiahFull(result.total)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}