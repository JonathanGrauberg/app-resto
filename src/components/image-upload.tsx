"use client";

import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { requestImageUpload } from "@/app/admin/uploads";
import { FadedImage, MockImage, type Fade } from "@/components/mock-image";
import { cn } from "@/lib/format";

type Kind = "product" | "cover" | "logo" | "share";

/** Lado máximo según el uso: suficiente para pantallas retina sin pesar de más. */
/** `share`: 1200 px es el tamaño que usan WhatsApp/Facebook para la vista previa del enlace. */
const MAX_SIDE: Record<Kind, number> = { product: 1600, cover: 2400, logo: 512, share: 1200 };

/** Redimensiona y comprime en el navegador. WebP si se puede; si no (Safari viejo), JPEG. */
async function compress(file: File, maxSide: number) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const toBlob = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  let blob = await toBlob("image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg", 0.85);
  if (!blob) throw new Error("No se pudo procesar la imagen");
  return blob;
}

/**
 * Selector de imagen con vista previa (con el degradado de la carta).
 * Sube directo a R2 y deja en el campo oculto `name`:
 *   ""        → sin cambios
 *   "remove"  → quitar la imagen
 *   "<clave>" → nueva imagen subida
 */
export function ImageUpload({
  name,
  kind,
  initialUrl,
  seed,
  fade = "bottom",
  className,
  label = "Foto",
  overlay,
  hintClassName = "px-1",
}: {
  name: string;
  kind: Kind;
  initialUrl: string | null;
  /** Para el mockup cuando no hay foto. */
  seed: string;
  fade?: Fade;
  className?: string;
  label?: string;
  /** Contenido sobre el degradado inferior de la foto (ej. nombre y precio en la vista previa). */
  overlay?: React.ReactNode;
  /** Sangría del texto de ayuda (en tarjetas con foto a sangre, igualar el padding de la tarjeta). */
  hintClassName?: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("El archivo no es una imagen");
    if (file.size > 25 * 1024 * 1024) return setError("La imagen original supera 25 MB");
    setError(null);
    setBusy(true);
    try {
      const blob = await compress(file, MAX_SIDE[kind]);
      const res = await requestImageUpload({ kind, size: blob.size, type: blob.type });
      if ("error" in res) throw new Error(res.error);
      const put = await fetch(res.uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": blob.type } });
      if (!put.ok) throw new Error("La subida falló, probá de nuevo");
      setUrl(URL.createObjectURL(blob)); // vista previa local inmediata
      setValue(res.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    upload(e.dataTransfer.files[0]);
  };

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => upload(e.target.files?.[0])}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn("relative overflow-hidden", over && "ring-2 ring-brand", className)}
      >
        {url ? (
          <FadedImage src={url} alt={label} fade={fade} to="surface" className="size-full" />
        ) : (
          <MockImage seed={seed} kind={kind === "product" ? "kitchen" : "generic"} fade={fade} to="surface" className="size-full" />
        )}

        {overlay && <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">{overlay}</div>}

        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/60 backdrop-blur-sm">
            <Loader2 className="size-6 animate-spin" aria-hidden />
            <span className="sr-only">Subiendo…</span>
          </div>
        )}

        <div className="absolute right-2 top-2 flex gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-bg/85 px-3 text-sm font-medium shadow backdrop-blur hover:bg-bg"
          >
            {url ? <RefreshCw className="size-4" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
            {url ? "Cambiar" : "Subir foto"}
          </button>
          {url && (
            <button
              type="button"
              onClick={() => {
                setUrl(null);
                setValue(initialUrl ? "remove" : "");
              }}
              disabled={busy}
              aria-label="Quitar foto"
              className="flex size-9 items-center justify-center rounded-full bg-bg/85 text-danger shadow backdrop-blur hover:bg-bg"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
      {error ? (
        <p className={cn("mt-2 text-xs text-danger", hintClassName)}>{error}</p>
      ) : (
        <p className={cn("mt-2 text-xs text-muted", hintClassName)}>
          Arrastrá una foto o tocá &ldquo;{url ? "Cambiar" : "Subir foto"}&rdquo;. Se optimiza sola.
        </p>
      )}
    </div>
  );
}
