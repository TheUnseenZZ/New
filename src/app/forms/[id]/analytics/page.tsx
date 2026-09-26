import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { recall } from "@/lib/engine";
import type { FormSchema } from "@/lib/types";
import { Analytics, type AnalyticsData } from "./analytics";

type Props = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics" };

const DAYS = 30;

export default async function AnalyticsPage({ params }: Props) {
  const { id } = await params;
  const form = await db.form.findUnique({ where: { id } });
  if (!form) notFound();
  const schema = JSON.parse(form.published ?? form.draft) as FormSchema;
  const responses = await db.response.findMany({
    where: { formId: id },
    select: { path: true, status: true, score: true, createdAt: true },
  });

  const answered = new Map<string, number>();
  let completed = 0;
  let qualified = 0;
  let disqualified = 0;
  let scoreSum = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daily = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (DAYS - 1 - i));
    return { date: d.toISOString().slice(0, 10), starts: 0, qualified: 0 };
  });
  const dayIndex = new Map(daily.map((d, i) => [d.date, i]));

  for (const r of responses) {
    for (const qid of JSON.parse(r.path) as string[]) answered.set(qid, (answered.get(qid) ?? 0) + 1);
    if (r.status !== "partial") {
      completed++;
      scoreSum += r.score;
    }
    if (r.status === "qualified") qualified++;
    if (r.status === "disqualified") disqualified++;
    const local = new Date(r.createdAt);
    local.setHours(0, 0, 0, 0);
    const i = dayIndex.get(local.toISOString().slice(0, 10));
    if (i !== undefined) {
      daily[i].starts++;
      if (r.status === "qualified") daily[i].qualified++;
    }
  }

  const data: AnalyticsData = {
    views: form.views,
    starts: responses.length,
    completed,
    qualified,
    disqualified,
    avgScore: completed ? Math.round(scoreSum / completed) : 0,
    questions: schema.questions.map((q, i) => ({ id: q.id, index: i + 1, title: recall(q.title, {}), count: answered.get(q.id) ?? 0 })),
    daily,
  };

  return <Analytics form={{ id: form.id, title: form.title }} data={data} />;
}
