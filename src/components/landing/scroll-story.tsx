"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Historia de la landing que avanza con el scroll: una persona llega, se sienta, escanea el QR,
 * el mozo le trae el pedido y se va. Ilustración 2D (SVG) en colores pastel, fija mientras
 * pasan los textos; cada paso coincide con su sección (5 secciones → pasos en 0, ¼, ½, ¾ y 1).
 */

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
/** Avance 0→1 de un tramo del scroll [a, b]. */
const seg = (p: number, a: number, b: number) => ease(clamp((p - a) / (b - a)));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const C = {
  floor: "#efe4d6",
  shadow: "#e2d3c1",
  table: "#e8c9a6",
  tableDark: "#d8b48d",
  chair: "#c9bfe4",
  chairDark: "#b4a8d8",
  skin: "#f2c6a6",
  hair: "#3f3a4f",
  guest: "#7cbfa8",
  guestLegs: "#4f6f8f",
  waiter: "#f6f1e9",
  waiterApron: "#f29c84",
  waiterLegs: "#3f3a4f",
  phone: "#2f2b3d",
  glow: "#bfe9dc",
  qr: "#2f2b3d",
  cup: "#fbe3ec",
  scoop1: "#f7b6c8",
  scoop2: "#f8e3a3",
  scoop3: "#a8dcc8",
};

type PersonProps = {
  x: number;
  /** 0 = de pie, 1 = sentado. */
  sit: number;
  /** Distancia recorrida: mueve las piernas al caminar. */
  stride: number;
  walking: boolean;
  /** 0 = brazo abajo, 1 = brazo levantado hacia adelante. */
  arm: number;
  facing: 1 | -1;
  body: string;
  legs: string;
  apron?: string;
  phone?: boolean;
  tray?: boolean;
};

/** Figura abstracta: cabeza, torso redondeado, piernas y un brazo. Origen en los pies. */
function Person({ x, sit, stride, walking, arm, facing, body, legs, apron, phone, tray }: PersonProps) {
  const swing = walking ? Math.sin(stride / 14) : 0;
  const hipY = mix(-82, -68, sit);
  // Rodilla y pie: de pie (con balanceo al caminar) → sentado (muslo hacia adelante).
  const leg = (side: 1 | -1) => {
    const s = swing * side;
    const knee = { x: mix(s * 9, 40, sit), y: mix(-42, -70, sit) };
    const foot = { x: mix(s * 18, 44, sit), y: mix(walking ? -Math.max(0, -s) * 6 : 0, 0, sit) };
    return `M ${side * 5} ${hipY} L ${knee.x + side * 3} ${knee.y} L ${foot.x + side * 3} ${foot.y}`;
  };
  const torsoTop = hipY - 92;
  const bob = walking ? Math.abs(Math.sin(stride / 14)) * -3 : 0;
  const shoulder = { x: 4, y: torsoTop + 22 };
  const elbow = { x: mix(10, 30, arm), y: mix(torsoTop + 52, torsoTop + 40, arm) };
  const hand = { x: mix(12 + swing * 6, 54, arm), y: mix(torsoTop + 82, torsoTop + 26, arm) };

  return (
    <g transform={`translate(${x} 500) scale(${facing} 1)`}>
      <ellipse cx={sit ? 20 : 0} cy="2" rx="40" ry="7" fill={C.shadow} />
      <g transform={`translate(0 ${bob})`}>
        <path d={leg(-1)} stroke={legs} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={leg(1)} stroke={legs} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="-23" y={torsoTop} width="46" height="98" rx="23" fill={body} />
        {apron && <rect x="-19" y={torsoTop + 46} width="38" height="50" rx="10" fill={apron} />}
        <circle cx="2" cy={torsoTop - 26} r="23" fill={C.skin} />
        <path d={`M -21 ${torsoTop - 28} a 23 23 0 0 1 44 -6 q -14 -4 -30 6 z`} fill={C.hair} />
        <path
          d={`M ${shoulder.x} ${shoulder.y} L ${elbow.x} ${elbow.y} L ${hand.x} ${hand.y}`}
          stroke={body === C.waiter ? "#e8dfd2" : body}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{ filter: "brightness(0.93)" }}
        />
        {phone && (
          <g transform={`translate(${hand.x} ${hand.y})`} opacity={clamp(arm * 2)}>
            <rect x="-2" y="-30" width="20" height="34" rx="4" fill={C.phone} />
            <rect x="1" y="-26" width="14" height="24" rx="2" fill={C.glow} />
          </g>
        )}
        {tray && (
          <g transform={`translate(${hand.x + 10} ${hand.y - 4})`}>
            <rect x="-34" y="0" width="68" height="6" rx="3" fill="#cfd8d4" />
          </g>
        )}
      </g>
    </g>
  );
}

/** Copa de helado de tres bochas. */
function IceCream({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle cx="-9" cy="-30" r="11" fill={C.scoop1} />
      <circle cx="9" cy="-30" r="11" fill={C.scoop3} />
      <circle cx="0" cy="-42" r="11" fill={C.scoop2} />
      <path d="M -20 -24 L 20 -24 L 12 -4 L -12 -4 Z" fill={C.cup} />
      <rect x="-3" y="-4" width="6" height="8" fill={C.cup} />
      <ellipse cx="0" cy="5" rx="12" ry="3" fill={C.cup} />
    </g>
  );
}

function Scene({ p, pan }: { p: number; pan: boolean }) {
  // Invitado: entra caminando, se sienta, saca el celular, escanea, guarda el celular y disfruta.
  const walkIn = seg(p, 0.03, 0.19);
  const sit = seg(p, 0.19, 0.26);
  const guestX = mix(mix(-260, 432, walkIn), 462, sit);
  const raise = seg(p, 0.3, 0.37) * (1 - seg(p, 0.6, 0.66));
  const scanning = p > 0.4 && p < 0.56;
  const menu = seg(p, 0.46, 0.52) * (1 - seg(p, 0.6, 0.64));
  // Mozo: entra con la bandeja, deja el helado, se va.
  const wIn = seg(p, 0.6, 0.71);
  const wOut = seg(p, 0.84, 0.95);
  const waiterX = mix(mix(1320, 676, wIn), 1320, wOut);
  const served = seg(p, 0.74, 0.79);
  const leaving = p > 0.84;
  const happy = seg(p, 0.92, 0.97);

  return (
    <svg viewBox={pan ? "0 0 1000 600" : "290 150 520 380"} className="size-full" role="img" aria-label="Una persona llega a una mesa, escanea el QR, el mozo le trae un helado y se va">
      <defs>
        <radialGradient id="ls-blob1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d6efe5" />
          <stop offset="100%" stopColor="#d6efe5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ls-blob2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbe0d4" />
          <stop offset="100%" stopColor="#fbe0d4" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Fondo: manchas suaves que se desplazan un poco con el scroll. */}
      <circle cx={mix(620, 520, p)} cy={mix(250, 300, p)} r="300" fill="url(#ls-blob1)" />
      <circle cx={mix(250, 380, p)} cy="420" r="220" fill="url(#ls-blob2)" />
      <path d="M 40 500 Q 500 486 960 500" stroke={C.floor} strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* En compu la cámara se corre al lado contrario del texto de cada sección (zigzag). */}
      <g transform={`translate(${pan ? Math.cos(Math.PI * 4 * p) * 190 - 40 : -60} 0)`}>

      {/* Silla */}
      <g>
        <ellipse cx="470" cy="502" rx="38" ry="6" fill={C.shadow} />
        <rect x="438" y="418" width="64" height="12" rx="6" fill={C.chair} />
        <rect x="438" y="330" width="12" height="100" rx="6" fill={C.chairDark} />
        <rect x="444" y="428" width="9" height="72" rx="4" fill={C.chairDark} />
        <rect x="488" y="428" width="9" height="72" rx="4" fill={C.chairDark} />
      </g>

      {/* Invitado (detrás de la mesa cuando se sienta) */}
      <Person x={guestX} sit={sit} stride={guestX} walking={walkIn > 0 && walkIn < 1} arm={raise} facing={1} body={C.guest} legs={C.guestLegs} phone />

      {/* Mesa con el QR */}
      <g>
        <ellipse cx="590" cy="502" rx="70" ry="8" fill={C.shadow} />
        <rect x="583" y="392" width="14" height="108" rx="7" fill={C.tableDark} />
        <ellipse cx="590" cy="496" rx="36" ry="7" fill={C.tableDark} />
        <ellipse cx="590" cy="388" rx="104" ry="18" fill={C.table} />
        <g transform="translate(628 352)">
          <path d="M 0 30 L 6 0 L 24 0 L 30 30 Z" fill="#fffaf3" stroke={C.tableDark} strokeWidth="2" />
          <g fill={C.qr}>
            <rect x="9" y="6" width="5" height="5" />
            <rect x="16" y="6" width="5" height="5" />
            <rect x="9" y="13" width="5" height="5" />
            <rect x="17" y="14" width="3" height="3" />
            <rect x="12" y="20" width="6" height="4" />
          </g>
        </g>
        {served > 0 && <IceCream x={mix(630, 568, served)} y={mix(318, 380, served)} scale={mix(0.9, 1, served)} />}
      </g>

      {/* Escaneo: haz de luz del celular al QR */}
      {scanning && (
        <path d="M 520 300 L 640 360 L 652 382 L 524 318 Z" fill={C.glow} opacity={0.55}>
          <animate attributeName="opacity" values="0.25;0.7;0.25" dur="1.2s" repeatCount="indefinite" />
        </path>
      )}

      {/* La carta abierta en el celular */}
      {menu > 0 && (
        <g transform={`translate(520 ${mix(190, 150, menu)})`} opacity={menu}>
          <rect x="0" y="0" width="130" height="150" rx="18" fill="#ffffff" stroke="#ece4d8" strokeWidth="2" />
          <rect x="16" y="18" width="60" height="9" rx="4.5" fill="#cfe9df" />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(16 ${42 + i * 30})`}>
              <rect width="20" height="20" rx="6" fill={[C.scoop1, C.scoop2, C.scoop3][i]} />
              <rect x="28" y="4" width="54" height="6" rx="3" fill="#e9e1d6" />
              <rect x="28" y="13" width="32" height="5" rx="2.5" fill="#f1ebe2" />
            </g>
          ))}
          <rect x="16" y="128" width="98" height="12" rx="6" fill="#7cbfa8" />
        </g>
      )}

      {/* Mozo */}
      <Person
        x={waiterX}
        sit={0}
        stride={waiterX}
        walking={(wIn > 0 && wIn < 1) || (wOut > 0 && wOut < 1)}
        arm={leaving ? 0 : 0.55}
        facing={leaving ? 1 : -1}
        body={C.waiter}
        legs={C.waiterLegs}
        apron={C.waiterApron}
        tray={!leaving}
      />
      {wIn > 0 && served === 0 && <IceCream x={waiterX - 46} y={318} scale={0.9} />}

      {/* Burbuja del mozo */}
      {served > 0.5 && !leaving && (
        <g transform="translate(700 210)" opacity={seg(p, 0.76, 0.8)}>
          <rect x="0" y="0" width="150" height="44" rx="22" fill="#ffffff" stroke="#ece4d8" strokeWidth="2" />
          <path d="M 30 44 L 22 58 L 46 44 Z" fill="#ffffff" />
          <text x="75" y="28" textAnchor="middle" fontSize="16" fontFamily="inherit" fill="#3f3a4f">¡Acá está!</text>
        </g>
      )}

      {/* Final: corazoncitos sobre el invitado */}
      {happy > 0 &&
        [0, 1, 2].map((i) => (
          <path
            key={i}
            transform={`translate(${470 + i * 22 - 22} ${mix(300, 250 - i * 14, happy)}) scale(${0.8 + i * 0.1})`}
            opacity={happy * (1 - i * 0.2)}
            d="M 0 4 C -6 -4 -14 2 0 12 C 14 2 6 -4 0 4 Z"
            fill={C.waiterApron}
          />
        ))}
      </g>
    </svg>
  );
}

export function ScrollStory({ steps }: { steps: { title: React.ReactNode; text: React.ReactNode; extra?: React.ReactNode }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      setP(total > 0 ? clamp(-r.top / total) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const mq = window.matchMedia("(min-width: 768px)");
    const onMq = () => setWide(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      mq.removeEventListener("change", onMq);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Escena fija: en celular arriba; en compu ocupa todo el fondo y el texto va a los costados. */}
      <div className="pointer-events-none sticky top-16 z-0 h-[46svh] md:h-[calc(100svh-4rem)]">
        <div className="mx-auto h-full max-w-6xl px-2 md:px-6">
          <Scene p={p} pan={wide} />
        </div>
      </div>
      <div className="relative z-10 -mt-[46svh] md:-mt-[calc(100svh-4rem)]">
        {steps.map((s, i) => (
          <section key={i} className="flex min-h-[100svh] items-end px-4 pb-10 pt-[48svh] sm:px-6 md:items-center md:pb-0 md:pt-0">
            <div className={`mx-auto w-full max-w-6xl ${i % 2 ? "md:flex md:justify-end" : ""}`}>
              <div className="max-w-md rounded-3xl bg-[#fbf7f1]/85 p-6 backdrop-blur-sm md:p-8">
                {s.title}
                <div className="mt-4 text-lg leading-relaxed text-[#6b6577]">{s.text}</div>
                {s.extra}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
