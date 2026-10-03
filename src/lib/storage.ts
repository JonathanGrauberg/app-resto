import "server-only";
import { randomBytes } from "node:crypto";
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Almacenamiento de imágenes en Cloudflare R2 (API compatible con S3).
 * Las fotos se suben directo desde el navegador con una URL firmada de corta duración:
 * nunca pasan por nuestro servidor.
 */

export const IMAGE_KINDS = ["product", "cover", "logo", "share"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

/** Formatos aceptados (el navegador comprime a WebP; JPEG si el navegador no sabe codificar WebP). */
export const IMAGE_TYPES = { "image/webp": "webp", "image/jpeg": "jpg" } as const;
export type ImageType = keyof typeof IMAGE_TYPES;

/** El navegador ya comprime; esto es el límite duro por archivo. */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const env = () => {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL, R2_JURISDICTION } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) {
    throw new Error("Faltan variables R2_* en el entorno");
  }
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    publicUrl: R2_PUBLIC_URL.replace(/\/$/, ""),
    // Bucket con jurisdicción UE: usa el endpoint específico `*.eu.r2...`.
    host: R2_JURISDICTION === "eu" ? "eu.r2.cloudflarestorage.com" : "r2.cloudflarestorage.com",
  };
};

export function storageConfigured() {
  try {
    env();
    return true;
  } catch {
    return false;
  }
}

let client: S3Client | null = null;
function s3() {
  const e = env();
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${e.accountId}.${e.host}`,
    credentials: { accessKeyId: e.accessKeyId, secretAccessKey: e.secretAccessKey },
  });
  return client;
}

/** Prefijo de todas las imágenes de un tenant: impide usar claves de otro local. */
const tenantPrefix = (tenantId: string) => `t/${tenantId}/`;

export function publicImageUrl(key: string) {
  return `${env().publicUrl}/${key}`;
}

/** Clave de R2 a partir de una URL pública nuestra (null si es externa). */
export function keyFromUrl(url: string | null | undefined) {
  if (!url) return null;
  const base = env().publicUrl + "/";
  return url.startsWith(base) ? url.slice(base.length) : null;
}

/** URL firmada para subir UNA imagen de tipo y tamaño exactos (válida 5 minutos). */
export async function createImageUpload(tenantId: string, kind: ImageKind, size: number, type: ImageType) {
  const key = `${tenantPrefix(tenantId)}${kind}/${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${IMAGE_TYPES[type]}`;
  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: env().bucket,
      Key: key,
      ContentType: type,
      // Firmar el tamaño evita que se use la URL para subir otra cosa más grande.
      ContentLength: size,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn: 300 },
  );
  return { key, uploadUrl, publicUrl: publicImageUrl(key) };
}

/**
 * Valida una clave recibida de un formulario: debe ser del tenant y existir en R2.
 * Devuelve la URL pública lista para guardar en la base.
 */
export async function confirmImage(tenantId: string, key: string) {
  if (!key.startsWith(tenantPrefix(tenantId)) || key.includes("..")) return null;
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: env().bucket, Key: key }));
    if ((head.ContentLength ?? 0) > MAX_IMAGE_BYTES) return null;
    return publicImageUrl(key);
  } catch {
    return null;
  }
}

/** Borra una imagen nuestra (best effort: un fallo no debe romper el guardado). */
export async function deleteImageByUrl(tenantId: string, url: string | null | undefined) {
  const key = keyFromUrl(url);
  if (!key || !key.startsWith(tenantPrefix(tenantId))) return;
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: env().bucket, Key: key }));
  } catch (err) {
    console.warn("No se pudo borrar la imagen", key, err);
  }
}
