"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeDevice } from "./actions";

export function RemoveDeviceButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`Quitar ${name}`}
      onClick={() => {
        if (confirm(`¿Quitar "${name}"? En ese equipo van a tener que entrar de nuevo con el usuario y la contraseña del personal.`)) {
          start(() => removeDevice(id));
        }
      }}
      className="text-danger"
    >
      <Trash2 className="size-4" aria-hidden /> Quitar
    </Button>
  );
}
