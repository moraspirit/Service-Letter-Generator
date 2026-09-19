import { hash, verify } from "@node-rs/argon2";

// @node-rs/argon2 defaults to argon2id.
export const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 1024;

export const hashPassword = (password: string) => hash(password);

// Verified against when the email is unknown or the account is throttled, so the
// response time does not reveal which emails exist.
let dummyHash: Promise<string> | undefined;

export async function verifyPassword(
  storedHash: string | null,
  password: string,
): Promise<boolean> {
  if (password.length === 0 || password.length > MAX_PASSWORD_LENGTH) return false;
  try {
    if (storedHash) return await verify(storedHash, password);
    dummyHash ??= hash("timing-equalisation-only");
    await verify(await dummyHash, password);
    return false;
  } catch {
    return false;
  }
}
