import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-semibold text-muted">404</p>
      <h1 className="text-xl font-semibold">No encontramos esta página</h1>
      <p className="max-w-sm text-sm text-muted">El local o la mesa no existen, o el QR ya no es válido.</p>
      <ButtonLink href="/" variant="secondary">
        Ir al inicio
      </ButtonLink>
    </main>
  );
}
