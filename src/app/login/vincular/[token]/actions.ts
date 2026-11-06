"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { redeemPairing } from "@/lib/auth/devices";

const nameSchema = z.string().trim().min(2, "Poné un nombre para el equipo").max(40);

export async function pairDevice(token: string, _: { error?: string } | undefined, formData: FormData) {
  const name = nameSchema.safeParse(formData.get("name") ?? "");
  if (!name.success) return { error: name.error.issues[0]?.message };
  const tenant = await redeemPairing(token, name.data);
  if (!tenant) return { error: "Este QR ya se usó o venció. Pedí uno nuevo." };
  redirect(`/login/pin/${tenant.slug}`);
}
