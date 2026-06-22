import { AuthSession, User } from "@/generated/prisma/client";
import { bearerTokenFromRequest } from "@/lib/auth-token";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { cookies } from "next/headers";

const ACCESS_TOKEN_MAX_AGE = 60 * 15;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ACCESS_COOKIE = IS_PRODUCTION
  ? "__Host-focopulse_access"
  : "focopulse_access";
const REFRESH_COOKIE = IS_PRODUCTION
  ? "__Host-focopulse_refresh"
  : "focopulse_refresh";
const LEGACY_COOKIE = "focopulse_session";

type SessionWithUser = AuthSession & { user: User };

export type IssuedSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
};

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const createToken = () => crypto.randomBytes(32).toString("base64url");

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash);

const setAuthCookies = async (tokens: IssuedSession) => {
  const jar = await cookies();
  const commonOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: IS_PRODUCTION,
    path: "/",
  };

  jar.set(ACCESS_COOKIE, tokens.accessToken, {
    ...commonOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  jar.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...commonOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
  jar.delete(LEGACY_COOKIE);
};

const clearAuthCookies = async () => {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(LEGACY_COOKIE);
};

export const issueSessionForUser = async (
  userId: string,
  request?: Request,
  persistCookies = true,
): Promise<IssuedSession> => {
  const accessToken = createToken();
  const refreshToken = createToken();
  const now = Date.now();
  const accessExpiresAt = new Date(now + ACCESS_TOKEN_MAX_AGE * 1000);
  const refreshExpiresAt = new Date(now + REFRESH_TOKEN_MAX_AGE * 1000);

  await prisma.authSession.create({
    data: {
      tokenHash: hashToken(accessToken),
      userId,
      expiresAt: accessExpiresAt,
      refreshExpiresAt,
      userAgent: request?.headers.get("user-agent")?.slice(0, 300) ?? null,
      refreshTokens: {
        create: {
          tokenHash: hashToken(refreshToken),
          expiresAt: refreshExpiresAt,
        },
      },
    },
  });

  const tokens = {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_MAX_AGE,
    refreshExpiresIn: REFRESH_TOKEN_MAX_AGE,
  };
  if (persistCookies) await setAuthCookies(tokens);
  return tokens;
};

const findActiveSessionByAccessToken = async (
  token: string,
): Promise<SessionWithUser | null> =>
  prisma.authSession.findFirst({
    where: {
      tokenHash: hashToken(token),
      expiresAt: { gt: new Date() },
      refreshExpiresAt: { gt: new Date() },
      revokedAt: null,
    },
    include: { user: true },
  });

export const currentUser = async (request?: Request): Promise<User | null> => {
  const authorization = request?.headers.get("authorization");
  if (authorization) {
    const bearerToken = bearerTokenFromRequest(request!);
    if (!bearerToken) return null;
    const session = await findActiveSessionByAccessToken(bearerToken);
    return session?.user ?? null;
  }

  const jar = await cookies();
  const cookieToken = jar.get(ACCESS_COOKIE)?.value;
  if (!cookieToken) return null;
  const session = await findActiveSessionByAccessToken(cookieToken);
  return session?.user ?? null;
};

export const rotateRefreshToken = async (
  refreshToken: string,
  persistCookies = true,
): Promise<IssuedSession | null> => {
  const tokenHash = hashToken(refreshToken);
  const storedToken = await prisma.authRefreshToken.findUnique({
    where: { tokenHash },
    include: { session: true },
  });
  const now = new Date();

  if (
    !storedToken ||
    storedToken.expiresAt <= now ||
    !storedToken.session.refreshExpiresAt ||
    storedToken.session.refreshExpiresAt <= now ||
    storedToken.session.revokedAt
  ) {
    return null;
  }

  if (storedToken.usedAt || storedToken.revokedAt) {
    const usedRecently =
      storedToken.usedAt &&
      Date.now() - storedToken.usedAt.getTime() <= 10_000;
    if (usedRecently) return null;

    await prisma.authSession.update({
      where: { id: storedToken.sessionId },
      data: { revokedAt: now },
    });
    return null;
  }

  const accessToken = createToken();
  const nextRefreshToken = createToken();
  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_MAX_AGE * 1000);

  await prisma.$transaction([
    prisma.authRefreshToken.update({
      where: { id: storedToken.id },
      data: { usedAt: now },
    }),
    prisma.authRefreshToken.create({
      data: {
        tokenHash: hashToken(nextRefreshToken),
        sessionId: storedToken.sessionId,
        expiresAt: storedToken.session.refreshExpiresAt,
      },
    }),
    prisma.authSession.update({
      where: { id: storedToken.sessionId },
      data: {
        tokenHash: hashToken(accessToken),
        expiresAt: accessExpiresAt,
        lastUsedAt: now,
      },
    }),
  ]);

  const tokens = {
    accessToken,
    refreshToken: nextRefreshToken,
    expiresIn: ACCESS_TOKEN_MAX_AGE,
    refreshExpiresIn: Math.max(
      0,
      Math.floor(
        (storedToken.session.refreshExpiresAt.getTime() - Date.now()) / 1000,
      ),
    ),
  };
  if (persistCookies) await setAuthCookies(tokens);
  return tokens;
};

export const refreshTokenFromRequest = async (
  request: Request,
): Promise<{ token: string | null; mobile: boolean }> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    if (typeof body.refreshToken === "string" && body.refreshToken.length > 0) {
      return { token: body.refreshToken, mobile: true };
    }
  }

  const jar = await cookies();
  return {
    token: jar.get(REFRESH_COOKIE)?.value ?? null,
    mobile: false,
  };
};

export const revokeSession = async (
  request: Request,
  refreshToken?: string | null,
) => {
  const bearerToken = bearerTokenFromRequest(request);
  const jar = await cookies();
  const accessToken = bearerToken ?? jar.get(ACCESS_COOKIE)?.value;
  const cookieRefreshToken = jar.get(REFRESH_COOKIE)?.value;
  const effectiveRefreshToken = refreshToken ?? cookieRefreshToken;

  let revokedByAccessToken = false;
  if (accessToken) {
    const result = await prisma.authSession.updateMany({
      where: { tokenHash: hashToken(accessToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    revokedByAccessToken = result.count > 0;
  }
  if (!revokedByAccessToken && effectiveRefreshToken) {
    const storedToken = await prisma.authRefreshToken.findUnique({
      where: { tokenHash: hashToken(effectiveRefreshToken) },
      select: { sessionId: true },
    });
    if (storedToken) {
      await prisma.authSession.update({
        where: { id: storedToken.sessionId },
        data: { revokedAt: new Date() },
      });
    }
  }

  await clearAuthCookies();
};

export const revokeAllUserSessions = async (userId: string) => {
  await prisma.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await clearAuthCookies();
};

export const isMobileAuthClient = (request: Request) =>
  request.headers.get("x-auth-client")?.toLowerCase() === "mobile";
