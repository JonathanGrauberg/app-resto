"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { ImageUpload } from "@/components/image-upload";
import { Photo } from "@/components/mock-image";
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
  imageUrl,
  visible,
  count,
  first,
  last,
}: {
  id: string;
  name: string;
  /** Portada propia de la categoría para el hero de la carta (opcional). */
  imageUrl: string | null;
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
        <form onSubmit={action} className="w-full space-y-3 rounded-2xl border border-line bg-surface p-4">
          <label className="block text-sm font-medium">
            Nombre
            <Input name="name" defaultValue={name} autoFocus className="mt-1 max-w-xs" />
          </label>
          <div>
            <p className="text-sm font-medium">Portada de la categoría <span className="font-normal text-muted">(opcional)</span></p>
            <p className="mb-2 text-xs text-muted">
              Es la foto grande de arriba de la carta cuando aparece esta categoría. Si no subís ninguna, se usa la foto de un producto.
            </p>
            <ImageUpload
              name="imageKey"
              kind="cover"
              initialUrl={imageUrl}
              seed={id}
              label={`Portada de ${name}`}
              className="aspect-video w-full max-w-md rounded-xl"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              Guardar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <FormError message={state?.error} />
          </div>
        </form>
      ) : (
        <h2 className={cn("flex flex-1 items-center gap-2 text-lg font-semibold", !visible && "text-muted")}>
          {imageUrl && (
            <Photo src={imageUrl} seed={id} label={`Portada de ${name}`} hideIcon className="h-8 w-12 shrink-0 rounded-md" />
          )}
          {name}
          <span className="text-sm font-normal text-muted">{count}</span>
          {!visible && <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-normal">Oculta</span>}
        </h2>
      )}

      {!editing && (
        <div className="flex items-center gap-0.5 text-muted">
          <IconBtn label="Editar nombre y portada" onClick={() => setEditing(true)}>
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
