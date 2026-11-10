/** WhatsApp con código de país: AR → +549…, ES → +34… (lo que ya viene con código queda igual). */
export function intlPhone(raw: string, country: string) {
  let d = raw.replace(/\D/g, "");
  if (country === "AR" && !d.startsWith("54")) d = `549${d.replace(/^0/, "")}`;
  if (country === "ES" && !d.startsWith("34")) d = `34${d}`;
  return `+${d}`;
}
