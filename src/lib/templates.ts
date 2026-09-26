import { uid } from "./id";
import type { Choice, Ending, FormSchema, Question, QuestionType } from "./types";

export function newQuestion(type: QuestionType): Question {
  const base: Question = { id: uid(), type, title: "", required: type !== "statement", logic: [] };
  switch (type) {
    case "short_text":
      return { ...base, title: "What's your name?", placeholder: "Type your answer here…" };
    case "long_text":
      return { ...base, title: "Tell us a bit more", placeholder: "Type your answer here…", required: false };
    case "email":
      return { ...base, title: "What's your best email?", placeholder: "name@company.com", leadField: "email" };
    case "phone":
      return { ...base, title: "What's the best number to reach you?", placeholder: "+1 555 000 0000", leadField: "phone" };
    case "website":
      return { ...base, title: "What's your website?", placeholder: "https://" };
    case "number":
      return { ...base, title: "How many people are on your team?", placeholder: "0" };
    case "multiple_choice":
      return {
        ...base,
        title: "Which best describes you?",
        allowMultiple: false,
        choices: [choice("Option A", 0), choice("Option B", 0), choice("Option C", 0)],
      };
    case "yes_no":
      return { ...base, title: "Are you the decision maker?", yesScore: 10, noScore: 0 };
    case "rating":
      return {
        ...base,
        title: "How urgent is solving this for you?",
        ratingMax: 10,
        ratingWeight: 0,
        ratingLabels: { low: "Not urgent", high: "Extremely urgent" },
      };
    case "statement":
      return { ...base, title: "A quick note before we continue", description: "", buttonLabel: "Continue", required: false };
  }
}

export function choice(label: string, score = 0): Choice {
  return { id: uid(), label, score };
}

export function newEnding(kind: Ending["kind"]): Ending {
  if (kind === "qualified") {
    return {
      id: uid(),
      kind,
      title: "You're a great fit, {name}.",
      description: "Pick a time below that works for you and we'll see you on the call.",
      showCalendar: true,
    };
  }
  if (kind === "disqualified") {
    return {
      id: uid(),
      kind,
      title: "Thanks for your interest, {name}.",
      description:
        "Based on your answers we're not the right fit just yet. We've sent a few resources to your inbox that should help in the meantime.",
      showCalendar: false,
    };
  }
  return { id: uid(), kind, title: "Thank you!", description: "We've received your answers and will be in touch shortly.", showCalendar: false };
}

const baseTheme: FormSchema["theme"] = { preset: "onyx", accent: "#ffffff", font: "sans", glow: true };

export function blankSchema(): FormSchema {
  return {
    version: 1,
    welcome: {
      enabled: true,
      title: "Let's see if we're a fit",
      description: "Answer a few quick questions and book a call with our team.",
      buttonLabel: "Start",
      timeToComplete: "Takes 2 minutes",
    },
    questions: [
      { ...newQuestion("short_text"), leadField: "name" },
      newQuestion("email"),
    ],
    endings: [newEnding("qualified"), newEnding("disqualified")],
    theme: { ...baseTheme },
    settings: { scoringEnabled: true, threshold: 0, showProgress: true, showQuestionNumbers: true, calendarUrl: "" },
  };
}

function agencySchema(): FormSchema {
  const name: Question = { ...newQuestion("short_text"), title: "First, what's your name?", leadField: "name" };
  const company: Question = {
    ...newQuestion("short_text"),
    title: "What's the name of your company?",
    placeholder: "Acme Inc.",
    leadField: "company",
  };
  const revenue: Question = {
    ...newQuestion("multiple_choice"),
    title: "What's your current monthly revenue?",
    description: "This helps us tailor the call to your stage.",
    choices: [choice("Under $10k", 0), choice("$10k – $50k", 10), choice("$50k – $250k", 25), choice("$250k+", 35)],
  };
  const budget: Question = {
    ...newQuestion("multiple_choice"),
    title: "What budget have you set aside for this project?",
    choices: [choice("Less than $2,500", 0), choice("$2,500 – $10,000", 15), choice("$10,000 – $25,000", 25), choice("$25,000+", 35)],
  };
  const decision: Question = { ...newQuestion("yes_no"), title: "Are you the one making the final decision?", yesScore: 15, noScore: 0 };
  const timeline: Question = {
    ...newQuestion("multiple_choice"),
    title: "When are you looking to get started?",
    choices: [choice("Immediately", 15), choice("Within 30 days", 10), choice("In 1–3 months", 5), choice("Just exploring", 0)],
  };
  const goal: Question = {
    ...newQuestion("long_text"),
    title: "What's the #1 outcome you'd like from working together?",
    placeholder: "Be as specific as you like…",
  };
  const email: Question = { ...newQuestion("email"), title: "Great to meet you, {name}. What's your best email?" };
  const phone: Question = { ...newQuestion("phone"), required: false, description: "Optional — for a quick reminder text." };

  const qualified = newEnding("qualified");
  const disqualified = newEnding("disqualified");
  // Hard disqualifier: tiny budget skips straight to the disqualified screen.
  budget.logic = [{ id: uid(), op: "is", value: budget.choices![0].id, target: disqualified.id }];

  return {
    ...blankSchema(),
    welcome: {
      enabled: true,
      title: "Let's see if we're the right partner for your growth",
      description: "We work with a small number of clients each quarter. Answer a few questions and, if we're a fit, book a strategy call instantly.",
      buttonLabel: "Apply now",
      timeToComplete: "Takes 2 minutes",
    },
    questions: [name, email, company, revenue, budget, decision, timeline, goal, phone],
    endings: [qualified, disqualified],
    settings: { scoringEnabled: true, threshold: 60, showProgress: true, showQuestionNumbers: true, calendarUrl: "" },
  };
}

function coachingSchema(): FormSchema {
  const name: Question = { ...newQuestion("short_text"), title: "What's your full name?", leadField: "name" };
  const situation: Question = {
    ...newQuestion("multiple_choice"),
    title: "Which best describes where you are right now, {name}?",
    choices: [choice("Just getting started", 0), choice("Growing but stuck", 15), choice("Scaling and need systems", 25)],
  };
  const commitment: Question = {
    ...newQuestion("rating"),
    title: "How committed are you to making a change in the next 90 days?",
    ratingMax: 10,
    ratingWeight: 3,
    ratingLabels: { low: "Curious", high: "All in" },
  };
  const invest: Question = {
    ...newQuestion("yes_no"),
    title: "If we're a fit, are you in a position to invest in yourself right now?",
    description: "Our programs start at $3,000.",
    yesScore: 30,
    noScore: 0,
  };
  const email: Question = { ...newQuestion("email") };
  const qualified = newEnding("qualified");
  const disqualified = newEnding("disqualified");
  invest.logic = [{ id: uid(), op: "is", value: "no", target: disqualified.id }];
  return {
    ...blankSchema(),
    welcome: {
      enabled: true,
      title: "Apply for a 1:1 strategy session",
      description: "Tell us about your goals. If it looks like we can help, you'll be able to book your session right away.",
      buttonLabel: "Begin application",
      timeToComplete: "Takes 90 seconds",
    },
    questions: [name, email, situation, commitment, invest],
    endings: [qualified, disqualified],
    theme: { ...baseTheme, font: "editorial" },
    settings: { scoringEnabled: true, threshold: 50, showProgress: true, showQuestionNumbers: false, calendarUrl: "" },
  };
}

export const TEMPLATES = [
  { id: "blank", name: "Blank", description: "Start from scratch with name + email.", build: blankSchema },
  { id: "agency", name: "Agency discovery call", description: "Revenue, budget, authority and timeline scoring.", build: agencySchema },
  { id: "coaching", name: "Coaching application", description: "High-ticket application with commitment scale.", build: coachingSchema },
] as const;
