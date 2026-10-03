import { normalize } from "@/lib/format";

/** Trigramas de una palabra (con padding, como pg_trgm). */
function trigrams(word: string) {
  const w = `  ${word} `;
  const out = new Set<string>();
  for (let i = 0; i < w.length - 2; i++) out.add(w.slice(i, i + 3));
  return out;
}

function similarity(a: string, b: string) {
  const ta = trigrams(a);
  const tb = trigrams(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

/**
 * Coincidencia tolerante para la carta: desde 3 caracteres.
 * 1) subcadena exacta (sin tildes) en cualquier campo;
 * 2) si no, similitud de trigramas por palabra (tolera errores de tipeo: "croqetas").
 * Mismo criterio que se replicará en el servidor con pg_trgm.
 */
export function matchesQuery(query: string, fields: (string | null | undefined)[]) {
  const q = normalize(query.trim());
  if (q.length < 3) return true;
  const haystack = normalize(fields.filter(Boolean).join(" "));
  if (haystack.includes(q)) return true;

  const words = haystack.split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 3);
  return q
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .every((term) => words.some((w) => w.startsWith(term) || similarity(term, w) >= 0.4));
}
