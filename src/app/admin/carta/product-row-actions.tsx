"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { ActionButton, ToggleAction } from "@/components/ui/action-button";
import { moveProduct, toggleProductFlag } from "./actions";

export function ProductRowActions({
  id,
  available,
  first,
  last,
}: {
  id: string;
  available: boolean;
  first: boolean;
  last: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <ToggleAction
        on={available}
        action={() => toggleProductFlag(id, "available")}
        label={available ? "Marcar como agotado" : "Marcar como disponible"}
        onLabel="Disponible"
        offLabel="Agotado"
      />
      <div className="ml-1 hidden text-muted sm:flex">
        <ActionButton
          action={() => moveProduct(id, "up")}
          disabled={first}
          aria-label="Subir"
          title="Subir"
          className="rounded-lg p-1.5 hover:bg-ink/5 hover:text-ink"
        >
          <ArrowUp className="size-4" />
        </ActionButton>
        <ActionButton
          action={() => moveProduct(id, "down")}
          disabled={last}
          aria-label="Bajar"
          title="Bajar"
          className="rounded-lg p-1.5 hover:bg-ink/5 hover:text-ink"
        >
          <ArrowDown className="size-4" />
        </ActionButton>
      </div>
    </div>
  );
}
