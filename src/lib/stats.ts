import { db } from "./db";

export type FormStats = { starts: number; completed: number; qualified: number; disqualified: number };

export async function statsByForm(formIds?: string[]) {
  const rows = await db.response.groupBy({
    by: ["formId", "status"],
    where: formIds ? { formId: { in: formIds } } : undefined,
    _count: { _all: true },
  });
  const out = new Map<string, FormStats>();
  for (const r of rows) {
    const s = out.get(r.formId) ?? { starts: 0, completed: 0, qualified: 0, disqualified: 0 };
    const n = r._count._all;
    s.starts += n;
    if (r.status !== "partial") s.completed += n;
    if (r.status === "qualified") s.qualified += n;
    if (r.status === "disqualified") s.disqualified += n;
    out.set(r.formId, s);
  }
  return out;
}
