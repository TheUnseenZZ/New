import type { Form } from "@prisma/client";
import { db } from "./db";
import { slugId, slugify } from "./id";
import { parseSchema } from "./validate";

export async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "form";
  let candidate = root;
  for (let i = 0; i < 20; i++) {
    const existing = await db.form.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${root}-${slugId()}`;
  }
  return `${root}-${slugId()}-${slugId()}`;
}

export function serializeForm(f: Form) {
  return {
    id: f.id,
    title: f.title,
    slug: f.slug,
    draft: parseSchema(f.draft),
    isPublished: !!f.published,
    hasUnpublishedChanges: !!f.published && f.published !== f.draft,
    publishedAt: f.publishedAt?.toISOString() ?? null,
    updatedAt: f.updatedAt.toISOString(),
    createdAt: f.createdAt.toISOString(),
  };
}

export type SerializedForm = ReturnType<typeof serializeForm>;
