import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeForm } from "@/lib/forms";
import { parseSchema } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Publishes the current draft to the public link. */
export async function POST(_: Request, { params }: Ctx) {
  const { id } = await params;
  const form = await db.form.findUnique({ where: { id } });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const schema = parseSchema(form.draft);
  if (!schema.questions.length) {
    return NextResponse.json({ error: "Add at least one question before publishing" }, { status: 400 });
  }
  const updated = await db.form.update({ where: { id }, data: { published: form.draft, publishedAt: new Date() } });
  return NextResponse.json(serializeForm(updated));
}

/** Takes the form offline. */
export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  const updated = await db.form.update({ where: { id }, data: { published: null, publishedAt: null } });
  return NextResponse.json(serializeForm(updated));
}
