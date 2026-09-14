import { beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { decryptToken, encryptToken } from "./crypto";

beforeEach(() => {
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("encryptToken / decryptToken", () => {
  it("round-trips a plaintext token", () => {
    const encrypted = encryptToken("EAABsomeFacebookAccessToken123");
    expect(encrypted).not.toContain("EAAB");
    expect(decryptToken(encrypted)).toBe("EAABsomeFacebookAccessToken123");
  });

  it("produces different ciphertext for the same plaintext each time", () => {
    const a = encryptToken("same-token");
    const b = encryptToken("same-token");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("same-token");
    expect(decryptToken(b)).toBe("same-token");
  });

  it("throws on a tampered ciphertext", () => {
    const encrypted = encryptToken("a-token");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tampered = [iv, authTag, Buffer.from("tampered").toString("base64")].join(":");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("throws when the encryption key is missing", () => {
    delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken("a-token")).toThrow("SOCIAL_TOKEN_ENCRYPTION_KEY is not set");
  });

  it("throws when the encryption key is the wrong length", () => {
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
    expect(() => encryptToken("a-token")).toThrow("32 bytes");
  });
});
