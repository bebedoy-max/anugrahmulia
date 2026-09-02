import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";

export const Route = createFileRoute("/tentang")({
  head: () => ({
    meta: [
      { title: "Tentang Anugerah Mulia — Marketplace Properti Indonesia" },
      {
        name: "description",
        content: "Anugerah Mulia mempertemukan pencari hunian dengan agen properti terverifikasi di seluruh Indonesia.",
      },
      { property: "og:title", content: "Tentang Anugerah Mulia" },
      { property: "og:description", content: "Misi kami membuat transaksi properti lebih transparan." },
    ],
  }),
  component: () => (
    <PublicLayout>
      <div className="container-page max-w-3xl py-16">
        <h1 className="font-display text-4xl">Tentang Anugerah Mulia</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Anugerah Mulia adalah marketplace properti yang mempertemukan pencari hunian dengan agen dan
          pemilik properti di seluruh Indonesia. Kami percaya proses jual, beli, dan sewa properti
          seharusnya transparan, cepat, dan bebas informasi menyesatkan.
        </p>

        <h2 className="mt-10 font-display text-2xl">Visi</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Menjadi perusahaan properti yang bertumbuh dalam berkat dan menjadi berkat bagi banyak orang.
        </p>

        <h2 className="mt-10 font-display text-2xl">Misi</h2>
        <ul className="mt-4 space-y-3 text-muted-foreground">
          <li>· Membangun rumah bukan hanya sebagai tempat tinggal, tetapi sebagai tempat keluarga bertumbuh dan memiliki masa depan yang lebih baik.</li>
          <li>· Kami percaya bahwa setiap berkat yang kami terima adalah kesempatan untuk memberkati lebih banyak orang melalui karya, lapangan pekerjaan, pelayanan, dan kepedulian kepada sesama.</li>
        </ul>

        <h2 className="mt-10 font-display text-2xl">Apa yang kami lakukan</h2>
        <ul className="mt-4 space-y-3 text-muted-foreground">
          <li>· Meninjau setiap listing sebelum tayang agar data harga dan lokasi akurat.</li>
          <li>· Menyediakan peta interaktif dan filter presisi untuk mempersempit pilihan.</li>
          <li>· Menghubungkan calon pembeli langsung dengan agen melalui pertanyaan dan jadwal survei.</li>
          <li>· Membantu perencanaan finansial lewat kalkulator simulasi KPR.</li>
        </ul>
        <h2 className="mt-10 font-display text-2xl">Untuk agen properti</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Daftar sebagai agen untuk memasang iklan, memantau performa listing, dan mengelola
          pertanyaan serta jadwal survei dari satu dashboard.
        </p>
      </div>
    </PublicLayout>
  ),
});