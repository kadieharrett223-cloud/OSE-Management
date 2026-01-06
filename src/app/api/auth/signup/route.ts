import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    // Hash password and create user
    const passwordHash = await hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "REP",
      },
    });

    return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
  } catch (error: any) {
    console.error("Sign-up error:", error);
    return NextResponse.json({ error: error.message || "Sign-up failed" }, { status: 500 });
  }
}
