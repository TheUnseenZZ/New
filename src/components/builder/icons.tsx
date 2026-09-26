import {
  AlignLeft,
  CalendarCheck,
  CircleX,
  Flag,
  Gauge,
  Globe,
  Hash,
  ListChecks,
  Mail,
  Phone,
  Quote,
  Sparkles,
  ToggleRight,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { EndingKind, QuestionType } from "@/lib/types";

export const TYPE_ICONS: Record<QuestionType, LucideIcon> = {
  short_text: Type,
  long_text: AlignLeft,
  email: Mail,
  phone: Phone,
  website: Globe,
  number: Hash,
  multiple_choice: ListChecks,
  yes_no: ToggleRight,
  rating: Gauge,
  statement: Quote,
};

export const ENDING_ICONS: Record<EndingKind, LucideIcon> = {
  qualified: CalendarCheck,
  disqualified: CircleX,
  default: Flag,
};

export const ENDING_LABELS: Record<EndingKind, string> = {
  qualified: "Qualified",
  disqualified: "Disqualified",
  default: "Thank you",
};

export const WelcomeIcon = Sparkles;

export function TypeBadge({ icon: Icon, tone = "default" }: { icon: LucideIcon; tone?: "default" | "good" | "bad" }) {
  const tones = {
    default: "border-line-strong bg-raised text-dim",
    good: "border-good/25 bg-good/10 text-good",
    bad: "border-bad/25 bg-bad/10 text-bad",
  };
  return (
    <span className={`flex size-6 shrink-0 items-center justify-center rounded-md border ${tones[tone]}`}>
      <Icon className="size-3.5" />
    </span>
  );
}
