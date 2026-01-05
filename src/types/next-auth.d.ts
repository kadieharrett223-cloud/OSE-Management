import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      role?: "ADMIN" | "REP";
      repId?: string | null;
    };
  }
  interface User {
    role?: "ADMIN" | "REP";
    repId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "ADMIN" | "REP";
    repId?: string | null;
  }
}
