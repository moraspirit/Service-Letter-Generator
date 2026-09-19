import type { CertificateData, FieldSchema } from "@moraspirit/shared";
import { prisma } from "@/lib/db";
import { PageOverflowError, renderCertificatePdf } from "@/lib/pdf/render-pdf";
import { requireAdminApi } from "@/lib/require-admin";
import { UUID_PATTERN } from "@/lib/verify-url";

export const dynamic = "force-dynamic";

/**
 * Re-renders the PDF from the stored data and the pinned template version on every
 * request; no PDF is ever stored. The one-page rule runs again here, so a certificate
 * can never silently start overflowing.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi();
  if (admin instanceof Response) return admin;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return Response.json({ error: "Not found" }, { status: 404 });

  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: { templateVersion: true },
  });
  if (!certificate) return Response.json({ error: "Not found" }, { status: 404 });

  const data = certificate.data as unknown as CertificateData;
  try {
    const pdf = await renderCertificatePdf({
      certificateId: certificate.id,
      templateVersion: {
        htmlContent: certificate.templateVersion.htmlContent,
        fieldSchema: certificate.templateVersion.fieldSchema as unknown as FieldSchema,
      },
      data,
    });

    // The member id is the only thing in the file name; never a recipient's name.
    const member = typeof data.member_id === "string" ? data.member_id : "";
    const name = /^[A-Za-z0-9_-]{1,40}$/.test(member) ? member : certificate.id;
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${name}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PageOverflowError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    // Log the class only: messages can contain recipient details.
    console.error("PDF render failed:", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "The PDF could not be rendered." }, { status: 500 });
  }
}
