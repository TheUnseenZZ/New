import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { allQuestions, serializeResponse } from "@/lib/responses";
import { Leads } from "./leads";

type Props = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ params }: Props) {
  const { id } = await params;
  const form = await db.form.findUnique({ where: { id } });
  if (!form) notFound();
  const responses = await db.response.findMany({ where: { formId: id }, orderBy: { createdAt: "desc" }, take: 2000 });
  const questions = allQuestions(form);
  return (
    <Leads
      form={{ id: form.id, title: form.title, slug: form.slug, isPublished: !!form.published }}
      responses={responses.map((r) => serializeResponse(r, questions))}
    />
  );
}
