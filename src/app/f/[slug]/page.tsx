import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { FormRunner } from "@/components/form/runner";
import { db } from "@/lib/db";
import type { FormSchema } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

const load = cache(async (slug: string) => {
  const form = await db.form.findUnique({ where: { slug }, select: { title: true, published: true } });
  if (!form?.published) return null;
  return { title: form.title, schema: JSON.parse(form.published) as FormSchema };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const form = await load(slug);
  if (!form) return { title: "Form not found" };
  const title = form.schema.settings.metaTitle || form.schema.welcome.title || form.title;
  const description = form.schema.settings.metaDescription || form.schema.welcome.description;
  return { title: { absolute: title }, description, openGraph: { title, description }, robots: { index: false } };
}

export default async function PublicFormPage({ params }: Props) {
  const { slug } = await params;
  const form = await load(slug);
  if (!form) notFound();
  return <FormRunner schema={form.schema} mode="live" slug={slug} />;
}
