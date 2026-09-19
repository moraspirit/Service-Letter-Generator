// pnpm templates:publish — run on deploy and after editing a template.
import { loadAllTemplates } from "@moraspirit/certificate-templates";
import { createPrismaClient } from "@moraspirit/db";
import { publishTemplates, TemplateSafetyError } from "../lib/publish-templates";

async function main() {
  const prisma = createPrismaClient({ connectionLimit: 2 });
  try {
    const outcomes = await publishTemplates(prisma, loadAllTemplates());
    for (const o of outcomes) {
      console.log(`${o.status.padEnd(9)} ${o.slug} (version ${o.versionNumber})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof TemplateSafetyError ? error.message : error);
  process.exitCode = 1;
});
