import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, role } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if user exists
    const { data: existing } = await supabase
      .from("auth_users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    // Create user in auth_users table (inactive by default - requires admin approval)
    // Note: Passwords are stored in plain text as per current schema
    const { data: user, error } = await supabase
      .from("auth_users")
      .insert([{
        email: normalizedEmail,
        password,
        role: role || "rep",
        active: false,
      }])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, userId: user.id, email: normalizedEmail }, { status: 201 });
  } catch (error: any) {
    console.error("Sign-up error:", error);
    return NextResponse.json({ error: error.message || "Sign-up failed" }, { status: 500 });
  }
}
