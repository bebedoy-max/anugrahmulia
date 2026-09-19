import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useServerFn } from "@tanstack/react-start";
import { signIn as signInFn, signUp as signUpFn } from "@/lib/auth.functions";
import { useAuth } from "@/hooks/useAuth";

const searchSchema = z.object({
  redirect: fallback(z.string(), "/").default("/"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Masuk atau Daftar — Anugerah Mulia" },
      {
        name: "description",
        content: "Masuk ke akun Anugerah Mulia untuk menyimpan favorit, mengirim pertanyaan, dan memasang iklan properti.",
      },
      { property: "og:title", content: "Masuk atau Daftar — Anugerah Mulia" },
      { property: "og:description", content: "Akses akun Anugerah Mulia Anda." },
    ],
  }),
  component: AuthPage,
});

function safePath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const doSignIn = useServerFn(signInFn);
  const doSignUp = useServerFn(signUpFn);
  const target = safePath(redirect);

  useEffect(() => {
    if (!loading && user) navigate({ to: target });
  }, [loading, user, navigate, target]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await doSignIn({
        data: {
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
        },
      });
      await refresh();
      navigate({ to: target });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal masuk.");
    } finally {
      setBusy(false);
    }
  }

  async function signUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
      })
      .safeParse({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      });
    if (!parsed.success) {
      toast.error("Periksa kembali nama, email, dan kata sandi (min. 8 karakter).");
      return;
    }
    setBusy(true);
    try {
      await doSignUp({
        data: { email: parsed.data.email, password: parsed.data.password, name: parsed.data.name },
      });
      await refresh();
      toast.success("Akun berhasil dibuat.");
      navigate({ to: target });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat akun.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-lift">
        <Link to="/" className="flex items-center justify-center gap-2 font-display text-xl font-semibold">
          <img src="/images/logo-anugerah-mulia.png" alt="Logo Anugerah Mulia" className="h-8 w-auto" /> Anugerah Mulia
        </Link>
        <h1 className="mt-6 text-center font-display text-2xl">Masuk ke akun Anda</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Simpan favorit, kirim pertanyaan, dan pasang iklan properti.
        </p>

        <Tabs defaultValue="masuk">
          <TabsList className="w-full">
            <TabsTrigger value="masuk" className="flex-1">Masuk</TabsTrigger>
            <TabsTrigger value="daftar" className="flex-1">Daftar</TabsTrigger>
          </TabsList>
          <TabsContent value="masuk">
            <form className="space-y-4" onSubmit={signIn}>
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input id="login-email" name="email" type="email" required maxLength={255} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">Kata sandi</Label>
                <Input id="login-password" name="password" type="password" required maxLength={72} />
              </div>
              <Button type="submit" className="w-full" disabled={busy || !ready}>Masuk</Button>
            </form>
          </TabsContent>
          <TabsContent value="daftar">
            <form className="space-y-4" onSubmit={signUp}>
              <div className="space-y-1.5">
                <Label htmlFor="reg-name">Nama lengkap</Label>
                <Input id="reg-name" name="name" required maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email">Email</Label>
                <Input id="reg-email" name="email" type="email" required maxLength={255} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-password">Kata sandi</Label>
                <Input id="reg-password" name="password" type="password" required minLength={8} maxLength={72} />
              </div>
              <Button type="submit" className="w-full" disabled={busy || !ready}>Buat akun</Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-accent">Kembali ke beranda</Link>
        </p>
      </div>
    </div>
  );
}