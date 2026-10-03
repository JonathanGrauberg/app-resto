"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/format";

/** Alterna claro/oscuro y lo recuerda en este dispositivo (`storageKey` permite recordarlo por local). */
export function ThemeToggle({ className, storageKey = "theme" }: { className?: string; storageKey?: string }) {
  const toggle = () => {
    const root = document.documentElement;
    const current =
      root.getAttribute("data-theme") ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      aria-label="Cambiar modo claro u oscuro"
      className={cn("flex size-10 items-center justify-center rounded-full", className)}
    >
      {/* El ícono se resuelve por CSS para no depender del estado en el render del servidor */}
      <Sun className="hidden size-5 dark:block" aria-hidden />
      <Moon className="size-5 dark:hidden" aria-hidden />
    </button>
  );
}
