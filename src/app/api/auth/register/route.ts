import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  isMobileAuthClient,
  issueSessionForUser,
} from "@/lib/auth";
import {
  enforceRateLimit,
  rejectUntrustedOrigin,
  requireJson,
} from "@/lib/api-security";

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) return originError;
    const contentTypeError = requireJson(request);
    if (contentTypeError) return contentTypeError;
    const rateLimitError = await enforceRateLimit({
      request,
      scope: "register",
      limit: 5,
      windowSeconds: 60 * 60,
    });
    if (rateLimitError) return rateLimitError;

    const { email, password, confirmPassword, firstName, lastName, confirmEmail } =
      await request.json();
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { message: "Nombre, apellido, email y contraseña son obligatorios." },
        { status: 400 },
      );
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedConfirmEmail = String(confirmEmail ?? "")
      .toLowerCase()
      .trim();
    if (normalizedEmail !== normalizedConfirmEmail) {
      return NextResponse.json(
        { message: "Los correos no coinciden." },
        { status: 400 },
      );
    }
    if (
      normalizedEmail.length < 5 ||
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return NextResponse.json({ message: "Email no válido." }, { status: 400 });
    }
    if (String(password) !== String(confirmPassword ?? "")) {
      return NextResponse.json(
        { message: "Las contraseñas no coinciden." },
        { status: 400 },
      );
    }
    if (String(password).length < 8 || String(password).length > 128) {
      return NextResponse.json(
        { message: "La contraseña debe tener entre 8 y 128 caracteres." },
        { status: 400 },
      );
    }

    const normalizedFirstName = String(firstName).trim();
    const normalizedLastName = String(lastName).trim();
    if (
      normalizedFirstName.length < 1 ||
      normalizedFirstName.length > 80 ||
      normalizedLastName.length < 1 ||
      normalizedLastName.length > 80
    ) {
      return NextResponse.json(
        { message: "Nombre y apellido no son válidos." },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json(
        { message: "Ya existe un usuario con ese email." },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        firstName: true,
        lastName: true,
      },
    });

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

    return NextResponse.json({ ...authPayload, user }, { status: 201 });
  } catch (error) {
    console.error("[auth][register]", error);
    return NextResponse.json(
      { message: "No pudimos crear tu cuenta." },
      { status: 500 },
    );
  }
}
