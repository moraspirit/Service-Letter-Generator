// Database-backed login throttling (architecture §9). Failures live in the
// login_attempts table, not in memory, so they survive restarts and redeploys.
import type { PrismaClient } from "@moraspirit/db";

export const MAX_FAILED_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;
/** Rows older than this are purged; the window itself only looks back 15 minutes. */
const RETENTION_MS = 24 * 60 * 60 * 1000;

export const normalizeEmail = (email: string) => email.trim().toLowerCase().slice(0, 255);

/** True when this email + IP pair already has MAX_FAILED_ATTEMPTS failures inside the window. */
export async function isLockedOut(
  prisma: PrismaClient,
  email: string,
  ip: string,
  now: Date = new Date(),
): Promise<boolean> {
  const failures = await prisma.loginAttempt.count({
    where: {
      email: normalizeEmail(email),
      ipAddress: ip,
      attemptedAt: { gt: new Date(now.getTime() - WINDOW_MS) },
    },
  });
  return failures >= MAX_FAILED_ATTEMPTS;
}

/**
 * Records one failed attempt. Callers must not record while locked out: refused
 * attempts do not extend the block, so it ends when the oldest failures age out.
 */
export async function recordFailure(
  prisma: PrismaClient,
  email: string,
  ip: string,
  now: Date = new Date(),
): Promise<void> {
  await prisma.loginAttempt.create({
    data: { email: normalizeEmail(email), ipAddress: ip, attemptedAt: now },
  });
}

/** Deletes attempts past the retention period. Cheap; called on every login. */
export async function purgeOldAttempts(prisma: PrismaClient, now: Date = new Date()) {
  await prisma.loginAttempt.deleteMany({
    where: { attemptedAt: { lt: new Date(now.getTime() - RETENTION_MS) } },
  });
}
