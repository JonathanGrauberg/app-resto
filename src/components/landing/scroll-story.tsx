"use client";

import { useEffect, useRef, useState } from "react";
import { TornEdge } from "./torn-edge";

/**
 * Historia de la landing que avanza con el scroll (ilustración 2D en SVG, fija mientras pasan los textos):
 * 0 la mesa vacía · 1 llega y se sienta · 2 escanea el QR · 3 el mozo le trae el pedido · 4 la cuenta
 * · 5 chatea con la mesa de al lado · 6 la noche sigue en el boliche, con la pantalla gigante y los "me gusta".
 * El tiempo `t` va de 0 a la cantidad de pasos − 1: cada paso coincide con su sección.
 */

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
/** Avance 0→1 de un tramo [a, b] de la historia. */
const seg = (t: number, a: number, b: number) => ease(clamp((t - a) / (b - a)));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** Bandas de la landing (verde Yatay profundo / crema), color del texto y del antetítulo en cada una. */
export const BANDS = ["#1f4038", "#f3ead9"] as const;
const TEXT = ["#f3ead9", "#1f3a33"];
const KICKER = ["#f2a48c", "#00806a"];

/** Paleta de Yatay de noche: verde profundo, el verde del logo y una luz cálida de restaurante. */
const C = {
  floor: "rgba(0,0,0,0.14)",
  shadow: "rgba(0,0,0,0.16)",
  table: "#8b6a4e",
  tableDark: "#6b513c",
  chair: "#6f9c8c",
  chairDark: "#5b8a7b",
  skin: "#e0b08c",
  skin2: "#c98f6b",
  hair: "#16121c",
  hair2: "#6b3f24",
  guest: "#3ccfa4",
  guestLegs: "#24364c",
  friend: "#f2b24c",
  friend2: "#e57f9a",
  waiter: "#e9ece8",
  waiterApron: "#00806a",
  waiterLegs: "#16121c",
  phone: "#0d1411",
  glow: "#9ff0d6",
  qr: "#0d1411",
  plate: "#eef1ee",
  food: "#c9773f",
  greens: "#4f9d6b",
  wine: "#7a1f35",
  heart: "#ff6f91",
};

type PersonProps = {
  x: number;
  y?: number;
  /** 0 = de pie, 1 = sentado. */
  sit?: number;
  /** Distancia recorrida: mueve las piernas al caminar. */
  stride?: number;
  walking?: boolean;
  /** 0 = brazo abajo, 1 = brazo levantado hacia adelante. */
  arm?: number;
  facing?: 1 | -1;
  body: string;
  legs: string;
  skin?: string;
  hair?: string;
  apron?: string;
  phone?: boolean;
  /** Bandeja con lo que lleva el mozo. */
  carry?: React.ReactNode;
  /** Rebote al bailar (px). */
  bounce?: number;
  scale?: number;
};

/** Figura abstracta: cabeza, torso redondeado, piernas y un brazo. Origen en los pies. */
function Person({ x, y = 500, sit = 0, stride = 0, walking = false, arm = 0, facing = 1, body, legs, skin = C.skin, hair = C.hair, apron, phone, carry, bounce = 0, scale = 1 }: PersonProps) {
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
  const bob = (walking ? Math.abs(Math.sin(stride / 14)) * -3 : 0) - bounce;
  const shoulder = { x: 4, y: torsoTop + 22 };
  const elbow = { x: mix(10, 30, arm), y: mix(torsoTop + 52, torsoTop + 40, arm) };
  const hand = { x: mix(12 + swing * 6, 54, arm), y: mix(torsoTop + 82, torsoTop + 26, arm) };

  return (
    <g transform={`translate(${x} ${y}) scale(${facing * scale} ${scale})`}>
      <ellipse cx={sit ? 20 : 0} cy="2" rx="40" ry="7" fill={C.shadow} />
      <g transform={`translate(0 ${bob})`}>
        <path d={leg(-1)} stroke={legs} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={leg(1)} stroke={legs} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="-23" y={torsoTop} width="46" height="98" rx="23" fill={body} stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
        {apron && <rect x="-19" y={torsoTop + 46} width="38" height="50" rx="10" fill={apron} />}
        <circle cx="2" cy={torsoTop - 26} r="23" fill={skin} />
        <path d={`M -21 ${torsoTop - 28} a 23 23 0 0 1 44 -6 q -14 -4 -30 6 z`} fill={hair} />
        {carry && (
          <g transform={`translate(${hand.x + 12} ${hand.y - 4})`}>
            <rect x="-36" y="0" width="72" height="6" rx="3" fill="#b9c4bf" />
            <g transform="translate(-6 0)">{carry}</g>
          </g>
        )}
        <path
          d={`M ${shoulder.x} ${shoulder.y} L ${elbow.x} ${elbow.y} L ${hand.x} ${hand.y}`}
          stroke={body === C.waiter ? "#d6dbd7" : body}
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
      </g>
    </g>
  );
}

/** Plato con comida y una copa de vino. Origen: donde apoya el plato. */
function Dish({ x = 0, y = 0, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="-4" rx="26" ry="7" fill={C.plate} />
      <ellipse cx="-4" cy="-9" rx="13" ry="5.5" fill={C.food} />
      <circle cx="8" cy="-10" r="3.5" fill={C.greens} />
      <circle cx="12" cy="-7" r="2.5" fill={C.greens} />
      <g transform="translate(34 -2)">
        <path d="M -7 -30 Q 0 -14 7 -30 Z" fill={C.wine} />
        <path d="M -8 -32 Q 0 -9 8 -32" stroke={C.plate} strokeWidth="2" fill="none" opacity="0.7" />
        <rect x="-1" y="-18" width="2" height="16" fill={C.plate} opacity="0.8" />
        <ellipse cx="0" cy="-1" rx="6" ry="2" fill={C.plate} opacity="0.8" />
      </g>
    </g>
  );
}

function Chair({ x, flip = false, scale = 1 }: { x: number; flip?: boolean; scale?: number }) {
  return (
    <g transform={`translate(${x} 500) scale(${(flip ? -1 : 1) * scale} ${scale})`}>
      <ellipse cx="0" cy="2" rx="38" ry="6" fill={C.shadow} />
      <rect x="-32" y="-82" width="64" height="12" rx="6" fill={C.chair} />
      <rect x="-32" y="-170" width="12" height="100" rx="6" fill={C.chairDark} />
      <rect x="-26" y="-72" width="9" height="72" rx="4" fill={C.chairDark} />
      <rect x="18" y="-72" width="9" height="72" rx="4" fill={C.chairDark} />
    </g>
  );
}

function Table({ x, scale = 1, children }: { x: number; scale?: number; children?: React.ReactNode }) {
  return (
    <g transform={`translate(${x} 500) scale(${scale})`}>
      <ellipse cx="0" cy="2" rx="70" ry="8" fill={C.shadow} />
      <rect x="-7" y="-108" width="14" height="108" rx="7" fill={C.tableDark} />
      <ellipse cx="0" cy="-4" rx="36" ry="7" fill={C.tableDark} />
      <ellipse cx="0" cy="-112" rx="104" ry="18" fill={C.table} />
      {children}
    </g>
  );
}

/** Cartelito con el QR de la mesa. `lit` 0→1: se ilumina mientras lo escanean. */
function QrStand({ lit }: { lit: number }) {
  return (
    <g transform="translate(38 -148)">
      {lit > 0 && (
        <circle cx="15" cy="16" r="34" fill={C.glow} opacity={0.35 * lit}>
          <animate attributeName="r" values="26;38;26" dur="1.4s" repeatCount="indefinite" />
        </circle>
      )}
      <path d="M 0 30 L 6 0 L 24 0 L 30 30 Z" fill={lit > 0.5 ? "#ffffff" : "#f4f1ea"} stroke={lit > 0 ? C.glow : C.tableDark} strokeWidth="2" />
      <g fill={C.qr}>
        <rect x="9" y="6" width="5" height="5" />
        <rect x="16" y="6" width="5" height="5" />
        <rect x="9" y="13" width="5" height="5" />
        <rect x="17" y="14" width="3" height="3" />
        <rect x="12" y="20" width="6" height="4" />
      </g>
    </g>
  );
}

/** Algo que viaja en arco de A a B (mensajes entre mesas, "me gusta" a la pantalla). */
function Fly({ t, a, b, from, to, arc = -70, children }: { t: number; a: number; b: number; from: [number, number]; to: [number, number]; arc?: number; children: React.ReactNode }) {
  if (t < a || t > b) return null;
  const k = clamp((t - a) / (b - a));
  const x = mix(from[0], to[0], k);
  const y = mix(from[1], to[1], k) + arc * 4 * k * (1 - k);
  return (
    <g transform={`translate(${x} ${y}) scale(${0.7 + 0.5 * Math.sin(Math.PI * k)})`} opacity={k > 0.85 ? (1 - k) / 0.15 : 1}>
      {children}
    </g>
  );
}

const Bubble = () => (
  <g>
    <rect x="-16" y="-11" width="32" height="22" rx="11" fill="#eef4f1" />
    <circle cx="-7" cy="0" r="2.2" fill="#0b1512" />
    <circle cx="0" cy="0" r="2.2" fill="#0b1512" />
    <circle cx="7" cy="0" r="2.2" fill="#0b1512" />
  </g>
);
const Heart = ({ fill = C.heart }: { fill?: string }) => <path d="M 0 -3 C -7 -12 -16 -3 0 9 C 16 -3 7 -12 0 -3 Z" fill={fill} />;

/**
 * Desplazamiento de la escena en cada paso (compu): lejos del texto de esa sección.
 * Texto a la izquierda en los pasos pares → escena a la derecha (+); impares → a la izquierda (−).
 * En el paso 5 se ven las dos mesas, así que la escena se corre menos.
 */
const PAN = [150, -230, 150, -230, 150, -90, 150];

function Scene({ t, pan }: { t: number; pan: boolean }) {
  // ── Restaurante ────────────────────────────────────────────
  const walkIn = seg(t, 0.12, 0.76);
  const sit = seg(t, 0.76, 1.04);
  const guestX = mix(mix(-260, 432, walkIn), 462, sit);
  // Celular: para escanear (paso 2) y para chatear con la otra mesa (paso 5).
  const raise = Math.max(seg(t, 1.2, 1.48) * (1 - seg(t, 2.4, 2.64)), seg(t, 4.5, 4.75) * (1 - seg(t, 5.4, 5.6)));
  const qrLit = seg(t, 1.55, 1.75) * (1 - seg(t, 2.3, 2.5));
  const menu = seg(t, 1.84, 2.08) * (1 - seg(t, 2.4, 2.56));
  // Mozo: entra con la bandeja, deja el plato, se va.
  const wIn = seg(t, 2.4, 2.84);
  const wOut = seg(t, 3.36, 3.8);
  const waiterX = mix(mix(1320, 676, wIn), 1320, wOut);
  const served = seg(t, 2.96, 3.16);
  const leaving = t > 3.36;
  // La cuenta (paso 4): un ticket con tilde sobre la mesa.
  const bill = seg(t, 3.7, 3.95) * (1 - seg(t, 4.4, 4.6));
  // Mesa de al lado (paso 5).
  const friends = seg(t, 4.2, 4.6);
  const friendsArm = seg(t, 4.55, 4.8) * (1 - seg(t, 5.4, 5.6));
  // ── Boliche (paso 6) ──────────────────────────────────────
  const club = seg(t, 5.35, 5.8);
  const likes = Math.round(mix(0, 128, seg(t, 5.65, 5.92)));

  // En compu la cámara se corre al lado contrario del texto de cada sección (zigzag).
  const i = Math.min(PAN.length - 2, Math.floor(t));
  const shift = pan ? mix(PAN[i], PAN[i + 1], ease(clamp(t - i))) : -60;
  // En celular se encuadra la escena; desde la mesa de al lado se abre para que entren las dos.
  const wide = seg(t, 4.2, 4.8) * (1 - seg(t, 5.35, 5.8));
  const view = pan ? "0 0 1000 600" : `${mix(290, -20, wide)} 150 ${mix(520, 720, wide)} ${mix(380, 450, wide)}`;
  const dance = (i: number) => Math.abs(Math.sin(t * 9 + i * 1.3)) * 10;

  return (
    <svg viewBox={view} className="size-full" role="img" aria-label="Una persona llega a una mesa, escanea el QR, el mozo le trae el pedido, chatea con la mesa de al lado y la noche sigue en un boliche con pantalla gigante">
      {/* Boliche: haces de luz planos que barren la escena. */}
      {club > 0 && (
        <g opacity={club * 0.22}>
          <path d={`M 500 0 L ${330 + Math.sin(t * 6) * 140} 520 L ${430 + Math.sin(t * 6) * 140} 520 Z`} fill="#c98bff" />
          <path d={`M 500 0 L ${640 + Math.cos(t * 5) * 140} 520 L ${740 + Math.cos(t * 5) * 140} 520 Z`} fill="#5fe1d0" />
          <path d={`M 500 0 L ${180 + Math.cos(t * 7) * 90} 520 L ${260 + Math.cos(t * 7) * 90} 520 Z`} fill="#f2b24c" />
        </g>
      )}
      <path d="M 40 500 Q 300 494 520 499 T 960 500" stroke={C.floor} strokeWidth="4" strokeLinecap="round" fill="none" />

      <g transform={`translate(${shift} 0)`}>
        {/* ── Restaurante ── */}
        <g opacity={1 - club}>
          <Chair x={470} />
          <Person x={guestX} sit={sit} stride={guestX} walking={walkIn > 0 && walkIn < 1} arm={raise} body={C.guest} legs={C.guestLegs} phone />
          <Table x={590}>
            <QrStand lit={qrLit} />
            {served > 0 && <Dish x={mix(40, -22, served)} y={mix(-127, -112, served)} />}
            {bill > 0 && (
              <g transform="translate(-70 -118)" opacity={bill}>
                <rect x="-12" y={-26 * bill} width="24" height="30" rx="3" fill="#ffffff" />
                <path d={`M -5 ${-12 * bill} l 4 4 l 7 -9`} stroke={C.waiterApron} strokeWidth="3" fill="none" strokeLinecap="round" />
              </g>
            )}
          </Table>

          {/* La carta abierta en el celular, al lado de la cabeza */}
          {menu > 0 && (
            <g transform={`translate(520 ${mix(190, 150, menu)})`} opacity={menu}>
              <rect x="0" y="0" width="130" height="150" rx="18" fill="#14231e" stroke="#2b4a40" strokeWidth="2" />
              <rect x="16" y="18" width="60" height="9" rx="4.5" fill="#3ccfa4" />
              {[0, 1, 2].map((i) => (
                <g key={i} transform={`translate(16 ${42 + i * 30})`}>
                  <rect width="20" height="20" rx="6" fill={[C.food, C.greens, C.wine][i]} />
                  <rect x="28" y="4" width="54" height="6" rx="3" fill="#2f4a41" />
                  <rect x="28" y="13" width="32" height="5" rx="2.5" fill="#23382f" />
                </g>
              ))}
              <rect x="16" y="128" width="98" height="12" rx="6" fill="#00806a" />
            </g>
          )}

          {/* Mozo con la bandeja */}
          <Person
            x={waiterX}
            stride={waiterX}
            walking={(wIn > 0 && wIn < 1) || (wOut > 0 && wOut < 1)}
            arm={leaving ? 0 : 0.55}
            facing={leaving ? 1 : -1}
            body={C.waiter}
            legs={C.waiterLegs}
            apron={C.waiterApron}
            carry={!leaving && served === 0 ? <Dish /> : !leaving ? <g /> : undefined}
          />
          {served > 0.5 && !leaving && (
            <g transform="translate(640 196)" opacity={seg(t, 3.04, 3.2)}>
              <rect x="0" y="0" width="178" height="44" rx="22" fill="#eef4f1" />
              <path d="M 120 44 L 132 58 L 140 44 Z" fill="#eef4f1" />
              <text x="89" y="28" textAnchor="middle" fontSize="16" fontFamily="inherit" fill="#0b1512">¡Que lo disfrutes!</text>
            </g>
          )}

          {/* Mesa de al lado (a la izquierda, un poco más atrás): dos amigas que también tienen el chat */}
          {friends > 0 && (
            <g opacity={friends}>
              <Chair x={100} scale={0.82} />
              <Person x={93} sit={1} body={C.friend2} legs="#3a2a4c" scale={0.82} />
              <Chair x={160} scale={0.82} />
              <Person x={153} sit={1} arm={friendsArm} body={C.friend} legs={C.guestLegs} skin={C.skin2} hair={C.hair2} phone scale={0.82} />
              <Table x={262} scale={0.82} />
            </g>
          )}
          {/* Mensajes que van y vienen entre las dos mesas */}
          {[4.8, 4.98, 5.16].map((a, i) => (
            <Fly key={a} t={t} a={a} b={a + 0.22} from={i % 2 ? [200, 350] : [522, 330]} to={i % 2 ? [522, 330] : [200, 350]} arc={-90}>
              <Bubble />
            </Fly>
          ))}
        </g>

        {/* ── Boliche ── */}
        {club > 0 && (
          <g opacity={club}>
            {/* Pantalla gigante */}
            <g transform="translate(330 70)">
              <rect x="0" y="0" width="340" height="190" rx="14" fill="#0b0f14" stroke="#2c2f3d" strokeWidth="6" />
              {[0, 1, 2].map((i) => (
                <g key={i} transform={`translate(20 ${24 + i * 46})`} opacity={seg(t, 5.6 + i * 0.1, 5.75 + i * 0.1)}>
                  <rect width="200" height="34" rx="10" fill={["#1f2a3a", "#2a1f3a", "#1f3a33"][i]} />
                  <rect x="12" y="10" width={[120, 90, 140][i]} height="7" rx="3.5" fill="#e9ecf2" opacity="0.85" />
                  <rect x="12" y="21" width={[60, 80, 50][i]} height="5" rx="2.5" fill="#9aa3b5" />
                </g>
              ))}
              <rect x="236" y="24" width="84" height="84" rx="10" fill="#3ccfa4" opacity="0.85" />
              <circle cx="278" cy="58" r="14" fill="#0b1512" opacity="0.5" />
              <path d="M 252 100 q 26 -30 52 0 z" fill="#0b1512" opacity="0.5" />
              <g transform="translate(278 150)">
                <Heart />
                <text x="18" y="7" fontSize="22" fontWeight="700" fill="#ffffff" fontFamily="inherit">
                  {likes}
                </text>
              </g>
            </g>
            {/* Gente bailando con el celular en alto */}
            {[
              { x: 250, body: C.guest, legs: C.guestLegs, arm: 1 },
              { x: 380, body: C.friend, legs: C.guestLegs, skin: C.skin2, hair: C.hair2, arm: 0.6 },
              { x: 520, body: "#8fa8ff", legs: "#232a4a", arm: 1 },
              { x: 650, body: C.friend2, legs: "#3a2a4c", arm: 0.8 },
              { x: 780, body: "#e9ece8", legs: C.waiterLegs, arm: 1 },
            ].map((p, i) => (
              <Person key={i} x={p.x} facing={i % 2 ? -1 : 1} arm={p.arm} body={p.body} legs={p.legs} skin={p.skin} hair={p.hair} phone bounce={dance(i)} />
            ))}
            {/* "Me gusta" que suben a la pantalla */}
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const from: [number, number] = [[250, 380, 520, 650, 780, 380][i] + (i % 2 ? -50 : 50), 330];
              const a = 5.65 + i * 0.05;
              return (
                <Fly key={i} t={t} a={a} b={a + 0.25} from={from} to={[600, 220]} arc={-40}>
                  <Heart />
                </Fly>
              );
            })}
          </g>
        )}
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

  // Bandas: pares verde (texto crema), impares crema (texto verde). El texto va sin recuadro.
  const band = (i: number) => BANDS[i % 2];
  const sectionClass = "flex min-h-[100svh] items-end px-4 pb-14 pt-[48svh] sm:px-6 md:items-center md:pb-0 md:pt-0";
  const copyBox = "max-w-md rounded-2xl py-4 md:py-0";
  const inner = (i: number) => `mx-auto w-full max-w-6xl ${i % 2 ? "md:flex md:justify-end" : ""}`;
  const Copy = ({ s: st }: { s: (typeof steps)[number] }) => (
    <>
      {st.title}
      <div className="mt-5 text-lg leading-relaxed opacity-80">{st.text}</div>
      {st.extra}
    </>
  );

  return (
    <div ref={ref} className="relative">
      {/* 1) Fondo: una banda por sección (mismo alto que el texto, que se repite invisible). */}
      <div aria-hidden className="absolute inset-0 z-0">
        {steps.map((st, i) => (
          <section key={i} className={`relative ${sectionClass}`} style={{ background: band(i) }}>
            {i > 0 && <TornEdge color={band(i)} seed={i * 3 + 1} className="absolute inset-x-0 top-0 -translate-y-[70%]" />}
            <div className={`invisible ${inner(i)}`}>
              <div className={copyBox}>
                <Copy s={st} />
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* 2) Escena fija: en celular arriba; en compu ocupa todo el fondo y el texto va a los costados. */}
      <div className="pointer-events-none sticky top-16 z-10 h-[46svh] md:h-[calc(100svh-4rem)]">
        <div className="mx-auto h-full max-w-6xl px-2 md:px-6">
          <Scene t={p * (steps.length - 1)} pan={wide} />
        </div>
      </div>

      {/* 3) Textos. En celular llevan el color de su banda de fondo para no quedar encima del dibujo. */}
      <div className="relative z-20 -mt-[46svh] md:-mt-[calc(100svh-4rem)]">
        {steps.map((st, i) => (
          <section key={i} className={sectionClass} style={{ color: TEXT[i % 2], ["--kicker" as string]: KICKER[i % 2] }}>
            <div className={inner(i)}>
              <div className={copyBox} style={{ background: wide ? undefined : band(i) }}>
                <Copy s={st} />
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
