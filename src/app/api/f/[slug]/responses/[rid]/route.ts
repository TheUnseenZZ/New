import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluate, publishedForm } from "@/lib/public-response";

type Ctx = { params: Promise<{ slug: string; rid: string }> };

/** Saves progress as the respondent moves through the form. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { slug, rid } = await params;
  const form = await publishedForm(slug);
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const existing = await db.response.findUnique({ where: { id: rid }, select: { formId: true, completedAt: true } });
  if (!existing || existing.formId !== form.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.completedAt) return NextResponse.json({ error: "Already submitted" }, { status: 409 });

  const body = (await req.json().catch(() => ({}))) as {
    answers?: unknown;
    path?: unknown;
    lastStepId?: string;
    complete?: boolean;
  };
  const updated = await db.response.update({
    where: { id: rid },
    data: { ...evaluate(form.schema, body.answers, body.path, !!body.complete), lastStepId: body.lastStepId?.slice(0, 40) ?? null },
    select: { id: true, status: true },
  });
  return NextResponse.json(updated);
}
