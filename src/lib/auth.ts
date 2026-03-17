import { prisma } from "@/lib/prisma";
import { AuthSession, User } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "focopulse_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash);

const createAuthSession = async (userId: string): Promise<{ token: string }> => {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.authSession.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
    },
  });
  return { token };
};

export const setSessionCookie = async (token: string) => {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
};

export const clearSessionCookie = async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.authSession.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }
  jar.delete(SESSION_COOKIE);
};

export const issueSessionForUser = async (userId: string) => {
  const { token } = await createAuthSession(userId);
  await setSessionCookie(token);
};

export const currentUser = async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session: (AuthSession & { user: User }) | null =
    await prisma.authSession.findFirst({
      where: {
        tokenHash: hashToken(token),
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

  return session?.user ?? null;
};
