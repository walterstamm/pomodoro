import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  rejectUntrustedOrigin,
  requireJson,
} from "@/lib/api-security";

const palette = ["#7BD1FF", "#FFB4BC", "#C6FF7B", "#B7A3FF", "#FFD27B"];

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      include: { sessions: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("[projects][GET]", error);
    return NextResponse.json(
      { message: "No se pudieron cargar los proyectos" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) return originError;
    const contentTypeError = requireJson(request);
    if (contentTypeError) return contentTypeError;

    const user = await currentUser(request);
    if (!user) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { message: "El nombre debe tener entre 2 y 80 caracteres." },
        { status: 400 },
      );
    }

    const requestedColor =
      typeof body.color === "string" ? body.color.trim() : "";
    if (requestedColor && !/^#[0-9a-f]{6}$/i.test(requestedColor)) {
      return NextResponse.json(
        { message: "El color debe usar formato hexadecimal #RRGGBB." },
        { status: 400 },
      );
    }
    const colorCandidate =
      requestedColor
        ? requestedColor
        : palette[Math.floor(Math.random() * palette.length)];

    const project = await prisma.project.create({
      data: { name, color: colorCandidate, userId: user.id },
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("[projects][POST]", error);
    return NextResponse.json(
      { message: "No se pudo crear el proyecto" },
      { status: 500 },
    );
  }
}
