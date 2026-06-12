const DEFAULT_TIME_ZONE = "America/Los_Angeles";

export const BUSINESS_TIME_ZONE =
  process.env.BUSINESS_TIME_ZONE || process.env.APP_TIME_ZONE || DEFAULT_TIME_ZONE;

type DateParts = {
  year: number;
  month: number;
  day: number;
  weekdayShort: string;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function formatUtcDateYmd(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDatePartsInTimeZone(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);

  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return {
    year: Number(getPart("year")),
    month: Number(getPart("month")),
    day: Number(getPart("day")),
    weekdayShort: getPart("weekday"),
  };
}

export function toYmdInTimeZone(date: Date, timeZone = BUSINESS_TIME_ZONE): string {
  const p = toDatePartsInTimeZone(date, timeZone);
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${p.year}-${mm}-${dd}`;
}

export function parseYmd(value: unknown): { year: number; month: number; day: number } | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function getBusinessDateContext(now = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const todayParts = toDatePartsInTimeZone(now, timeZone);
  const todayUtc = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day));
  const weekdayIndex = WEEKDAY_INDEX[todayParts.weekdayShort] ?? 0;
  const daysSinceMonday = (weekdayIndex + 6) % 7;

  const weekStartUtc = new Date(todayUtc);
  weekStartUtc.setUTCDate(weekStartUtc.getUTCDate() - daysSinceMonday);

  const monthStartUtc = new Date(Date.UTC(todayParts.year, todayParts.month - 1, 1));

  const lastMonthStartUtc = new Date(Date.UTC(todayParts.year, todayParts.month - 2, 1));
  const lastMonthEndUtc = new Date(Date.UTC(todayParts.year, todayParts.month - 1, 0));

  const daysSoFar = todayParts.day;
  const lastMonthCompareDays = Math.min(daysSoFar, lastMonthEndUtc.getUTCDate());
  const lastMonthCompareEndUtc = new Date(
    Date.UTC(lastMonthStartUtc.getUTCFullYear(), lastMonthStartUtc.getUTCMonth(), lastMonthCompareDays)
  );

  return {
    timeZone,
    today: formatUtcDateYmd(todayUtc),
    weekStart: formatUtcDateYmd(weekStartUtc),
    monthStart: formatUtcDateYmd(monthStartUtc),
    yearStart: `${todayParts.year}-01-01`,
    lastMonthStart: formatUtcDateYmd(lastMonthStartUtc),
    lastMonthEnd: formatUtcDateYmd(lastMonthEndUtc),
    lastMonthCompareEnd: formatUtcDateYmd(lastMonthCompareEndUtc),
    lastMonthCompareDays,
    daysSoFar,
    currentYear: todayParts.year,
    currentMonth: todayParts.month,
  };
}
