/**
 * Utility functions for handling sales rep codes with slash notation
 * Example: "KLH/SC" = KLH (primary, commission-eligible) + SC (assistant, bonus-eligible)
 */

export interface ParsedRepCode {
  primaryRep: string;      // Commission-eligible rep (e.g., "KLH")
  assistantRep?: string;   // Bonus-eligible rep (e.g., "SC" or "CR")
  isPrimary: (repName: string) => boolean;
  isAssistant: (repName: string) => boolean;
}

/**
 * Parse a rep code with optional slash notation
 * "KLH/SC" → { primaryRep: "KLH", assistantRep: "SC" }
 * "KLH" → { primaryRep: "KLH", assistantRep: undefined }
 */
export function parseRepCode(repCode: string): ParsedRepCode {
  const [primary, assistant] = repCode.split("/").map(s => s.trim());
  
  return {
    primaryRep: primary,
    assistantRep: assistant,
    isPrimary: (name: string) => name === primary,
    isAssistant: (name: string) => name === assistant,
  };
}

export const BONUS_THRESHOLD = 150000; // $150k sales needed for bonus eligibility
export const DEFAULT_COMMISSION_RATE = 0.05; // 5%

/**
 * Determine if a rep is commission-eligible
 * Commission reps: all primary reps
 * Bonus reps: SC, CR (salary unless they hit bonus threshold)
 */
export function isCommissionEligible(repName: string, salesAmount: number = 0): boolean {
  const isBonusRep = ["SC", "CR"].includes(repName);
  
  // Bonus reps become commission-eligible only after hitting $150k
  if (isBonusRep) {
    return salesAmount >= BONUS_THRESHOLD;
  }
  
  // Primary reps are always commission-eligible
  return true;
}

/**
 * Calculate commission for a sale
 * If rep is bonus-eligible and hasn't hit threshold: $0
 * If rep is bonus-eligible and has hit threshold: commission on amount above $150k
 * If rep is commission-eligible: 5% of sale amount
 */
export function calculateCommission(
  repName: string,
  saleAmount: number,
  totalRepSalesMonth: number,
  commissionRate: number = DEFAULT_COMMISSION_RATE
): number {
  const isBonusRep = ["SC", "CR"].includes(repName);
  
  if (!isBonusRep) {
    // Primary rep: full commission
    return saleAmount * commissionRate;
  }
  
  // Bonus rep logic
  const previousSales = totalRepSalesMonth - saleAmount;
  
  if (previousSales >= BONUS_THRESHOLD) {
    // Already hit threshold: commission on this sale
    return saleAmount * commissionRate;
  }
  
  if (totalRepSalesMonth >= BONUS_THRESHOLD) {
    // This sale pushes us over threshold: only commission on portion above $150k
    const amountOverThreshold = totalRepSalesMonth - BONUS_THRESHOLD;
    return amountOverThreshold * commissionRate;
  }
  
  // Haven't hit threshold yet: $0 commission (salary only)
  return 0;
}

/**
 * Get bonus progress for SC/CR reps
 */
export function getBonusProgress(
  repName: string,
  totalRepSalesMonth: number
): {
  isBonusRep: boolean;
  salesAmount: number;
  bonusThreshold: number;
  percentToThreshold: number;
  hasEarnedBonus: boolean;
} {
  const isBonusRep = ["SC", "CR"].includes(repName);
  
  return {
    isBonusRep,
    salesAmount: totalRepSalesMonth,
    bonusThreshold: BONUS_THRESHOLD,
    percentToThreshold: Math.min((totalRepSalesMonth / BONUS_THRESHOLD) * 100, 100),
    hasEarnedBonus: totalRepSalesMonth >= BONUS_THRESHOLD,
  };
}
