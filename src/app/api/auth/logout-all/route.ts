import { NextResponse } from "next/server";
import { currentUser, revokeAllUserSessions } from "@/lib/auth";
import { rejectUntrustedOrigin } from "@/lib/api-security";

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) return originError;
    const user = await currentUser(request);
    if (!user) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    await revokeAllUserSessions(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth][logout-all]", error);
    return NextResponse.json(
      { message: "No pudimos cerrar todas las sesiones." },
      { status: 500 },
    );
  }
}
