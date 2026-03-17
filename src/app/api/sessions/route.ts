import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;

  try {
    const user = await currentUser();
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
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { projectId, startedAt, endedAt, durationMinutes } = body;

    if (
      typeof projectId !== "string" ||
      typeof startedAt !== "string" ||
      typeof endedAt !== "string"
    ) {
      return NextResponse.json(
        { message: "Faltan datos de sesión" },
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
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt),
        durationMinutes: Math.max(1, Math.round(Number(durationMinutes) || 0)),
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
