import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadCryptoModule = async () => {
  process.env.MESSAGE_KEK_B64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  process.env.MESSAGE_KEK_ID = "primary-v1";
  process.env.HEALTH_TOKEN = "test-health-token";
  delete process.env.MESSAGE_KEK_MAP_JSON;
  vi.resetModules();
  return import("../../src/security/messageCrypto");
};

describe("messageCrypto", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("wrap/unwrap DEK roundtrip", async () => {
    const { generateDek, wrapDek, unwrapDek } = await loadCryptoModule();
    const dek = generateDek();

    const wrapped = wrapDek(dek);
    const unwrapped = unwrapDek(wrapped.dekWrappedB64, wrapped.kekId);

    expect(unwrapped.equals(dek)).toBe(true);
  });

  it("encrypt/decrypt text roundtrip", async () => {
    const { encryptText, decryptText } = await loadCryptoModule();
    const dek = crypto.randomBytes(32);
    const plainText = "hello encrypted world";

    const encrypted = encryptText(plainText, dek);
    const decrypted = decryptText(encrypted, dek);

    expect(decrypted).toBe(plainText);
  });

  it("tampered ciphertext fails decrypt", async () => {
    const { encryptText, decryptText } = await loadCryptoModule();
    const dek = crypto.randomBytes(32);
    const encrypted = encryptText("tamper test", dek);

    const tamperedBuffer = Buffer.from(encrypted.cipherTextB64, "base64");
    tamperedBuffer[0] = tamperedBuffer[0] ^ 0xff;

    expect(() =>
      decryptText(
        {
          ...encrypted,
          cipherTextB64: tamperedBuffer.toString("base64"),
        },
        dek
      )
    ).toThrow();
  });
});
