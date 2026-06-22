import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { isAllowedOrigin } from "./allowed-origin";
import { prisma } from "./prisma";

export const rejectUntrustedOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  if (isAllowedOrigin(origin)) return null;

  return NextResponse.json({ message: "Origen no permitido." }, { status: 403 });
};

export const requireJson = (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().startsWith("application/json")) return null;

  return NextResponse.json(
    { message: "Content-Type debe ser application/json." },
    { status: 415 },
  );
};

const clientIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip")?.trim() ||
  "unknown";

const rateLimitKey = (scope: string, identifier: string) =>
  `${scope}:${crypto.createHash("sha256").update(identifier).digest("hex")}`;

export const enforceRateLimit = async ({
  request,
  scope,
  identifier,
  limit,
  windowSeconds,
}: {
  request: Request;
  scope: string;
  identifier?: string;
  limit: number;
  windowSeconds: number;
}) => {
  const key = rateLimitKey(
    scope,
    identifier ? `${clientIp(request)}:${identifier}` : clientIp(request),
  );
  const now = new Date();
  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  if (!existing || existing.resetAt <= now) {
    await prisma.rateLimit.upsert({
      where: { key },
      update: {
        count: 1,
        resetAt: new Date(Date.now() + windowSeconds * 1000),
      },
      create: {
        key,
        count: 1,
        resetAt: new Date(Date.now() + windowSeconds * 1000),
      },
    });
    return null;
  }

  if (existing.count >= limit) {
    const retryAfter = Math.max(
      1,
      Math.ceil((existing.resetAt.getTime() - Date.now()) / 1000),
    );
    return NextResponse.json(
      { message: "Demasiados intentos. Intenta nuevamente más tarde." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return null;
};

export const clearRateLimit = async (
  request: Request,
  scope: string,
  identifier: string,
) => {
  const key = rateLimitKey(
    scope,
    `${clientIp(request)}:${identifier}`,
  );
  await prisma.rateLimit.deleteMany({ where: { key } });
};
