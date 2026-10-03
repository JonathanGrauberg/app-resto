import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-2xl font-semibold tracking-tight">app-resto</p>
          <p className="mt-1 text-sm text-muted">Acceso para restaurantes y personal</p>
        </div>
        <Card className="p-5 sm:p-6">
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </Card>
        <p className="text-center text-sm text-muted">
          ¿Sos mozo, cocina o bar?{" "}
          <Link href="/login/pin" className="inline-flex items-center gap-1 font-medium text-brand">
            <KeyRound className="size-4" aria-hidden /> Entrar con PIN
          </Link>
        </p>
      </div>
    </main>
  );
}
