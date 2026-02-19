import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch, QboApiError } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatDate = (value: Date) => value.toISOString().slice(0, 10);

const addDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDate(date);
};

const getDefaultPeriod = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 13);
  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
};

const parseHours = (value: unknown) => {
  if (typeof value === "string") {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "value" in value) {
    return toNumber((value as { value?: number | string }).value);
  }
  return 0;
};

const ACTIVE_EMPLOYEES = new Set(
  [
    "chad",
    "deacon",
    "emma",
    "kadie",
    "michael",
    "nick",
    "nickolas",
    "paul",
    "peter",
    "robert",
    "shandra",
    "stephen",
    "thomas",
    "traci",
  ].map((name) => name.toLowerCase())
);

type QboEmployee = {
  Id: string;
  DisplayName?: string;
  GivenName?: string;
  FamilyName?: string;
  EmployeeType?: string;
  Title?: string;
  DepartmentRef?: { name?: string };
  BillRate?: number | string;
  Active?: boolean;
  MetaData?: { LastUpdatedTime?: string };
};

type QboTimeActivity = {
  TxnDate?: string;
  EmployeeRef?: { value?: string; name?: string };
  NameOf?: string;
  Hours?: number | string | { value?: number | string };
  HourlyRate?: number | string | { value?: number | string };
  HourlyRateSpecified?: boolean;
};

const getPeriodWindow = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (diffDays - 1));
  return {
    prevStartDate: formatDate(prevStart),
    prevEndDate: formatDate(prevEnd),
  };
};

const getFirstNameFromLabel = (fullName: string) =>
  (fullName.split(" ")[0] || fullName || "Unknown").toLowerCase();

const buildTimeMap = (activities: QboTimeActivity[]) => {
  const map = new Map<string, { hours: number; rates: number[]; name?: string }>();

  for (const activity of activities) {
    const employeeKey = activity.EmployeeRef?.value || activity.EmployeeRef?.name || activity.NameOf || "Unknown";
    const entry = map.get(employeeKey) || { hours: 0, rates: [], name: activity.EmployeeRef?.name };
    const hours = parseHours(activity.Hours);
    const hourlyRate = toNumber(
      (activity.HourlyRate && "value" in (activity.HourlyRate as object)
        ? (activity.HourlyRate as { value?: number | string }).value
        : activity.HourlyRate) ?? 0
    );

    entry.hours += hours;
    if (hourlyRate > 0) entry.rates.push(hourlyRate);
    map.set(employeeKey, entry);
  }

  return map;
};

const averageRate = (rates: number[]) =>
  rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0;

const getDefaultRateByRole = (role: string, type: "Hourly" | "Salary"): number => {
  const roleKey = (role || "").toLowerCase();
  const hourlyDefaults: Record<string, number> = {
    "manager": 35,
    "lead": 30,
    "supervisor": 28,
    "developer": 32,
    "engineer": 35,
    "designer": 30,
    "specialist": 28,
    "analyst": 28,
    "coordinator": 22,
    "administrator": 20,
    "technician": 25,
    "support": 18,
  };

  const salaryDefaults: Record<string, number> = {
    "manager": 80000,
    "lead": 70000,
    "supervisor": 65000,
    "developer": 75000,
    "engineer": 80000,
    "designer": 65000,
    "specialist": 60000,
    "analyst": 60000,
    "coordinator": 45000,
    "administrator": 40000,
    "technician": 50000,
    "support": 35000,
  };

  const defaults = type === "Salary" ? salaryDefaults : hourlyDefaults;

  for (const [key, value] of Object.entries(defaults)) {
    if (roleKey.includes(key)) {
      return value;
    }
  }

  return type === "Salary" ? 50000 : 24;
};

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const params = req.nextUrl.searchParams;
    const { startDate: defaultStart, endDate: defaultEnd } = getDefaultPeriod();
    const startDate = params.get("startDate") || defaultStart;
    const endDate = params.get("endDate") || defaultEnd;

    const { prevStartDate, prevEndDate } = getPeriodWindow(startDate, endDate);

    const [employeeData, timeData, previousTimeData] = await Promise.all([
      authorizedQboFetch<any>(
        `/query?query=${encodeURIComponent("SELECT * FROM Employee ORDERBY DisplayName")}&minorversion=65`,
        {},
        userId || undefined
      ),
      authorizedQboFetch<any>(
        `/query?query=${encodeURIComponent(
          `SELECT * FROM TimeActivity WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`
        )}&minorversion=65`,
        {},
        userId || undefined
      ).catch((error: unknown) => {
        if (error instanceof QboApiError) {
          return { QueryResponse: { TimeActivity: [] } };
        }
        throw error;
      }),
      authorizedQboFetch<any>(
        `/query?query=${encodeURIComponent(
          `SELECT * FROM TimeActivity WHERE TxnDate >= '${prevStartDate}' AND TxnDate <= '${prevEndDate}'`
        )}&minorversion=65`,
        {},
        userId || undefined
      ).catch((error: unknown) => {
        if (error instanceof QboApiError) {
          return { QueryResponse: { TimeActivity: [] } };
        }
        throw error;
      }),
    ]);

    const employees: QboEmployee[] = employeeData?.QueryResponse?.Employee || [];
    const timeActivities: QboTimeActivity[] = timeData?.QueryResponse?.TimeActivity || [];
    const previousTimeActivities: QboTimeActivity[] = previousTimeData?.QueryResponse?.TimeActivity || [];
    const timeByEmployee = buildTimeMap(timeActivities);
    const previousTimeByEmployee = buildTimeMap(previousTimeActivities);

    const mappedEmployees = employees.map((employee) => {
      const rawType = (employee.EmployeeType || "").toLowerCase();
      const type = rawType.includes("salary") ? "Salary" : "Hourly";
      const employeeKey = employee.Id || employee.DisplayName || employee.GivenName || "Unknown";
      const timeInfo = timeByEmployee.get(employeeKey) || timeByEmployee.get(employee.DisplayName || "") || {
        hours: 0,
        rates: [],
      };
      const previousTimeInfo = previousTimeByEmployee.get(employeeKey)
        || previousTimeByEmployee.get(employee.DisplayName || "")
        || { hours: 0, rates: [] };
      const currentRateFromTime = averageRate(timeInfo.rates);
      const previousRateFromTime = averageRate(previousTimeInfo.rates);
      const billRate = toNumber(employee.BillRate);
      const fallbackRate = getDefaultRateByRole(employee.Title || "", type);
      const currentRate = billRate || currentRateFromTime || previousRateFromTime || fallbackRate;
      const previousRate = previousRateFromTime || billRate || currentRateFromTime || fallbackRate;

      const perPayrollCost = type === "Salary"
        ? currentRate / 26
        : (timeInfo.hours > 0 ? timeInfo.hours * currentRate : currentRate * 80);

      const previousPayrollCost = type === "Salary"
        ? previousRate / 26
        : (previousTimeInfo.hours > 0 ? previousTimeInfo.hours * previousRate : previousRate * 80);

      const payrollChange = perPayrollCost - previousPayrollCost;

      const displayName = employee.DisplayName || `${employee.GivenName || ""} ${employee.FamilyName || ""}`.trim();
      const lastUpdated = employee.MetaData?.LastUpdatedTime?.slice(0, 10) || null;

      return {
        id: employee.Id || employeeKey,
        fullName: displayName || employeeKey,
        role: employee.Title || employee.DepartmentRef?.name || "Team Member",
        type,
        rate: currentRate,
        status: employee.Active === false ? "Inactive" : "Active",
        lastIncreaseDate: lastUpdated,
        lastIncreaseAmount: currentRate,
        perPayrollCost,
        previousPayrollCost,
        payrollChange,
      };
    });

    const team = mappedEmployees.filter((employee) => ACTIVE_EMPLOYEES.has(getFirstNameFromLabel(employee.fullName)));
    const terminated = mappedEmployees.filter(
      (employee) => !ACTIVE_EMPLOYEES.has(getFirstNameFromLabel(employee.fullName))
    );

    const payrollMeta = {
      payFrequency: "Bi-weekly",
      nextPayrollDate: addDays(endDate, 4),
      payPeriodStart: startDate,
      payPeriodEnd: endDate,
      approvalsDue: addDays(endDate, 2),
      payrollRun: addDays(endDate, 3),
    };

    return NextResponse.json({
      ok: true,
      period: { startDate, endDate },
      payrollMeta,
      team,
      terminated,
      previousPeriod: { startDate: prevStartDate, endDate: prevEndDate },
    });
  } catch (error: any) {
    if (error instanceof QboApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error?.message || "Failed to load payroll data from QBO" },
      { status: 500 }
    );
  }
}
