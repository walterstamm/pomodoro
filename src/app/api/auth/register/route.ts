import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, issueSessionForUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password, confirmPassword, firstName, lastName, confirmEmail } =
      await request.json();
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { message: "Nombre, apellido, email y contraseña son obligatorios." },
        { status: 400 },
      );
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedConfirmEmail = String(confirmEmail ?? "").toLowerCase().trim();
    if (normalizedEmail !== normalizedConfirmEmail) {
      return NextResponse.json(
        { message: "Los correos no coinciden." },
        { status: 400 },
      );
    }
    if (normalizedEmail.length < 5 || !normalizedEmail.includes("@")) {
      return NextResponse.json(
        { message: "Email no válido" },
        { status: 400 },
      );
    }
    if (String(password) !== String(confirmPassword ?? "")) {
      return NextResponse.json(
        { message: "Las contraseñas no coinciden." },
        { status: 400 },
      );
    }
    if (String(password).length < 8) {
      return NextResponse.json(
        { message: "La contraseña debe tener al menos 8 caracteres." },
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
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
      },
      select: { id: true, email: true, createdAt: true, firstName: true, lastName: true },
    });

    await issueSessionForUser(user.id);

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("[auth][register]", error);
    return NextResponse.json(
      { message: "No pudimos crear tu cuenta" },
      { status: 500 },
    );
  }
}
