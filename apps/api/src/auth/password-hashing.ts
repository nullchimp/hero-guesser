import {
  randomBytes,
  scrypt,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const PASSWORD_HASH_PREFIX = "scrypt";
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString("hex");
  const key = await derivePasswordKey(password, salt);
  return `${PASSWORD_HASH_PREFIX}:${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [prefix, salt, storedKey] = passwordHash.split(":");

  if (prefix !== PASSWORD_HASH_PREFIX || salt === undefined || storedKey === undefined) {
    return false;
  }

  const stored = Buffer.from(storedKey, "hex");
  const candidate = await derivePasswordKey(password, salt);

  if (stored.length !== candidate.length) {
    return false;
  }

  return timingSafeEqual(stored, candidate);
}

async function derivePasswordKey(password: string, salt: string): Promise<Buffer> {
  const key = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH);

  if (!Buffer.isBuffer(key)) {
    throw new Error("Password hashing did not return a buffer.");
  }

  return key;
}
