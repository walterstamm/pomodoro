import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    return NextResponse.json({
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
    });
  } catch (error) {
    console.error("[auth][me]", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
