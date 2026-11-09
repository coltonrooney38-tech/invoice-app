import { cookies } from "next/headers";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { pdfFileName, renderInvoicePdf } from "@/invoice/InvoicePdf";
import { InvoiceInputSchema } from "@/invoice/schema";

// Renders the exact PDF the client will receive, for the preview modal.
export async function POST(request: Request) {
  if (!(await isValidToken((await cookies()).get(AUTH_COOKIE)?.value))) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  const parsed = InvoiceInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join(" · ") },
      { status: 400 },
    );
  }
  const pdf = await renderInvoicePdf(parsed.data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfFileName(parsed.data)}"`,
      "Cache-Control": "no-store",
    },
  });
}
