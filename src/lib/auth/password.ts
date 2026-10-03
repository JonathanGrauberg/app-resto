import "server-only";
import bcrypt from "bcryptjs";

export function hashSecret(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function verifySecret(plain: string, hash: string | null | undefined) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash);
}
