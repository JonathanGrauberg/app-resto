/**
 * Script en línea que corre antes del primer pintado (tema, etc.).
 * En el cliente se marca como text/plain para que React no lo re-ejecute ni advierta
 * (patrón de la guía "Preventing flash before hydration" de Next.js).
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
