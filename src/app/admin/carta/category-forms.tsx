"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { FormError, Input } from "@/components/ui/field";
import { cn } from "@/lib/format";
import {
  deleteCategory,
  moveCategory,
  renameCategory,
  toggleCategoryVisible,
} from "./actions";
import { useFormAction } from "@/lib/use-form-action";

export function CategoryHeader({
  id,
  name,
  visible,
  count,
  first,
  last,
}: {
  id: string;
  name: string;
  visible: boolean;
  count: number;
  first: boolean;
  last: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useFormAction(renameCategory.bind(null, id), undefined);
  // Al guardar con éxito se cierra el editor (ajuste de estado durante el render, sin efecto).
  const [handledAt, setHandledAt] = useState<number>();
  if (state?.at && state.at !== handledAt) {
    setHandledAt(state.at);
    setEditing(false);
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {editing ? (
        <form onSubmit={action} className="flex flex-1 flex-wrap items-center gap-2">
          <Input name="name" defaultValue={name} autoFocus className="max-w-xs" aria-label="Nombre de la categoría" />
          <Button type="submit" size="sm" disabled={pending}>
            Guardar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <FormError message={state?.error} />
        </form>
      ) : (
        <h2 className={cn("flex flex-1 items-center gap-2 text-lg font-semibold", !visible && "text-muted")}>
          {name}
          <span className="text-sm font-normal text-muted">{count}</span>
          {!visible && <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-normal">Oculta</span>}
        </h2>
      )}

      {!editing && (
        <div className="flex items-center gap-0.5 text-muted">
          <IconBtn label="Renombrar" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </IconBtn>
          <ActionButton
            action={() => toggleCategoryVisible(id)}
            aria-label={visible ? "Ocultar de la carta" : "Mostrar en la carta"}
            title={visible ? "Ocultar de la carta" : "Mostrar en la carta"}
            className="rounded-lg p-2 hover:bg-ink/5 hover:text-ink"
          >
            {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </ActionButton>
          <ActionButton
            action={() => moveCategory(id, "up")}
            disabled={first}
            aria-label="Subir"
            title="Subir"
            className="rounded-lg p-2 hover:bg-ink/5 hover:text-ink"
          >
            <ArrowUp className="size-4" />
          </ActionButton>
          <ActionButton
            action={() => moveCategory(id, "down")}
            disabled={last}
            aria-label="Bajar"
            title="Bajar"
            className="rounded-lg p-2 hover:bg-ink/5 hover:text-ink"
          >
            <ArrowDown className="size-4" />
          </ActionButton>
          <ActionButton
            action={() => deleteCategory(id)}
            confirm={`¿Borrar la categoría "${name}"?`}
            aria-label="Borrar categoría"
            title="Borrar categoría"
            className="rounded-lg p-2 hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="size-4" />
          </ActionButton>
        </div>
      )}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="rounded-lg p-2 hover:bg-ink/5 hover:text-ink">
      {children}
    </button>
  );
}
