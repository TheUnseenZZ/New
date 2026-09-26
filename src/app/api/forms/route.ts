import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeForm, uniqueSlug } from "@/lib/forms";
import { TEMPLATES } from "@/lib/templates";

export async function GET() {
  const forms = await db.form.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(forms.map(serializeForm));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { template?: string; title?: string };
  const tpl = TEMPLATES.find((t) => t.id === body.template) ?? TEMPLATES[0];
  const title = (body.title || (tpl.id === "blank" ? "Untitled form" : tpl.name)).slice(0, 120);
  const schema = tpl.build();
  const form = await db.form.create({
    data: { title, slug: await uniqueSlug(title), draft: JSON.stringify(schema) },
  });
  return NextResponse.json(serializeForm(form), { status: 201 });
}
