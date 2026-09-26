import type { Metadata } from "next";
import { AppHeader } from "@/components/ui/app-header";
import { db } from "@/lib/db";
import { statsByForm } from "@/lib/stats";
import type { FormSchema } from "@/lib/types";
import { Dashboard, type DashboardForm } from "./dashboard";

export const metadata: Metadata = { title: "Forms" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const forms = await db.form.findMany({ orderBy: { updatedAt: "desc" } });
  const stats = await statsByForm();
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const recent = await db.response.groupBy({
    by: ["status"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });

  const items: DashboardForm[] = forms.map((f) => {
    const schema = JSON.parse(f.draft) as FormSchema;
    return {
      id: f.id,
      title: f.title,
      slug: f.slug,
      status: !f.published ? "draft" : f.published !== f.draft ? "changes" : "live",
      updatedAt: f.updatedAt.toISOString(),
      views: f.views,
      questions: schema.questions.length,
      theme: schema.theme,
      headline: schema.welcome.title || schema.questions[0]?.title || f.title,
      stats: stats.get(f.id) ?? { starts: 0, completed: 0, qualified: 0, disqualified: 0 },
    };
  });

  const count = (s?: string) => recent.filter((r) => !s || r.status === s).reduce((a, r) => a + r._count._all, 0);
  const completed = count() - count("partial");
  const summary = { leads: completed, qualified: count("qualified"), partial: count("partial") };

  return (
    <>
      <AppHeader />
      <Dashboard forms={items} summary={summary} />
    </>
  );
}
