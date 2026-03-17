import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueSessionForUser, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = String(email ?? "").toLowerCase().trim();
    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { message: "Email y contraseña son obligatorios." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });
    }

    const isValid = await verifyPassword(String(password), user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { message: "Credenciales incorrectas." },
        { status: 401 },
      );
    }

    await issueSessionForUser(user.id);

    return NextResponse.json({
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
    });
  } catch (error) {
    console.error("[auth][login]", error);
    return NextResponse.json(
      { message: "No pudimos iniciar sesión" },
      { status: 500 },
    );
  }
}
