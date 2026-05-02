import crypto from "crypto";
import { env } from "../config/env";

const KEK_ID = env.MESSAGE_KEK_ID;
const KEK_MAP = Object.entries(env.MESSAGE_KEK_MAP).reduce<Record<string, Buffer>>(
  (acc, [id, base64Key]) => {
    acc[id] = Buffer.from(base64Key, "base64");
    return acc;
  },
  {}
);

const PRIMARY_KEK = KEK_MAP[KEK_ID];
if (!PRIMARY_KEK || PRIMARY_KEK.length !== 32) {
  throw new Error(`Primary KEK '${KEK_ID}' is not configured correctly`);
}

export type WrappedDek = {
  dekWrappedB64: string;
  kekId: string;
};

export type EncPayload = {
  cipherTextB64: string;
  ivB64: string;
  authTagB64: string;
  algo: "A256GCM";
};

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export const generateDek = () => crypto.randomBytes(32);

export const wrapDek = (dek: Buffer): WrappedDek => {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, PRIMARY_KEK, iv);
  const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const packed = Buffer.concat([iv, ciphertext, authTag]).toString("base64");
  return {
    dekWrappedB64: packed,
    kekId: KEK_ID,
  };
};

export const unwrapDek = (dekWrappedB64: string, kekId?: string | null): Buffer => {
  const selectedKekId = (kekId ?? KEK_ID).trim();
  const key = KEK_MAP[selectedKekId];
  if (!key) {
    throw new Error(`KEK '${selectedKekId}' not found in MESSAGE_KEK_MAP`);
  }

  const packed = Buffer.from(dekWrappedB64, "base64");
  if (packed.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error("Invalid wrapped DEK payload");
  }

  const iv = packed.subarray(0, IV_BYTES);
  const authTag = packed.subarray(packed.length - TAG_BYTES);
  const ciphertext = packed.subarray(IV_BYTES, packed.length - TAG_BYTES);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

export const encryptText = (plainText: string, dek: Buffer): EncPayload => {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, dek, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    cipherTextB64: ciphertext.toString("base64"),
    ivB64: iv.toString("base64"),
    authTagB64: authTag.toString("base64"),
    algo: "A256GCM",
  };
};

export const decryptText = (payload: EncPayload, dek: Buffer): string => {
  const iv = Buffer.from(payload.ivB64, "base64");
  const ciphertext = Buffer.from(payload.cipherTextB64, "base64");
  const authTag = Buffer.from(payload.authTagB64, "base64");

  const decipher = crypto.createDecipheriv(ALGO, dek, iv);
  decipher.setAuthTag(authTag);
  const plainText = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plainText.toString("utf8");
};
