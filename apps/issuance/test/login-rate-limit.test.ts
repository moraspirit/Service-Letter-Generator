import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@moraspirit/db";
import "./env";
import {
  isLockedOut,
  MAX_FAILED_ATTEMPTS,
  purgeOldAttempts,
  recordFailure,
  WINDOW_MS,
} from "../lib/login-rate-limit";

let prisma: PrismaClient;
const email = `ratelimit-${randomBytes(4).toString("hex")}@example.test`;
const ip = "203.0.113.7";
const minutes = (n: number) => n * 60 * 1000;

beforeAll(() => {
  prisma = createPrismaClient({ connectionLimit: 2 });
});

afterAll(async () => {
  await prisma.loginAttempt.deleteMany({ where: { email: { contains: "ratelimit-" } } });
  await prisma.$disconnect();
});

describe("login rate limit", () => {
  it("allows 5 failures, blocks the 6th attempt, and the block expires", async () => {
    const t0 = new Date();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      expect(await isLockedOut(prisma, email, ip, t0)).toBe(false);
      await recordFailure(prisma, email, ip, t0);
    }
    // Sixth attempt: refused.
    expect(await isLockedOut(prisma, email, ip, t0)).toBe(true);
    // Still refused just inside the window.
    expect(await isLockedOut(prisma, email, ip, new Date(t0.getTime() + WINDOW_MS - 1000))).toBe(
      true,
    );
    // Block has expired once the failures are older than 15 minutes.
    expect(await isLockedOut(prisma, email, ip, new Date(t0.getTime() + WINDOW_MS + 1000))).toBe(
      false,
    );
  });

  it("is keyed on email + IP, and case-insensitive on the email", async () => {
    expect(await isLockedOut(prisma, email.toUpperCase(), ip)).toBe(true);
    expect(await isLockedOut(prisma, email, "198.51.100.9")).toBe(false);
    expect(await isLockedOut(prisma, `other-${email}`, ip)).toBe(false);
  });

  it("purges attempts older than a day but keeps recent ones", async () => {
    const oldEmail = `ratelimit-old-${randomBytes(3).toString("hex")}@example.test`;
    await recordFailure(prisma, oldEmail, ip, new Date(Date.now() - minutes(60 * 25)));
    await recordFailure(prisma, oldEmail, ip, new Date());
    await purgeOldAttempts(prisma);
    expect(await prisma.loginAttempt.count({ where: { email: oldEmail } })).toBe(1);
  });
});
