import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { authorizedQboFetch } from "@/lib/qbo";
import { getServerSupabaseClient } from "@/lib/supabase";

const ALLOWED_RECURRING = new Set(["none", "daily", "weekly", "biweekly", "monthly", "yearly"]);

function parseRecipientList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getTzNow(timeZone: string): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone }));
}

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function occursOnDate(row: any, target: Date): boolean {
  const recurring = row?.recurring;
  if (!ALLOWED_RECURRING.has(recurring)) return false;

  const eventDate = new Date(`${row.event_date}T00:00:00`);
  if (Number.isNaN(eventDate.getTime())) return false;

  if (recurring === "none") {
    return getDateKey(eventDate) === getDateKey(target);
  }

  if (recurring === "daily") return true;

  if (recurring === "weekly") {
    return eventDate.getDay() === target.getDay();
  }

  if (recurring === "biweekly") {
    const diffMs = target.getTime() - eventDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays % 14 === 0;
  }

  if (recurring === "monthly") {
    return eventDate.getDate() === target.getDate();
  }

  if (recurring === "yearly") {
    return eventDate.getMonth() === target.getMonth() && eventDate.getDate() === target.getDate();
  }

  return false;
}

async function runJob(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (cronSecret && bearer !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recipients = parseRecipientList(process.env.MOBILE_NOTIFICATION_SMS_TO);
    if (recipients.length === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: "No SMS recipients configured" });
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      return NextResponse.json(
        { error: "SMTP_HOST, SMTP_USER, and SMTP_PASSWORD are required for mobile SMS delivery" },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const timeZone = process.env.MOBILE_NOTIFICATION_TIMEZONE || "America/New_York";
    const now = getTzNow(timeZone);
    const today = getDateKey(now);
    const currentHour = now.getHours();

    const supabase = getServerSupabaseClient();

    // 1) Customer payment notifications (new payments today)
    const paymentData = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(`SELECT * FROM Payment WHERE TxnDate >= '${today}' AND TxnDate <= '${today}' ORDERBY TxnDate DESC`)}&minorversion=65`
    );

    const payments = paymentData?.QueryResponse?.Payment || [];
    let paymentAlertsSent = 0;

    for (const payment of payments) {
      const paymentId = String(payment?.Id || "").trim();
      if (!paymentId) continue;

      const { data: existingLog } = await supabase
        .from("customer_payment_sms_logs")
        .select("id")
        .eq("qbo_payment_id", paymentId)
        .maybeSingle();

      if (existingLog?.id) continue;

      const total = Number(payment?.TotalAmt) || 0;
      const unapplied = Number(payment?.UnappliedAmt) || 0;
      const applied = Math.max(0, total - unapplied);
      const customerName = payment?.CustomerRef?.name || "Customer";
      const paymentDate = payment?.TxnDate || today;

      const smsText = `Payment received: ${customerName}, $${applied.toFixed(2)}, ${paymentDate}`;

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: recipients.join(","),
        subject: "Customer payment received",
        text: smsText,
      });

      await supabase.from("customer_payment_sms_logs").insert({
        qbo_payment_id: paymentId,
        payment_date: paymentDate,
        customer_name: customerName,
        applied_amount: applied,
      });

      paymentAlertsSent += 1;
    }

    // 2) Calendar manual notification reminders at 8 AM local time (day-of)
    let calendarAlertsSent = 0;
    if (currentHour >= 8) {
      const { data: calendarRows, error: calendarError } = await supabase
        .from("calendar_mobile_notifications")
        .select("id, title, event_date, recurring, notes, last_sent_for_date")
        .eq("is_active", true);

      if (calendarError) {
        throw calendarError;
      }

      for (const row of calendarRows || []) {
        if (!occursOnDate(row, now)) continue;
        if (row.last_sent_for_date === today) continue;

        const smsText = [
          `Reminder: ${row.title}`,
          `Date: ${today}`,
          row.notes ? `Notes: ${row.notes}` : null,
        ]
          .filter(Boolean)
          .join(" | ");

        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: recipients.join(","),
          subject: "Calendar reminder",
          text: smsText,
        });

        await supabase
          .from("calendar_mobile_notifications")
          .update({
            last_sent_for_date: today,
            last_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        calendarAlertsSent += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      timeZone,
      now: now.toISOString(),
      today,
      paymentAlertsSent,
      calendarAlertsSent,
      recipients,
    });
  } catch (error: any) {
    console.error("[mobile-notifications] cron error", error);
    return NextResponse.json(
      { error: error?.message || "Failed to run mobile notification job" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return runJob(req);
}

export async function POST(req: NextRequest) {
  return runJob(req);
}
