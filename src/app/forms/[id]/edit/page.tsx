import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Builder } from "@/components/builder/builder";
import { db } from "@/lib/db";
import { serializeForm } from "@/lib/forms";

type Props = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const form = await db.form.findUnique({ where: { id }, select: { title: true } });
  return { title: form?.title ?? "Form" };
}

export default async function EditPage({ params }: Props) {
  const { id } = await params;
  const form = await db.form.findUnique({ where: { id } });
  if (!form) notFound();
  return <Builder initial={serializeForm(form)} />;
}
