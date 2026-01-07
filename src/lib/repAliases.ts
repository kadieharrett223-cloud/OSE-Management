export const REP_ALIASES: Record<string, string[]> = {
  // Canonical : Aliases (case-insensitive matching)
  // Include spaceless variants so inputs like "WholesaleLifts" map correctly
  "Wholesale Lifts": ["Wholesale Lifts", "WholesaleLifts", "WL", "WS"],
  "Turbo Lifts": ["Turbo Lifts", "TL"],
  "Heavy Lift Direct": ["Heavy Lift Direct", "HLD"],
  "PSV": ["PSV"],
  "Northern Tool & Equipment": ["Northern Tool & Equipment", "Northern Tool", "NT"],
  "SC": ["SC", "sc"],
  "CR": ["CR", "cr"],
};

export const WHOLESALER_CANONICALS = [
  "Wholesale Lifts",
  "Turbo Lifts",
  "Heavy Lift Direct",
  "PSV",
  "Northern Tool & Equipment",
];

// Salary reps who don't earn commission, just need to meet sales goals
export const SALARY_REP_CANONICALS = ["SC", "CR"];

export function isSalaryRep(name: string | undefined | null): boolean {
  const c = canonicalizeRep(name);
  return SALARY_REP_CANONICALS.some((s) => s.toLowerCase() === c.toLowerCase());
}

function normalize(str: string): string {
  return str
    .trim()
    .toLowerCase()
    // replace any non-alphanumeric with a single space
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " "); // collapse whitespace
}

export function canonicalizeRep(name: string | undefined | null): string {
  const raw = (name || "").trim();
  if (!raw) return "";
  const normName = normalize(raw);
  for (const [canonical, aliases] of Object.entries(REP_ALIASES)) {
    const aliasNorms = aliases.map(normalize);
    // exact match OR contains alias token (handles "Wholesale Lifts Inc")
    if (aliasNorms.some((a) => normName === a || normName.includes(a))) {
      return canonical;
    }
  }
  return raw;
}

export function aliasesForCanonical(canonical: string): string[] {
  const c = (canonical || "").trim();
  if (!c) return [];
  return REP_ALIASES[c] || [c];
}

export function isWholesalerName(name: string | undefined | null): boolean {
  const c = canonicalizeRep(name);
  return WHOLESALER_CANONICALS.some((w) => w.toLowerCase() === c.toLowerCase());
}
