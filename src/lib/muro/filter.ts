import type { CountryCode } from "@/lib/region";

/**
 * Filtro de palabras del Muro y del chat. Detecta variantes comunes para esquivarlo:
 * mayúsculas, tildes, números/símbolos por letras ("put@", "p3lotud0"), separadores ("p.u.t.a")
 * y letras repetidas ("puuuuto"). Bloquea el mensaje entero: no lo "tacha".
 * No reemplaza la moderación del local (las quejas o el doble sentido no se detectan solos).
 */

// Raíces: se busca que la palabra EMPIECE con la raíz ("put" → puto, puta, putazo).
const COMMON = [
  // Insultos y discriminación (comunes en castellano)
  "put", "pelotud", "forro", "forra", "trol", "trolo", "trola", "pajer", "conchud", "chot", "garca",
  "hdp", "hijodeput", "mierd", "cagon", "culiad", "maric", "trava", "negro de mierd", "sudaca",
  "mogolic", "retrasad", "subnormal", "idiot", "imbecil", "estupid", "gil", "pete", "petera", "verga",
  "pija", "poronga", "orto", "ojete", "culo", "tetas", "follar", "follad", "polla", "zorra",
  "perra", "cabron", "malparid", "gonorrea", "cojon", "cono", "gilipolla", "capull",
  "nazi", "violad", "muerte a",
];

const BY_COUNTRY: Partial<Record<CountryCode, string[]>> = {
  // En España "coger" es "tomar" y "concha" un nombre: solo cuentan en Argentina.
  AR: ["cornud", "lpm", "lpqtp", "tarad", "bolud", "cagad", "chorr", "villero", "coger", "cogid", "concha", "bolita", "paragua"],
  ES: ["mamon", "pringad", "cabrona", "soplapolla", "mamahuevo", "carajo", "puneta", "guarra", "joder", "hostia"],
};

// Solo cuentan como palabra entera (si no, "gil" bloquearía "gilberto", "orto" "ortopedia", "paragua" "paraguas").
const WHOLE_ONLY = new Set(["gil", "orto", "culo", "pete", "pija", "trol", "lpm", "cono", "perra", "concha", "bolita", "paragua", "hostia"]);

/** Teléfonos y usuarios de redes: no se comparten en pantalla ni en el chat. */
const CONTACT = [/\d[\d\s.-]{6,}\d/, /(^|\s)@[a-z0-9_.]{3,}/i];

const LEET: Record<string, string> = { "@": "a", "4": "a", "3": "e", "1": "i", "!": "i", "0": "o", "5": "s", "$": "s", "7": "t", "8": "b" };

/** Texto → palabras normalizadas (sin tildes, sin símbolos, sin letras repetidas). */
function normalizeWords(text: string) {
  const plain = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[@4310!57$8]/g, (c) => LEET[c] ?? c);
  const words = plain
    .split(/[^a-zñ.\-_*]+/)
    .map((w) => w.replace(/[.\-_*]/g, "").replace(/(.)\1+/g, "$1"))
    .filter(Boolean);
  // También juntas: "p u t a" o "hijo de p..." escritos separados.
  const joined = plain.replace(/[^a-zñ]/g, "").replace(/(.)\1+/g, "$1");
  return { words, joined };
}

const clean = (w: string) =>
  w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zñ ]/g, "")
    .replace(/(.)\1+/g, "$1")
    .trim();

/** ¿El texto tiene alguna palabra no permitida? Devuelve la primera encontrada. */
export function findBlocked(text: string, country: CountryCode, extra: string[] = []) {
  if (CONTACT.some((re) => re.test(text))) return "datos de contacto";
  const { words, joined } = normalizeWords(text);
  const list = [...COMMON, ...(BY_COUNTRY[country] ?? []), ...extra].map(clean).filter((w) => w.length >= 2);
  for (const root of list) {
    if (root.includes(" ")) {
      if (joined.includes(root.replace(/ /g, ""))) return root;
      continue;
    }
    if (WHOLE_ONLY.has(root)) {
      if (words.includes(root)) return root;
      continue;
    }
    if (words.some((w) => w.startsWith(root)) || (root.length >= 5 && joined.includes(root))) return root;
  }
  return null;
}

/** Reglas que se aceptan antes de escribir (también se muestran en el cartel). */
export const MURO_RULES = [
  "Nada de insultos, burlas ni discriminación.",
  "Nada de contenido sexual ni de doble sentido subido de tono.",
  "No compartas teléfonos, redes ni datos de nadie.",
  "Las quejas o pedidos al local no van al muro: hablalo con el personal.",
  "El local puede borrar mensajes y bloquear a quien no respete las reglas.",
];
