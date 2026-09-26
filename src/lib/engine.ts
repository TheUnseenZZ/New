import type {
  Answer,
  Answers,
  Ending,
  FormSchema,
  LeadField,
  LogicOperator,
  LogicRule,
  Question,
  QuestionType,
  ResponseStatus,
} from "./types";

/* ------------------------------------------------------------------ */
/* Question metadata                                                   */
/* ------------------------------------------------------------------ */

export const QUESTION_TYPES: { type: QuestionType; label: string; hint: string }[] = [
  { type: "short_text", label: "Short text", hint: "Names, companies, one-liners" },
  { type: "long_text", label: "Long text", hint: "Open-ended context" },
  { type: "email", label: "Email", hint: "Validated email address" },
  { type: "phone", label: "Phone", hint: "Phone number" },
  { type: "website", label: "Website", hint: "Validated URL" },
  { type: "number", label: "Number", hint: "Budget, team size, revenue" },
  { type: "multiple_choice", label: "Multiple choice", hint: "Scored options" },
  { type: "yes_no", label: "Yes / No", hint: "Binary qualifier" },
  { type: "rating", label: "Opinion scale", hint: "1–5 or 1–10" },
  { type: "statement", label: "Statement", hint: "Text only, no answer" },
];

export function typeLabel(type: QuestionType) {
  return QUESTION_TYPES.find((t) => t.type === type)?.label ?? type;
}

export function operatorsFor(q: Question): { op: LogicOperator; label: string; needsValue: boolean }[] {
  switch (q.type) {
    case "multiple_choice":
      return [
        { op: "is", label: q.allowMultiple ? "includes" : "is", needsValue: true },
        { op: "is_not", label: q.allowMultiple ? "does not include" : "is not", needsValue: true },
      ];
    case "yes_no":
      return [{ op: "is", label: "is", needsValue: true }];
    case "number":
    case "rating":
      return [
        { op: "eq", label: "=", needsValue: true },
        { op: "neq", label: "≠", needsValue: true },
        { op: "gt", label: ">", needsValue: true },
        { op: "gte", label: "≥", needsValue: true },
        { op: "lt", label: "<", needsValue: true },
        { op: "lte", label: "≤", needsValue: true },
        { op: "answered", label: "is answered", needsValue: false },
        { op: "not_answered", label: "is skipped", needsValue: false },
      ];
    case "statement":
      return [];
    default:
      return [
        { op: "is", label: "is", needsValue: true },
        { op: "is_not", label: "is not", needsValue: true },
        { op: "contains", label: "contains", needsValue: true },
        { op: "not_contains", label: "does not contain", needsValue: true },
        { op: "answered", label: "is answered", needsValue: false },
        { op: "not_answered", label: "is skipped", needsValue: false },
      ];
  }
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i;
const PHONE_RE = /^\+?[\d\s().-]{6,20}$/;

export function isEmpty(a: Answer | undefined | null) {
  if (a === undefined || a === null) return true;
  if (typeof a === "string") return a.trim() === "";
  if (Array.isArray(a)) return a.length === 0;
  return false;
}

/** Returns an error message or null when the answer is acceptable. */
export function validateAnswer(q: Question, a: Answer | undefined): string | null {
  if (q.type === "statement") return null;
  if (isEmpty(a)) return q.required ? "Please fill this in" : null;
  switch (q.type) {
    case "email":
      return EMAIL_RE.test(String(a).trim()) ? null : "Hmm, that email doesn't look right";
    case "website":
      return URL_RE.test(String(a).trim()) ? null : "Please enter a valid URL";
    case "phone":
      return PHONE_RE.test(String(a).trim()) ? null : "Please enter a valid phone number";
    case "number": {
      const n = Number(a);
      if (!Number.isFinite(n)) return "Please enter a number";
      if (q.min !== undefined && q.min !== null && n < q.min) return `Must be at least ${q.min}`;
      if (q.max !== undefined && q.max !== null && n > q.max) return `Must be at most ${q.max}`;
      return null;
    }
    case "multiple_choice": {
      const ids = new Set((q.choices ?? []).map((c) => c.id));
      const vals = Array.isArray(a) ? a : [String(a)];
      return vals.every((v) => ids.has(v)) ? null : "Please choose a valid option";
    }
    case "rating": {
      const n = Number(a);
      return Number.isInteger(n) && n >= 1 && n <= (q.ratingMax ?? 10) ? null : "Please choose a value";
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export function questionScore(q: Question, a: Answer | undefined): number {
  if (isEmpty(a)) return 0;
  switch (q.type) {
    case "multiple_choice": {
      const vals = Array.isArray(a) ? a : [String(a)];
      return (q.choices ?? []).filter((c) => vals.includes(c.id)).reduce((s, c) => s + (c.score || 0), 0);
    }
    case "yes_no":
      return a === true || a === "yes" ? q.yesScore ?? 0 : q.noScore ?? 0;
    case "rating":
      return Math.round(Number(a) * (q.ratingWeight ?? 0));
    default:
      return 0;
  }
}

export function computeScore(schema: FormSchema, answers: Answers, path?: string[]): number {
  const visible = path ? new Set(path) : null;
  return schema.questions.reduce(
    (sum, q) => (visible && !visible.has(q.id) ? sum : sum + questionScore(q, answers[q.id])),
    0,
  );
}

/** Highest score reachable — helps pick a sensible threshold in the builder. */
export function maxScore(schema: FormSchema): number {
  return schema.questions.reduce((sum, q) => {
    switch (q.type) {
      case "multiple_choice": {
        const scores = (q.choices ?? []).map((c) => c.score || 0);
        if (!scores.length) return sum;
        return sum + (q.allowMultiple ? scores.filter((s) => s > 0).reduce((a, b) => a + b, 0) : Math.max(...scores));
      }
      case "yes_no":
        return sum + Math.max(q.yesScore ?? 0, q.noScore ?? 0);
      case "rating":
        return sum + Math.max(0, (q.ratingMax ?? 10) * (q.ratingWeight ?? 0));
      default:
        return sum;
    }
  }, 0);
}

/* ------------------------------------------------------------------ */
/* Conditional logic & routing                                         */
/* ------------------------------------------------------------------ */

function norm(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

export function ruleMatches(q: Question, rule: LogicRule, a: Answer | undefined): boolean {
  if (rule.op === "answered") return !isEmpty(a);
  if (rule.op === "not_answered") return isEmpty(a);
  if (isEmpty(a)) return false;

  if (q.type === "multiple_choice") {
    const vals = Array.isArray(a) ? a : [String(a)];
    const has = vals.includes(rule.value);
    return rule.op === "is" ? has : rule.op === "is_not" ? !has : false;
  }
  if (q.type === "yes_no") {
    const yes = a === true || a === "yes";
    return rule.value === "yes" ? yes : !yes;
  }
  if (q.type === "number" || q.type === "rating") {
    const n = Number(a);
    const v = Number(rule.value);
    if (!Number.isFinite(n) || !Number.isFinite(v)) return false;
    switch (rule.op) {
      case "eq": return n === v;
      case "neq": return n !== v;
      case "gt": return n > v;
      case "gte": return n >= v;
      case "lt": return n < v;
      case "lte": return n <= v;
      default: return false;
    }
  }
  const s = norm(a);
  const v = norm(rule.value);
  switch (rule.op) {
    case "is": return s === v;
    case "is_not": return s !== v;
    case "contains": return s.includes(v);
    case "not_contains": return !s.includes(v);
    default: return false;
  }
}

export type Step = { kind: "question"; id: string } | { kind: "ending"; id: string };

/** Picks the ending shown when the respondent runs out of questions. */
export function resolveEnding(schema: FormSchema, score: number): Ending {
  const { endings, settings } = schema;
  if (settings.scoringEnabled) {
    const kind = score >= settings.threshold ? "qualified" : "disqualified";
    const match = endings.find((e) => e.kind === kind);
    if (match) return match;
  }
  return endings.find((e) => e.kind === "default") ?? endings.find((e) => e.kind === "qualified") ?? endings[0];
}

/** Where to go after answering `questionId`. */
export function nextStep(schema: FormSchema, questionId: string, answers: Answers, path: string[]): Step {
  const idx = schema.questions.findIndex((q) => q.id === questionId);
  const q = schema.questions[idx];
  if (q) {
    for (const rule of q.logic ?? []) {
      if (!ruleMatches(q, rule, answers[q.id])) continue;
      if (schema.questions.some((x) => x.id === rule.target)) return { kind: "question", id: rule.target };
      if (schema.endings.some((x) => x.id === rule.target)) return { kind: "ending", id: rule.target };
    }
  }
  const next = schema.questions[idx + 1];
  if (next) return { kind: "question", id: next.id };
  const ending = resolveEnding(schema, computeScore(schema, answers, [...path, questionId]));
  return { kind: "ending", id: ending.id };
}

/**
 * Replays the respondent's path from the first question using only the answers.
 * The server uses this to decide the outcome instead of trusting the client.
 */
export function simulate(schema: FormSchema, answers: Answers): { path: string[]; ending: Ending | null; score: number } {
  const path: string[] = [];
  let current: Step | null = schema.questions[0] ? { kind: "question", id: schema.questions[0].id } : null;
  const limit = schema.questions.length * 3 + 5;
  while (current && current.kind === "question" && path.length < limit) {
    const q = schema.questions.find((x) => x.id === current!.id);
    if (!q) break;
    // Stop where the respondent stopped: required but unanswered.
    if (q.type !== "statement" && q.required && isEmpty(answers[q.id])) {
      return { path, ending: null, score: computeScore(schema, answers, path) };
    }
    if (path.includes(q.id)) break; // logic loop — bail out to default routing
    path.push(q.id);
    current = nextStep(schema, q.id, answers, path.slice(0, -1));
  }
  const score = computeScore(schema, answers, path);
  const ending =
    current && current.kind === "ending"
      ? schema.endings.find((e) => e.id === current!.id) ?? resolveEnding(schema, score)
      : resolveEnding(schema, score);
  return { path, ending, score };
}

export function statusForEnding(ending: Ending | null): ResponseStatus {
  if (!ending) return "partial";
  if (ending.kind === "qualified") return "qualified";
  if (ending.kind === "disqualified") return "disqualified";
  return "completed";
}

/* ------------------------------------------------------------------ */
/* Lead fields & recall                                                */
/* ------------------------------------------------------------------ */

export function formatAnswer(q: Question, a: Answer | undefined): string {
  if (isEmpty(a)) return "";
  if (q.type === "multiple_choice") {
    const vals = Array.isArray(a) ? a : [String(a)];
    return vals.map((v) => q.choices?.find((c) => c.id === v)?.label ?? v).join(", ");
  }
  if (q.type === "yes_no") return a === true || a === "yes" ? "Yes" : "No";
  return String(a);
}

export function leadFields(schema: FormSchema, answers: Answers): Partial<Record<LeadField, string>> {
  const out: Partial<Record<LeadField, string>> = {};
  for (const q of schema.questions) {
    if (q.leadField && !out[q.leadField]) {
      const v = formatAnswer(q, answers[q.id]);
      if (v) out[q.leadField] = v;
    }
  }
  // Fall back to the first email/phone question if not explicitly mapped.
  for (const q of schema.questions) {
    if (!out.email && q.type === "email" && answers[q.id]) out.email = String(answers[q.id]);
    if (!out.phone && q.type === "phone" && answers[q.id]) out.phone = String(answers[q.id]);
  }
  return out;
}

/** Replaces {name}, {email}, {phone}, {company} with the respondent's answers. */
export function recall(text: string, fields: Partial<Record<LeadField, string>>): string {
  let missing = false;
  const out = text.replace(/\{(name|email|phone|company)\}/g, (_, k: LeadField) => {
    const v = (fields[k] ?? "").trim();
    if (!v) missing = true;
    return k === "name" ? v.split(/\s+/)[0] : v;
  });
  if (!missing) return out;
  // Tidy up "Thanks, ." → "Thanks." when the recalled answer is empty.
  return out
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Booking embeds                                                      */
/* ------------------------------------------------------------------ */

/** Builds an embeddable calendar URL for Calendly / Cal.com, prefilled with the lead's details. */
export function calendarEmbedUrl(raw: string, fields: Partial<Record<LeadField, string>>, host?: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (fields.name) url.searchParams.set("name", fields.name);
  if (fields.email) url.searchParams.set("email", fields.email);
  if (url.hostname.includes("calendly.com")) {
    if (host) url.searchParams.set("embed_domain", host);
    url.searchParams.set("embed_type", "Inline");
    url.searchParams.set("hide_gdpr_banner", "1");
    url.searchParams.set("background_color", "ffffff");
  } else if (url.hostname.includes("cal.com")) {
    // Cal.com serves its iframe-friendly booking page under /embed.
    if (!url.pathname.endsWith("/embed")) url.pathname = `${url.pathname.replace(/\/$/, "")}/embed`;
    url.searchParams.set("embed", "");
    url.searchParams.set("embedType", "inline");
    url.searchParams.set("layout", "month_view");
  }
  return url.toString();
}
