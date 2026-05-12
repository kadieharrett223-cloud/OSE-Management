import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "app_access_expires";

function hasSharedAccessCookie() {
  try {
    const cookieStore = cookies();
    const raw = cookieStore.get(ACCESS_COOKIE)?.value;
    const expiresAt = Number(raw || 0);
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
  } catch {
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const normalizedEmail = credentials.email.toString().trim().toLowerCase();
        const normalizedPassword = credentials.password.toString().trim();

        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Check user in Supabase auth_users table
        const { data: user, error } = await supabase
          .from("auth_users")
          .select("*")
          .ilike("email", normalizedEmail)
          .eq("password", normalizedPassword)
          .eq("active", true)
          .single();

        if (error || !user) {
          console.error("Auth error:", error);
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          role: "ADMIN",
        };
      },
    }),
  ],
  session: { 
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || "development-secret-do-not-use-in-production",
  callbacks: {
    async signIn({ user }) {
      // Allow all users who successfully authenticated from database
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = "ADMIN";
        token.repId = null;
      }
      token.role = "ADMIN";
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as any;
        session.user.repId = token.repId as string | null | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};

// Get server session with authentication required
export async function getSession() {
  const nextAuthSession: any = await getServerSession(authOptions as any);
  if (nextAuthSession?.user) {
    return nextAuthSession;
  }

  if (hasSharedAccessCookie()) {
    return {
      user: {
        id: "shared-access",
        email: "shared@local",
        role: "ADMIN",
        repId: null,
      },
    } as any;
  }

  return null;
}

// Extract user ID from session, useful for multi-tenant API routes
export async function getUserId(): Promise<string | null> {
  const session: any = await getSession();
  return session?.user?.id || null;
}