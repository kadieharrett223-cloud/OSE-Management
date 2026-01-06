import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      role?: "ADMIN" | "REP";
      repId?: string | null;
    };
  }
  interface User {
    id?: string;
    role?: "ADMIN" | "REP";
    repId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "ADMIN" | "REP";
    repId?: string | null;
  }
}
