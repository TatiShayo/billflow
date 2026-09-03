import { describe, it, expect } from "vitest";
import { generatePayToken } from "./pay-token";

describe("generatePayToken — Cryptographic Token Generator", () => {
  it("generates a 64-character hexadecimal token (32 bytes entropy)", () => {
    const token = generatePayToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBe(64);
  });

  it("contains only valid lowercase hexadecimal characters", () => {
    const token = generatePayToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens without collisions across 100 consecutive calls", () => {
    const tokens = new Set<string>();
    const count = 100;

    for (let i = 0; i < count; i++) {
      const token = generatePayToken();
      expect(token.length).toBe(64);
      tokens.add(token);
    }

    expect(tokens.size).toBe(count);
  });

  it("produces high entropy character distribution", () => {
    const token = generatePayToken();
    const uniqueChars = new Set(token.split(""));
    // A random 64-char hex string almost always contains at least 8 distinct hex characters
    expect(uniqueChars.size).toBeGreaterThanOrEqual(8);
  });
});
