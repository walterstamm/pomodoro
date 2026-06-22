import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { rejectUntrustedOrigin, requireJson } from "@/lib/api-security";

const goalPeriods = ["DAILY", "WEEKLY"] as const;
type GoalPeriod = (typeof goalPeriods)[number];

const isGoalPeriod = (value: unknown): value is GoalPeriod =>
  typeof value === "string" && goalPeriods.includes(value as GoalPeriod);

const goalPeriodLabels: Record<GoalPeriod, string> = {
  DAILY: "diaria",
  WEEKLY: "semanal",
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) return originError;
    const contentTypeError = requireJson(request);
    if (contentTypeError) return contentTypeError;

    const user = await currentUser(request);
    if (!user) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const wantsToClearGoal =
      body.goalPeriod === null && body.goalMinutes === null;

    if (!wantsToClearGoal && !isGoalPeriod(body.goalPeriod)) {
      return NextResponse.json(
        { message: "La meta debe ser diaria o semanal." },
        { status: 400 },
      );
    }

    const parsedGoalMinutes = Number(body.goalMinutes);
    if (
      !wantsToClearGoal &&
      (!Number.isInteger(parsedGoalMinutes) ||
        parsedGoalMinutes < 1 ||
        parsedGoalMinutes > 10080)
    ) {
      return NextResponse.json(
        { message: "La meta debe estar entre 1 y 10080 minutos." },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id, userId: user.id },
    });

    if (!project) {
      return NextResponse.json(
        { message: "Proyecto no encontrado" },
        { status: 404 },
      );
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: wantsToClearGoal
        ? { goalPeriod: null, goalMinutes: null }
        : {
            goalPeriod: body.goalPeriod,
            goalMinutes: parsedGoalMinutes,
          },
      include: { sessions: true },
    });

    return NextResponse.json({
      ...updatedProject,
      goalLabel: updatedProject.goalPeriod
        ? goalPeriodLabels[updatedProject.goalPeriod]
        : null,
    });
  } catch (error) {
    console.error("[projects][PATCH]", error);
    return NextResponse.json(
      { message: "No se pudo actualizar el proyecto" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) return originError;

    const user = await currentUser(request);
    if (!user) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;

    const project = await prisma.project.findUnique({
      where: { id, userId: user.id },
    });

    if (!project) {
      return NextResponse.json(
        { message: "Proyecto no encontrado" },
        { status: 404 },
      );
    }

    await prisma.session.deleteMany({ where: { projectId: id } });
    await prisma.project.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[projects][DELETE]", error);
    return NextResponse.json(
      { message: "No se pudo eliminar el proyecto" },
      { status: 500 },
    );
  }
}
