/**
 * Fondo de YouTube para la pantalla del Muro: acepta enlaces de video, shorts o listas.
 * Devuelve la URL del reproductor embebido (youtube-nocookie, sin controles, en loop),
 * o null si no es un enlace de YouTube.
 */
export function youtubeEmbed(url: string | null | undefined, opts: { muted: boolean }) {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (!["youtube.com", "youtu.be", "music.youtube.com", "youtube-nocookie.com"].includes(host)) return null;
  const list = u.searchParams.get("list");
  let video: string | null = null;
  if (host === "youtu.be") video = u.pathname.slice(1);
  else if (u.pathname === "/watch") video = u.searchParams.get("v");
  else {
    const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/);
    video = m?.[1] ?? null;
  }
  if (video && !/^[\w-]{6,20}$/.test(video)) video = null;
  if (list && !/^[\w-]{10,64}$/.test(list)) return null;
  if (!video && !list) return null;

  const params = new URLSearchParams({
    autoplay: "1",
    mute: opts.muted ? "1" : "0",
    controls: "0",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    loop: "1",
    iv_load_policy: "3",
    disablekb: "1",
  });
  if (list) {
    params.set("list", list);
    return `https://www.youtube-nocookie.com/embed/${video ?? "videoseries"}?${params}`;
  }
  // Para que un solo video se repita, YouTube pide pasarlo también como "playlist".
  params.set("playlist", video!);
  return `https://www.youtube-nocookie.com/embed/${video}?${params}`;
}

export const isYoutubeUrl = (url: string) => youtubeEmbed(url, { muted: true }) !== null;
