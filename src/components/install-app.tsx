"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { BRAND } from "@/lib/brand";

/** Evento de Chrome / Edge / Android para instalar la app con un botón propio. */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "yatay_install_dismissed";
/** Si lo cierran, se vuelve a ofrecer recién en 2 semanas. */
const DISMISS_DAYS = 14;
/** Solo se ofrece a quienes trabajan con la app (no a comensales de la carta ni en la landing). */
const APP_PATHS = ["/admin", "/staff", "/platform", "/login"];

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
/** iPhone / iPad (los iPad nuevos se presentan como Mac con pantalla táctil). */
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isIosSafari = () => isIos() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);

/** Registra el Service Worker y ofrece instalar Yatay: botón en Android/Windows, instrucciones en iPhone. */
export function InstallApp() {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (isStandalone()) return;
    const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende de localStorage y del navegador (solo en el cliente)
    setHidden(Date.now() < until);
    setIos(isIosSafari());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => {
      setPrompt(null);
      setHidden(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86_400_000));
    setHidden(true);
    setHelp(false);
  };

  const install = async () => {
    if (ios) return setHelp(true);
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === "dismissed") dismiss();
  };

  const inApp = APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!inApp || hidden || (!prompt && !ios)) return null;

  return (
    <>
      <div
        role="dialog"
        aria-label={`Instalar ${BRAND.name}`}
        className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-xl print:hidden md:inset-x-auto md:bottom-6 md:right-6 md:w-96"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ícono chico y fijo */}
        <img src="/brand/pwa-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instalá {BRAND.name}</p>
          <p className="text-xs text-muted">
            {ios ? "Sumala a tu pantalla de inicio y abrila como una app." : "Abrila como una app, sin pasar por el navegador."}
          </p>
        </div>
        <button
          type="button"
          onClick={install}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3 text-sm font-medium text-brand-ink hover:bg-brand/90"
        >
          <Download className="size-4" aria-hidden /> {ios ? "Cómo" : "Instalar"}
        </button>
        <button type="button" onClick={dismiss} aria-label="Ahora no" className="shrink-0 rounded-lg p-1 text-muted hover:text-ink">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {help && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center" onClick={() => setHelp(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-semibold">Instalar en iPhone o iPad</p>
            <p className="mt-1 text-sm text-muted">En Safari son dos toques:</p>
            <ol className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-3 rounded-xl bg-ink/5 p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-brand-ink">1</span>
                <span>
                  Tocá <Share className="inline size-4 align-text-bottom" aria-label="Compartir" /> <strong>Compartir</strong> (abajo, o arriba en iPad).
                </span>
              </li>
              <li className="flex items-center gap-3 rounded-xl bg-ink/5 p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-brand-ink">2</span>
                <span>
                  Elegí <SquarePlus className="inline size-4 align-text-bottom" aria-hidden /> <strong>Agregar a inicio</strong>.
                </span>
              </li>
            </ol>
            <button type="button" onClick={dismiss} className="mt-5 h-11 w-full rounded-xl bg-ink text-sm font-semibold text-bg">
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
