import type { Form, Response } from "@prisma/client";
import { formatAnswer, isEmpty, validateAnswer } from "./engine";
import type { Answer, Answers, FormSchema, Question } from "./types";
import { parseSchema } from "./validate";

/** Keeps only valid answers to questions that exist in the schema. */
export function sanitizeAnswers(schema: FormSchema, input: unknown): Answers {
  const out: Answers = {};
  if (!input || typeof input !== "object") return out;
  for (const q of schema.questions) {
    const raw = (input as Record<string, unknown>)[q.id];
    if (raw === undefined || q.type === "statement") continue;
    let a: Answer;
    if (q.type === "multiple_choice") {
      a = Array.isArray(raw) ? raw.map(String).slice(0, 50) : [String(raw)];
    } else if (q.type === "yes_no") {
      a = raw === true || raw === "yes" ? "yes" : "no";
    } else if (q.type === "number" || q.type === "rating") {
      a = Number(raw);
    } else {
      a = String(raw).slice(0, 5000);
    }
    if (!isEmpty(a) && validateAnswer(q, a) === null) out[q.id] = a;
  }
  return out;
}

/** All questions a response might reference: the published version first, then the draft. */
export function allQuestions(form: Pick<Form, "draft" | "published">): Question[] {
  const seen = new Map<string, Question>();
  for (const json of [form.draft, form.published]) {
    if (!json) continue;
    for (const q of parseSchema(json).questions) if (!seen.has(q.id)) seen.set(q.id, q);
  }
  return [...seen.values()].filter((q) => q.type !== "statement");
}

export function serializeResponse(r: Response, questions: Question[]) {
  const answers = JSON.parse(r.answers) as Answers;
  return {
    id: r.id,
    status: r.status,
    score: r.score,
    name: r.name,
    email: r.email,
    phone: r.phone,
    company: r.company,
    referrer: r.referrer,
    utm: r.utm ? (JSON.parse(r.utm) as Record<string, string>) : null,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    answers: questions
      .filter((q) => answers[q.id] !== undefined)
      .map((q) => ({ id: q.id, title: q.title, value: formatAnswer(q, answers[q.id]) })),
  };
}

export type SerializedResponse = ReturnType<typeof serializeResponse>;

function csvCell(v: unknown) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(responses: Response[], questions: Question[]) {
  const header = ["Submitted", "Status", "Score", "Name", "Email", "Phone", "Company", ...questions.map((q) => q.title)];
  const rows = responses.map((r) => {
    const answers = JSON.parse(r.answers) as Answers;
    return [
      (r.completedAt ?? r.createdAt).toISOString(),
      r.status,
      r.score,
      r.name,
      r.email,
      r.phone,
      r.company,
      ...questions.map((q) => formatAnswer(q, answers[q.id])),
    ];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
