import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../lib/password";

describe("password hashing", () => {
  it("uses argon2id and verifies only the right password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(stored.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(stored, "correct horse battery staple")).toBe(true);
    expect(await verifyPassword(stored, "wrong password entirely")).toBe(false);
  });

  it("rejects empty and oversized input and unknown accounts without throwing", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(stored, "")).toBe(false);
    expect(await verifyPassword(stored, "x".repeat(5000))).toBe(false);
    expect(await verifyPassword(null, "anything at all")).toBe(false);
  });
});
