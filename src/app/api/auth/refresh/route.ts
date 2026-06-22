import { NextResponse } from "next/server";
import {
  refreshTokenFromRequest,
  rotateRefreshToken,
} from "@/lib/auth";
import {
  enforceRateLimit,
  rejectUntrustedOrigin,
} from "@/lib/api-security";

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) return originError;
    const rateLimitError = await enforceRateLimit({
      request,
      scope: "refresh",
      limit: 30,
      windowSeconds: 15 * 60,
    });
    if (rateLimitError) return rateLimitError;

    const { token, mobile } = await refreshTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { message: "Refresh token requerido." },
        { status: 401 },
      );
    }

    const tokens = await rotateRefreshToken(token, !mobile);
    if (!tokens) {
      return NextResponse.json(
        { message: "Sesión expirada o inválida." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      mobile
        ? {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            tokenType: "Bearer",
            expiresIn: tokens.expiresIn,
            refreshExpiresIn: tokens.refreshExpiresIn,
          }
        : { ok: true, expiresIn: tokens.expiresIn },
    );
  } catch (error) {
    console.error("[auth][refresh]", error);
    return NextResponse.json(
      { message: "No pudimos renovar la sesión." },
      { status: 500 },
    );
  }
}
