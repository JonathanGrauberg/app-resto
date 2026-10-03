import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";

export function ComingSoon({ title, phase, children }: { title: string; phase: string; children?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Construction className="size-8 text-muted" aria-hidden />
      <p className="font-semibold">{title}</p>
      <p className="max-w-md text-sm text-muted">Disponible en la {phase} del roadmap.</p>
      {children}
    </Card>
  );
}
