import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ rid: string }> };

export async function DELETE(_: Request, { params }: Ctx) {
  const { rid } = await params;
  await db.response.delete({ where: { id: rid } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
