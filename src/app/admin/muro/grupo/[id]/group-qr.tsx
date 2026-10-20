"use client";

import { useState } from "react";
import { QrCode } from "lucide-react";
import { QrDialog } from "@/components/qr-dialog";

export function GroupQr({ path, name, venue }: { path: string; name: string; venue: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-bg">
        <QrCode className="size-4" aria-hidden /> QR del grupo
      </button>
      {open && <QrDialog path={path} title={name} venue={venue} caption="Escaneá para sumarte al chat de la mesa (+18)" onClose={() => setOpen(false)} />}
    </>
  );
}
