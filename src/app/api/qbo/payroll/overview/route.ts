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

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const params = req.nextUrl.searchParams;
    const { startDate: defaultStart, endDate: defaultEnd } = getDefaultPeriod();
    const startDate = params.get("startDate") || defaultStart;
    const endDate = params.get("endDate") || defaultEnd;

    const [employeeData, timeData] = await Promise.all([
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
    ]);

    const employees: QboEmployee[] = employeeData?.QueryResponse?.Employee || [];
    const timeActivities: QboTimeActivity[] = timeData?.QueryResponse?.TimeActivity || [];

    const timeByEmployee = new Map<
      string,
      { hours: number; rates: number[]; lastDate?: string; name?: string }
    >();

    for (const activity of timeActivities) {
      const employeeKey = activity.EmployeeRef?.value || activity.EmployeeRef?.name || activity.NameOf || "Unknown";
      const entry = timeByEmployee.get(employeeKey) || { hours: 0, rates: [], name: activity.EmployeeRef?.name };
      const hours = parseHours(activity.Hours);
      const hourlyRate = toNumber(
        (activity.HourlyRate && "value" in (activity.HourlyRate as object)
          ? (activity.HourlyRate as { value?: number | string }).value
          : activity.HourlyRate) ?? 0
      );

      entry.hours += hours;
      if (hourlyRate > 0) entry.rates.push(hourlyRate);
      if (activity.TxnDate) entry.lastDate = activity.TxnDate;
      timeByEmployee.set(employeeKey, entry);
    }

    const team = employees.map((employee) => {
      const rawType = (employee.EmployeeType || "").toLowerCase();
      const type = rawType.includes("salary") ? "Salary" : "Hourly";
      const employeeKey = employee.Id || employee.DisplayName || employee.GivenName || "Unknown";
      const timeInfo = timeByEmployee.get(employeeKey) || timeByEmployee.get(employee.DisplayName || "") || {
        hours: 0,
        rates: [],
      };
      const inferredRate = timeInfo.rates.length
        ? timeInfo.rates.reduce((sum, rate) => sum + rate, 0) / timeInfo.rates.length
        : 0;
      const baseRate = toNumber(employee.BillRate) || inferredRate;

      const perPayrollCost = type === "Salary"
        ? (baseRate > 0 ? baseRate / 26 : 0)
        : (timeInfo.hours > 0 ? timeInfo.hours * baseRate : baseRate * 80);

      const displayName = employee.DisplayName || `${employee.GivenName || ""} ${employee.FamilyName || ""}`.trim();
      const lastUpdated = employee.MetaData?.LastUpdatedTime?.slice(0, 10) || null;

      return {
        id: employee.Id || employeeKey,
        fullName: displayName || employeeKey,
        role: employee.Title || employee.DepartmentRef?.name || "Team Member",
        type,
        rate: baseRate,
        status: employee.Active === false ? "Inactive" : "Active",
        lastIncreaseDate: lastUpdated,
        lastIncreaseAmount: baseRate,
        perPayrollCost,
      };
    });

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
