import crypto from "crypto";
import { Person } from "../types.js";

// 32-byte encryption key derivation
const getEncryptionKey = (): Buffer => {
  const keyEnv = process.env.ENCRYPTION_KEY;
  if (keyEnv) {
    if (keyEnv.length === 64) {
      return Buffer.from(keyEnv, "hex");
    }
    return crypto.createHash("sha256").update(keyEnv).digest();
  }
  // Fallback derived securely from JWT_SECRET or default secret
  const secret = process.env.JWT_SECRET || "dgmc_dietary_secret_jwt_key_9501";
  return crypto.createHash("sha256").update(secret + "_encryption_salt").digest();
};

const ALGORITHM = "aes-256-gcm";

/**
 * Encrypts a string deterministically using AES-256-GCM.
 * This ensures that the same plaintext always produces the same ciphertext,
 * allowing index scans and exact match queries in databases.
 */
export function encryptDeterministic(text: string | null | undefined): string {
  if (text === null || text === undefined) return "";
  try {
    const key = getEncryptionKey();
    // Derive a 12-byte IV deterministically from the key and the text itself
    const iv = crypto.createHmac("sha256", key).update(text).digest().slice(0, 12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return `enc_det:${iv.toString("hex")}:${encrypted}:${authTag}`;
  } catch (err) {
    console.error("[SECURITY] Deterministic encryption failed:", err);
    return text;
  }
}

/**
 * Decrypts a string encrypted with either randomized or deterministic AES-256-GCM.
 * Seamlessly passes through unencrypted text for backwards-compatibility.
 */
export function decrypt(cipherText: string | null | undefined): string {
  if (!cipherText) return "";
  if (!cipherText.startsWith("enc:") && !cipherText.startsWith("enc_det:")) {
    return cipherText; // Pass through legacy plain text / hashed values
  }
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 4) {
      return cipherText;
    }
    const iv = Buffer.from(parts[1], "hex");
    const encryptedText = parts[2];
    const authTag = Buffer.from(parts[3], "hex");
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("[SECURITY] Decryption failed, returning input:", err);
    return cipherText;
  }
}

/**
 * Encrypts sensitive fields (PII & password hashes) of a Person object.
 */
export function encryptPerson(p: Person): Person {
  return {
    ...p,
    password: p.password ? encryptDeterministic(p.password) : undefined,
    first_name: encryptDeterministic(p.first_name),
    last_name: encryptDeterministic(p.last_name),
    email: p.email ? encryptDeterministic(p.email) : undefined,
    phone: p.phone ? encryptDeterministic(p.phone) : undefined,
    employee_no: p.employee_no ? encryptDeterministic(p.employee_no) : undefined,
    qr_code: p.qr_code ? encryptDeterministic(p.qr_code) : undefined,
  };
}

/**
 * Decrypts sensitive fields of a Person object.
 */
export function decryptPerson(p: Person): Person {
  return {
    ...p,
    password: p.password ? decrypt(p.password) : undefined,
    first_name: decrypt(p.first_name),
    last_name: decrypt(p.last_name),
    email: p.email ? decrypt(p.email) : undefined,
    phone: p.phone ? decrypt(p.phone) : undefined,
    employee_no: p.employee_no ? decrypt(p.employee_no) : undefined,
    qr_code: p.qr_code ? decrypt(p.qr_code) : undefined,
  };
}

/**
 * Keeps first_name and last_name decrypted, but returns sensitive columns
 * in their raw encrypted state (or encrypts them if they are decrypted).
 */
export function getSensitivePersonFieldsEncrypted(p: Person): Person {
  return {
    ...p,
    first_name: p.first_name ? decrypt(p.first_name) : "",
    last_name: p.last_name ? decrypt(p.last_name) : "",
    email: p.email ? (p.email.startsWith("enc:") || p.email.startsWith("enc_det:") ? p.email : encryptDeterministic(p.email)) : undefined,
    phone: p.phone ? (p.phone.startsWith("enc:") || p.phone.startsWith("enc_det:") ? p.phone : encryptDeterministic(p.phone)) : undefined,
    employee_no: p.employee_no ? (p.employee_no.startsWith("enc:") || p.employee_no.startsWith("enc_det:") ? p.employee_no : encryptDeterministic(p.employee_no)) : undefined,
    qr_code: p.qr_code ? (p.qr_code.startsWith("enc:") || p.qr_code.startsWith("enc_det:") ? p.qr_code : encryptDeterministic(p.qr_code)) : undefined,
  };
}

/**
 * Recursively inspects any object or array, automatically decrypting
 * any string fields that start with "enc:" or "enc_det:".
 */
export function decryptAny(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    if (obj.startsWith("enc:") || obj.startsWith("enc_det:")) {
      return decrypt(obj);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => decryptAny(item));
  }
  if (typeof obj === "object") {
    const decryptedObj: any = {};
    for (const key of Object.keys(obj)) {
      decryptedObj[key] = decryptAny(obj[key]);
    }
    return decryptedObj;
  }
  return obj;
}
