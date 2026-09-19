// pnpm admin:create — creates an administrator account. There is no public sign-up.
//
// The password is typed at a hidden prompt (twice); it is never accepted as an
// argument or environment variable, so it cannot end up in shell history or logs.
import { createPrismaClient } from "@moraspirit/db";
import { normalizeEmail } from "../lib/login-rate-limit";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../lib/password";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function prompt(question: string, hidden: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error("This command must be run in an interactive terminal."));
      return;
    }
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "") {
          // Ctrl+C
          stdin.setRawMode(false);
          stdout.write("\n");
          process.exit(130);
        }
        if (char === "" || char === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            if (!hidden) stdout.write("\b \b");
          }
          continue;
        }
        value += char;
        if (!hidden) stdout.write(char);
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const email = normalizeEmail(await prompt("Admin email: ", false));
  if (!EMAIL_PATTERN.test(email)) throw new Error("That does not look like an email address.");

  const password = await prompt(`Password (min ${MIN_PASSWORD_LENGTH} characters): `, true);
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if ((await prompt("Repeat password: ", true)) !== password) {
    throw new Error("Passwords do not match.");
  }

  const prisma = createPrismaClient({ connectionLimit: 1 });
  try {
    if (await prisma.adminUser.findUnique({ where: { email } })) {
      throw new Error(`An admin with the email ${email} already exists.`);
    }
    await prisma.adminUser.create({ data: { email, passwordHash: await hashPassword(password) } });
    console.log(`Created admin ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
