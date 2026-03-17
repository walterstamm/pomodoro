import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser();
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
