export const REP_ALIASES: Record<string, string[]> = {
  // Canonical : Aliases (case-insensitive matching)
  "Wholesale Lifts": ["Wholesale Lifts", "WL"],
  "SC": ["SC", "sc"],
};

export function canonicalizeRep(name: string | undefined | null): string {
  const n = (name || "").trim();
  if (!n) return "";
  const lower = n.toLowerCase();
  for (const [canonical, aliases] of Object.entries(REP_ALIASES)) {
    if (aliases.some((a) => a.toLowerCase() === lower)) return canonical;
  }
  return n;
}

export function aliasesForCanonical(canonical: string): string[] {
  const c = (canonical || "").trim();
  if (!c) return [];
  return REP_ALIASES[c] || [c];
}
