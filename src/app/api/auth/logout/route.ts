import { NextResponse } from "next/server";
import { revokeSession } from "@/lib/auth";
import { rejectUntrustedOrigin } from "@/lib/api-security";

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) return originError;
    const contentType = request.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await request.json().catch(() => ({}))
      : {};
    const refreshToken =
      typeof body.refreshToken === "string" ? body.refreshToken : null;

    await revokeSession(request, refreshToken);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth][logout]", error);
    return NextResponse.json(
      { message: "No pudimos cerrar sesión." },
      { status: 500 },
    );
  }
}
