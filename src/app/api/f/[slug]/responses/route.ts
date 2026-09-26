import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluate, publishedForm } from "@/lib/public-response";

type Ctx = { params: Promise<{ slug: string }> };

/** Creates a (partial) response when the respondent answers their first question. */
export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const form = await publishedForm(slug);
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    answers?: unknown;
    path?: unknown;
    lastStepId?: string;
    complete?: boolean;
    referrer?: string;
    utm?: Record<string, string>;
  };
  const utm =
    body.utm && typeof body.utm === "object"
      ? Object.fromEntries(Object.entries(body.utm).slice(0, 10).map(([k, v]) => [k.slice(0, 40), String(v).slice(0, 200)]))
      : null;

  const response = await db.response.create({
    data: {
      formId: form.id,
      ...evaluate(form.schema, body.answers, body.path, !!body.complete),
      lastStepId: body.lastStepId?.slice(0, 40) ?? null,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      referrer: body.referrer?.slice(0, 500) || null,
      utm: utm && Object.keys(utm).length ? JSON.stringify(utm) : null,
    },
    select: { id: true, status: true },
  });
  return NextResponse.json(response, { status: 201 });
}
