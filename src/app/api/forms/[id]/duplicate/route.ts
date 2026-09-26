import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeForm, uniqueSlug } from "@/lib/forms";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Ctx) {
  const { id } = await params;
  const form = await db.form.findUnique({ where: { id } });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const title = `${form.title} (copy)`;
  const copy = await db.form.create({ data: { title, slug: await uniqueSlug(title), draft: form.draft } });
  return NextResponse.json(serializeForm(copy), { status: 201 });
}
