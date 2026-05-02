"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptText = exports.encryptText = exports.unwrapDek = exports.wrapDek = exports.generateDek = void 0;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const KEK_ID = env_1.env.MESSAGE_KEK_ID;
const KEK_MAP = Object.entries(env_1.env.MESSAGE_KEK_MAP).reduce((acc, [id, base64Key]) => {
    acc[id] = Buffer.from(base64Key, "base64");
    return acc;
}, {});
const PRIMARY_KEK = KEK_MAP[KEK_ID];
if (!PRIMARY_KEK || PRIMARY_KEK.length !== 32) {
    throw new Error(`Primary KEK '${KEK_ID}' is not configured correctly`);
}
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const generateDek = () => crypto_1.default.randomBytes(32);
exports.generateDek = generateDek;
const wrapDek = (dek) => {
    const iv = crypto_1.default.randomBytes(IV_BYTES);
    const cipher = crypto_1.default.createCipheriv(ALGO, PRIMARY_KEK, iv);
    const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const packed = Buffer.concat([iv, ciphertext, authTag]).toString("base64");
    return {
        dekWrappedB64: packed,
        kekId: KEK_ID,
    };
};
exports.wrapDek = wrapDek;
const unwrapDek = (dekWrappedB64, kekId) => {
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
    const decipher = crypto_1.default.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};
exports.unwrapDek = unwrapDek;
const encryptText = (plainText, dek) => {
    const iv = crypto_1.default.randomBytes(IV_BYTES);
    const cipher = crypto_1.default.createCipheriv(ALGO, dek, iv);
    const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
        cipherTextB64: ciphertext.toString("base64"),
        ivB64: iv.toString("base64"),
        authTagB64: authTag.toString("base64"),
        algo: "A256GCM",
    };
};
exports.encryptText = encryptText;
const decryptText = (payload, dek) => {
    const iv = Buffer.from(payload.ivB64, "base64");
    const ciphertext = Buffer.from(payload.cipherTextB64, "base64");
    const authTag = Buffer.from(payload.authTagB64, "base64");
    const decipher = crypto_1.default.createDecipheriv(ALGO, dek, iv);
    decipher.setAuthTag(authTag);
    const plainText = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plainText.toString("utf8");
};
exports.decryptText = decryptText;
