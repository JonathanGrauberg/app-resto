import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";

export const metadata: Metadata = { title: "Entrar con PIN" };

async function goToTenant(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (slug) redirect(`/login/pin/${encodeURIComponent(slug)}`);
}

/** Paso 1: identificar el local. En la PWA instalada se recordará el último usado. */
export default function PinTenantPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-5 sm:p-6">
        <form action={goToTenant} className="space-y-4">
          <div>
            <Label htmlFor="slug">Código del local</Label>
            <Input id="slug" name="slug" placeholder="ej. la-casona" autoCapitalize="none" required />
          </div>
          <Button type="submit" className="w-full" size="lg">
            Continuar
          </Button>
        </form>
      </Card>
    </main>
  );
}
