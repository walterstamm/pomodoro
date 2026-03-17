import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  try {
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth][logout]", error);
    return NextResponse.json(
      { message: "No pudimos cerrar sesión" },
      { status: 500 },
    );
  }
}
