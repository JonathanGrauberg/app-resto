import type { Allergen } from "@/generated/prisma/enums";

/** 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011). */
export const ALLERGENS: Record<Allergen, { label: string; short: string }> = {
  GLUTEN: { label: "Gluten", short: "GL" },
  CRUSTACEANS: { label: "Crustáceos", short: "CR" },
  EGGS: { label: "Huevos", short: "HU" },
  FISH: { label: "Pescado", short: "PE" },
  PEANUTS: { label: "Cacahuetes", short: "CA" },
  SOY: { label: "Soja", short: "SO" },
  MILK: { label: "Lácteos", short: "LA" },
  NUTS: { label: "Frutos de cáscara", short: "FC" },
  CELERY: { label: "Apio", short: "AP" },
  MUSTARD: { label: "Mostaza", short: "MO" },
  SESAME: { label: "Sésamo", short: "SE" },
  SULPHITES: { label: "Sulfitos", short: "SU" },
  LUPIN: { label: "Altramuces", short: "AL" },
  MOLLUSCS: { label: "Moluscos", short: "ML" },
};

export const ALLERGEN_KEYS = Object.keys(ALLERGENS) as Allergen[];
