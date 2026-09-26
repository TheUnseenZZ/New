import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeForm, uniqueSlug } from "@/lib/forms";
import { slugify } from "@/lib/id";
import { formSchemaValidator } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  const form = await db.form.findUnique({ where: { id } });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeForm(form));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { title?: string; slug?: string; draft?: unknown };
  const data: { title?: string; slug?: string; draft?: string } = {};

  if (typeof body.title === "string") data.title = body.title.trim().slice(0, 120) || "Untitled form";
  if (typeof body.slug === "string") {
    const wanted = slugify(body.slug);
    if (!wanted) return NextResponse.json({ error: "Link can't be empty" }, { status: 400 });
    const taken = await db.form.findUnique({ where: { slug: wanted }, select: { id: true } });
    if (taken && taken.id !== id) return NextResponse.json({ error: "That link is already taken" }, { status: 409 });
    data.slug = await uniqueSlug(wanted, id);
  }
  if (body.draft !== undefined) {
    const parsed = formSchemaValidator.safeParse(body.draft);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid form", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
    }
    data.draft = JSON.stringify(parsed.data);
  }
  try {
    const form = await db.form.update({ where: { id }, data });
    return NextResponse.json(serializeForm(form));
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  await db.form.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
