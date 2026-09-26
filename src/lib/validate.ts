import { z } from "zod";
import type { FormSchema } from "./types";

const logicRule = z.object({
  id: z.string(),
  op: z.enum(["is", "is_not", "contains", "not_contains", "eq", "neq", "gt", "gte", "lt", "lte", "answered", "not_answered"]),
  value: z.string().max(500),
  target: z.string(),
});

const question = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(["short_text", "long_text", "email", "phone", "number", "website", "multiple_choice", "yes_no", "rating", "statement"]),
  title: z.string().max(500),
  description: z.string().max(2000).optional(),
  required: z.boolean(),
  placeholder: z.string().max(200).optional(),
  buttonLabel: z.string().max(60).optional(),
  choices: z.array(z.object({ id: z.string(), label: z.string().max(300), score: z.number() })).max(50).optional(),
  allowMultiple: z.boolean().optional(),
  ratingMax: z.union([z.literal(5), z.literal(10)]).optional(),
  ratingLabels: z.object({ low: z.string().max(60).optional(), high: z.string().max(60).optional() }).optional(),
  ratingWeight: z.number().optional(),
  yesScore: z.number().optional(),
  noScore: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  leadField: z.enum(["name", "email", "phone", "company"]).nullable().optional(),
  logic: z.array(logicRule).max(50),
});

const ending = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(["qualified", "disqualified", "default"]),
  title: z.string().max(500),
  description: z.string().max(2000).optional(),
  showCalendar: z.boolean(),
  buttonLabel: z.string().max(60).optional(),
  buttonUrl: z.string().max(2000).optional(),
  redirectUrl: z.string().max(2000).optional(),
});

export const formSchemaValidator = z.object({
  version: z.literal(1),
  welcome: z.object({
    enabled: z.boolean(),
    title: z.string().max(500),
    description: z.string().max(2000).optional(),
    buttonLabel: z.string().max(60),
    timeToComplete: z.string().max(60).optional(),
  }),
  questions: z.array(question).max(100),
  endings: z.array(ending).min(1).max(20),
  theme: z.object({
    preset: z.enum(["onyx", "graphite", "midnight", "ivory"]),
    accent: z.string().max(20),
    font: z.enum(["sans", "editorial", "mono"]),
    logoUrl: z.string().max(2000).optional(),
    glow: z.boolean(),
  }),
  settings: z.object({
    scoringEnabled: z.boolean(),
    threshold: z.number(),
    calendarUrl: z.string().max(2000).optional(),
    showProgress: z.boolean(),
    showQuestionNumbers: z.boolean(),
    metaTitle: z.string().max(200).optional(),
    metaDescription: z.string().max(500).optional(),
  }),
}) satisfies z.ZodType<FormSchema>;

export function parseSchema(json: string): FormSchema {
  return JSON.parse(json) as FormSchema;
}
