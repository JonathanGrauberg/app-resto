import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { CreateTenantForm } from "../../create-tenant-form";

export const metadata: Metadata = { title: "Nuevo local" };

export default async function NewTenantPage() {
  await requirePlatformAdmin();
  return (
    <>
      <Link href="/platform/locales" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Locales
      </Link>
      <PageHeader title="Nuevo local" description="El dueño entra con su email y la contraseña inicial, y arma su carta y su salón." />
      <Card className="max-w-3xl p-4 sm:p-6">
        <CreateTenantForm />
      </Card>
    </>
  );
}
