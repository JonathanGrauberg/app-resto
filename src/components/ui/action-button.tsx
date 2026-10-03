"use client";

import { useTransition, type ComponentProps } from "react";
import { cn } from "@/lib/format";

/**
 * Botón que ejecuta una Server Action sin formulario (toggles, mover, borrar).
 * Con `confirm`, pide confirmación antes. Si la acción devuelve `{ error }`, lo muestra.
 */
export function ActionButton({
  action,
  confirm: confirmText,
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "onClick" | "action"> & {
  action: () => Promise<unknown>;
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending || props.disabled}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        start(async () => {
          const res = (await action()) as { error?: string } | undefined;
          if (res?.error) window.alert(res.error);
        });
      }}
      className={cn("disabled:opacity-50", pending && "animate-pulse", className)}
      {...props}
    >
      {children}
    </button>
  );
}

/** Interruptor visual que dispara una acción (no usa checkbox real). */
export function ToggleAction({
  on,
  action,
  label,
  onLabel,
  offLabel,
}: {
  on: boolean;
  action: () => Promise<unknown>;
  label: string;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <ActionButton
      action={action}
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      className="group inline-flex items-center gap-2 text-xs text-muted"
    >
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", on ? "bg-ok" : "bg-ink/20")}>
        <span
          className={cn(
            "absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform",
            on && "translate-x-4",
          )}
        />
      </span>
      {(onLabel || offLabel) && <span className="hidden sm:inline">{on ? onLabel : offLabel}</span>}
    </ActionButton>
  );
}
