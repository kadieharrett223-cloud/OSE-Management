import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        // 1) Env-based admin login for production (avoids DB in serverless)
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH; // bcrypt hash
        if (adminEmail && adminPasswordHash) {
          const emailOk = credentials.email.toLowerCase() === adminEmail.toLowerCase();
          const passOk = await compare(credentials.password, adminPasswordHash);
          if (emailOk && passOk) {
            return { id: "admin", email: adminEmail, role: "admin", repId: null } as any;
          }
        }

        // 2) Fallback to Prisma-backed users (development/local or when DB configured)
        try {
          const user = await prisma.user.findUnique({ where: { email: credentials.email } });
          if (!user) return null;
          const valid = await compare(credentials.password, user.passwordHash);
          if (!valid) return null;
          return { id: user.id, email: user.email, role: user.role, repId: user.repId } as any;
        } catch {
          // If DB is not configured in this environment, treat as invalid credentials
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user }) {
      const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? process.env.ALLOWED_EMAIL_DOMAIN ?? "")
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);

      if (!allowedDomains.length) return true;

      const email = user?.email?.toLowerCase();
      const domain = email?.split("@")[1];
      if (!domain) return false;

      return allowedDomains.includes(domain);
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.repId = (user as any).repId;
      }
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

// Helper to bypass auth entirely when AUTH_DISABLED=true (treat as admin)
export async function getSessionOrBypass() {
  if (process.env.AUTH_DISABLED === "true") {
    return {
      user: {
        id: "admin",
        email: process.env.ADMIN_EMAIL || "admin@local",
        role: "admin",
        repId: null,
      },
    } as any;
  }
  return getServerSession(authOptions as any);
}