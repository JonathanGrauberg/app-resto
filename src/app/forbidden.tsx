import { ButtonLink } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-semibold text-muted">403</p>
      <h1 className="text-xl font-semibold">No tenés acceso a esta sección</h1>
      <p className="max-w-sm text-sm text-muted">Tu rol no lo permite o el módulo no está incluido en el plan del local.</p>
      <ButtonLink href="/staff" variant="secondary">
        Volver
      </ButtonLink>
    </main>
  );
}
