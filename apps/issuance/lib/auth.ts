import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { clientIp } from "./client-ip";
import { prisma } from "./db";
import { isLockedOut, normalizeEmail, purgeOldAttempts, recordFailure } from "./login-rate-limit";
import { verifyPassword } from "./password";

declare module "next-auth" {
  interface Session {
    user: { id: string; email: string };
  }
}

/** Every failure mode (unknown email, wrong password, throttled) looks identical to the client. */
class GenericLoginError extends CredentialsSignin {
  code = "invalid_credentials";
}

export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Behind our own reverse proxy in production (Phase 8); AUTH_URL is set there.
  trustHost: true,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const email =
          typeof credentials?.email === "string" ? normalizeEmail(credentials.email) : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const ip = clientIp(request.headers);

        await purgeOldAttempts(prisma);

        if (email && (await isLockedOut(prisma, email, ip))) {
          await verifyPassword(null, password); // same cost as a real attempt
          throw new GenericLoginError();
        }

        const admin = email ? await prisma.adminUser.findUnique({ where: { email } }) : null;
        const ok = await verifyPassword(admin?.passwordHash ?? null, password);
        if (!admin || !ok) {
          if (email) await recordFailure(prisma, email, ip);
          throw new GenericLoginError();
        }
        return { id: String(admin.id), email: admin.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.uid ?? "");
      return session;
    },
  },
});
