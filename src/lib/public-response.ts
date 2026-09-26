import { db } from "./db";
import { leadFields, simulate, statusForEnding } from "./engine";
import { sanitizeAnswers } from "./responses";
import type { FormSchema } from "./types";

/** Recomputes score, outcome and lead fields server-side from the raw answers. */
export function evaluate(schema: FormSchema, rawAnswers: unknown, rawPath: unknown, complete: boolean) {
  const answers = sanitizeAnswers(schema, rawAnswers);
  const known = new Set(schema.questions.map((q) => q.id));
  const path = Array.isArray(rawPath) ? [...new Set(rawPath.map(String).filter((id) => known.has(id)))] : [];
  const sim = simulate(schema, answers);
  const fields = leadFields(schema, answers);
  const finished = complete && sim.ending !== null;
  return {
    answers: JSON.stringify(answers),
    path: JSON.stringify(path),
    score: sim.score,
    status: finished ? statusForEnding(sim.ending) : "partial",
    endingId: finished ? sim.ending!.id : null,
    completedAt: finished ? new Date() : null,
    name: fields.name ?? null,
    email: fields.email ?? null,
    phone: fields.phone ?? null,
    company: fields.company ?? null,
  };
}

export async function publishedForm(slug: string) {
  const form = await db.form.findUnique({ where: { slug }, select: { id: true, published: true } });
  if (!form?.published) return null;
  return { id: form.id, schema: JSON.parse(form.published) as FormSchema };
}
