export type QuestionType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "website"
  | "multiple_choice"
  | "yes_no"
  | "rating"
  | "statement";

export type LeadField = "name" | "email" | "phone" | "company";

export interface Choice {
  id: string;
  label: string;
  /** Points added to the lead score when this choice is selected. */
  score: number;
}

export type LogicOperator =
  | "is"
  | "is_not"
  | "contains"
  | "not_contains"
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "answered"
  | "not_answered";

export interface LogicRule {
  id: string;
  op: LogicOperator;
  /** Choice id, "yes"/"no", or a free-text/number value depending on the question type. */
  value: string;
  /** Question id or ending id to jump to. */
  target: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  placeholder?: string;
  buttonLabel?: string;
  choices?: Choice[];
  allowMultiple?: boolean;
  ratingMax?: 5 | 10;
  ratingLabels?: { low?: string; high?: string };
  /** Points per rating step (score += value * weight). */
  ratingWeight?: number;
  yesScore?: number;
  noScore?: number;
  min?: number;
  max?: number;
  leadField?: LeadField | null;
  logic: LogicRule[];
}

export type EndingKind = "qualified" | "disqualified" | "default";

export interface Ending {
  id: string;
  kind: EndingKind;
  title: string;
  description?: string;
  /** Show the booking calendar on this screen. */
  showCalendar: boolean;
  buttonLabel?: string;
  buttonUrl?: string;
  /** Automatically redirect after a short delay. */
  redirectUrl?: string;
}

export interface Welcome {
  enabled: boolean;
  title: string;
  description?: string;
  buttonLabel: string;
  timeToComplete?: string;
}

export type ThemePreset = "onyx" | "graphite" | "midnight" | "ivory";
export type ThemeFont = "sans" | "editorial" | "mono";

export interface Theme {
  preset: ThemePreset;
  accent: string;
  font: ThemeFont;
  logoUrl?: string;
  /** Soft radial glow behind the content. */
  glow: boolean;
}

export interface FormSettings {
  scoringEnabled: boolean;
  /** Minimum score to be routed to a "qualified" ending. */
  threshold: number;
  calendarUrl?: string;
  showProgress: boolean;
  showQuestionNumbers: boolean;
  metaTitle?: string;
  metaDescription?: string;
}

export interface FormSchema {
  version: 1;
  welcome: Welcome;
  questions: Question[];
  endings: Ending[];
  theme: Theme;
  settings: FormSettings;
}

export type Answer = string | string[] | number | boolean;
export type Answers = Record<string, Answer>;

export type ResponseStatus = "partial" | "qualified" | "disqualified" | "completed";
