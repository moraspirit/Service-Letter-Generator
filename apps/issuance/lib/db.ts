import { getPrisma } from "@moraspirit/db";

/** The issuance app's database client (connects as app_rw). */
export const prisma = getPrisma();
