/**
 * Borde irregular "a pincel" entre dos bandas de la landing. Se dibuja con el color de la banda
 * de abajo y se superpone sobre la de arriba. El trazo sale de un ruido fijo (siempre igual).
 */

function brushPath(seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const W = 1200;
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 6) {
    // Ondas largas + cortas + "pelos" del pincel.
    const y = 46 + 16 * Math.sin(x / 140 + seed) + 8 * Math.sin(x / 41 + seed * 2) + (rnd() - 0.5) * 9 + (rnd() < 0.06 ? -rnd() * 22 : 0);
    pts.push(`${x} ${y.toFixed(1)}`);
  }
  // Gotitas sueltas por encima del borde.
  const drops: string[] = [];
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W;
    const y = 10 + rnd() * 34;
    const r = 1.2 + rnd() * 3.4;
    drops.push(`M ${(x - r).toFixed(1)} ${y.toFixed(1)} a ${r.toFixed(1)} ${(r * 0.8).toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0 a ${r.toFixed(1)} ${(r * 0.8).toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0 Z`);
  }
  return `M 0 100 L ${pts.join(" L ")} L ${W} 100 Z ${drops.join(" ")}`;
}

export function TornEdge({ color, seed = 1, className = "" }: { color: string; seed?: number; className?: string }) {
  return (
    <svg viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden className={`pointer-events-none block h-14 w-full sm:h-20 ${className}`}>
      <path d={brushPath(seed)} fill={color} />
    </svg>
  );
}
