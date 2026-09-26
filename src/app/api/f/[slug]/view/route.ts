import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_: Request, { params }: Ctx) {
  const { slug } = await params;
  await db.form
    .update({ where: { slug, NOT: { published: null } }, data: { views: { increment: 1 } } })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}
