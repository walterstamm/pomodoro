import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  rejectUntrustedOrigin,
  requireJson,
} from "@/lib/api-security";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;

  try {
    const user = await currentUser(request);
    if (!user) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    const sessions = await prisma.session.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        project: { userId: user.id },
      },
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[sessions][GET]", error);
    return NextResponse.json(
      { message: "No se pudieron cargar las sesiones" },
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
    const { projectId, startedAt, endedAt, durationMinutes } = body;

    if (
      typeof projectId !== "string" ||
      typeof startedAt !== "string" ||
      typeof endedAt !== "string" ||
      projectId.length > 64
    ) {
      return NextResponse.json(
        { message: "Faltan datos de sesión" },
        { status: 400 },
      );
    }
    const parsedStartedAt = new Date(startedAt);
    const parsedEndedAt = new Date(endedAt);
    const parsedDuration = Number(durationMinutes);
    if (
      Number.isNaN(parsedStartedAt.getTime()) ||
      Number.isNaN(parsedEndedAt.getTime()) ||
      parsedEndedAt <= parsedStartedAt ||
      !Number.isFinite(parsedDuration) ||
      parsedDuration < 1 ||
      parsedDuration > 180
    ) {
      return NextResponse.json(
        { message: "Los datos temporales de la sesión no son válidos." },
        { status: 400 },
      );
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
    });
    if (!project) {
      return NextResponse.json(
        { message: "Proyecto no encontrado" },
        { status: 404 },
      );
    }

    const session = await prisma.session.create({
      data: {
        projectId,
        startedAt: parsedStartedAt,
        endedAt: parsedEndedAt,
        durationMinutes: Math.round(parsedDuration),
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("[sessions][POST]", error);
    return NextResponse.json(
      { message: "No se pudo guardar la sesión" },
      { status: 500 },
    );
  }
}
