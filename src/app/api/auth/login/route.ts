import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isMobileAuthClient,
  issueSessionForUser,
  verifyPassword,
} from "@/lib/auth";
import {
  clearRateLimit,
  enforceRateLimit,
  rejectUntrustedOrigin,
  requireJson,
} from "@/lib/api-security";

const DUMMY_PASSWORD_HASH =
  "$2b$12$XLQU3vVZ6/PR/kvFLDCmsOD8hnLugm3qIWya1.MececB.olJAnR92";

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) return originError;
    const contentTypeError = requireJson(request);
    if (contentTypeError) return contentTypeError;

    const { email, password } = await request.json();
    const normalizedEmail = String(email ?? "").toLowerCase().trim();
    if (
      !normalizedEmail ||
      normalizedEmail.length > 254 ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128
    ) {
      return NextResponse.json(
        { message: "Credenciales inválidas." },
        { status: 400 },
      );
    }

    const ipRateLimitError = await enforceRateLimit({
      request,
      scope: "login",
      limit: 30,
      windowSeconds: 15 * 60,
    });
    if (ipRateLimitError) return ipRateLimitError;
    const accountRateLimitError = await enforceRateLimit({
      request,
      scope: "login-account",
      identifier: normalizedEmail,
      limit: 8,
      windowSeconds: 15 * 60,
    });
    if (accountRateLimitError) return accountRateLimitError;

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const isValid = await verifyPassword(password, passwordHash);
    if (!user || !isValid) {
      return NextResponse.json(
        { message: "Credenciales inválidas." },
        { status: 401 },
      );
    }

    await clearRateLimit(request, "login-account", normalizedEmail);
    const mobile = isMobileAuthClient(request);
    const tokens = await issueSessionForUser(user.id, request, !mobile);
    const authPayload = mobile
      ? {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenType: "Bearer",
          expiresIn: tokens.expiresIn,
          refreshExpiresIn: tokens.refreshExpiresIn,
        }
      : { expiresIn: tokens.expiresIn };

    return NextResponse.json({
      ...authPayload,
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
    });
  } catch (error) {
    console.error("[auth][login]", error);
    return NextResponse.json(
      { message: "No pudimos iniciar sesión." },
      { status: 500 },
    );
  }
}
