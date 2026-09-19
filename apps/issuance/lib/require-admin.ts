// The second layer of the session guard (the first is proxy.ts). Proxy only
// checks the signed cookie; this also confirms the admin still exists, so
// deleting an admin_users row ends that person's access immediately.
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./db";

export interface AdminIdentity {
  id: number;
  email: string;
}

async function currentAdmin(): Promise<AdminIdentity | null> {
  const session = await auth();
  const id = Number(session?.user?.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.adminUser.findUnique({ where: { id }, select: { id: true, email: true } });
}

/** For pages, layouts and Server Actions: redirects to /login when there is no valid admin. */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");
  return admin;
}

/** For route handlers: returns the admin, or a 401 Response to return as-is. */
export async function requireAdminApi(): Promise<AdminIdentity | Response> {
  const admin = await currentAdmin();
  return admin ?? Response.json({ error: "Unauthorized" }, { status: 401 });
}
