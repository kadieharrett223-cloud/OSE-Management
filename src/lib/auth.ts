import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
      tenantId: process.env.AZURE_AD_TENANT_ID || "",
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET || "development-secret-do-not-use-in-production",
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
        // Assign admin role to users from allowed domain
        const email = user.email?.toLowerCase();
        const domain = email?.split("@")[1];
        const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? process.env.ALLOWED_EMAIL_DOMAIN ?? "")
          .split(",")
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean);
        
        token.role = (allowedDomains.includes(domain || "") ? "admin" : "user") as any;
        token.repId = null;
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

// Get server session with authentication required
export async function getSession() {
  return getServerSession(authOptions as any);
}