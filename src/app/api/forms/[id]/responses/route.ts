import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slugify } from "@/lib/id";
import { allQuestions, serializeResponse, toCsv } from "@/lib/responses";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const form = await db.form.findUnique({ where: { id } });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const responses = await db.response.findMany({ where: { formId: id }, orderBy: { createdAt: "desc" } });
  const questions = allQuestions(form);

  if (new URL(req.url).searchParams.get("format") === "csv") {
    return new NextResponse(toCsv(responses, questions), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slugify(form.title) || "leads"}-leads.csv"`,
      },
    });
  }
  return NextResponse.json(responses.map((r) => serializeResponse(r, questions)));
}
