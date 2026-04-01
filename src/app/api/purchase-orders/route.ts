import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const session: any = await getSession();

  const supabase = getServerSupabaseClient();
  const params = req.nextUrl.searchParams;
  const status = params.get("status");
  const china = params.get("china");

  try {
    const normalizeCurrency = (value: unknown): number => {
      if (typeof value === "number") return Number.isFinite(value) ? value : 0;
      if (typeof value === "string") {
        const cleaned = value.replace(/[^0-9.-]/g, "");
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    const deriveTotalFromLines = (po: any): number => {
      const lines = Array.isArray(po?.lines) ? po.lines : [];
      if (lines.length === 0) return normalizeCurrency(po?.total_amount);

      return lines.reduce((sum: number, line: any) => {
        const quantity = normalizeCurrency(line?.quantity);
        const unitPrice = normalizeCurrency(line?.unit_price);
        const fallbackLineTotal = quantity * unitPrice;
        const lineTotal = normalizeCurrency(line?.line_total);
        return sum + (lineTotal || fallbackLineTotal);
      }, 0);
    };

    const derivePaymentStatus = (po: any): string => {
      const paidAmount = (Array.isArray(po?.payments) ? po.payments : []).reduce(
        (sum: number, payment: any) => sum + normalizeCurrency(payment?.amount),
        0
      );
      const totalAmount = deriveTotalFromLines(po);

      if (paidAmount <= 0) return "TO_BE_PAID";
      if (totalAmount <= 0 || paidAmount >= totalAmount - 0.01) return "PAID";
      return "DEPOSIT_DOWN";
    };

    const enrichPurchaseOrdersWithFobCosts = async (purchaseOrders: any[]) => {
      const allSkus = Array.from(
        new Set(
          (purchaseOrders || [])
            .flatMap((po: any) => (Array.isArray(po?.lines) ? po.lines : []))
            .map((line: any) => String(line?.sku || "").trim())
            .filter(Boolean)
        )
      );

      if (allSkus.length === 0) {
        return (purchaseOrders || []).map((po: any) => ({
          ...po,
          total_amount: deriveTotalFromLines(po),
        }));
      }

      const { data: priceItems, error: priceError } = await supabase
        .from("price_list_items")
        .select("item_no, fob_cost")
        .in("item_no", allSkus)
        .eq("is_active", true);

      if (priceError) {
        console.warn("Unable to enrich purchase orders with FOB costs:", priceError.message);
        return (purchaseOrders || []).map((po: any) => ({
          ...po,
          total_amount: deriveTotalFromLines(po),
        }));
      }

      const fobBySku = new Map<string, number>();
      for (const item of priceItems || []) {
        const sku = String(item.item_no || "").trim().toLowerCase();
        const fob = Number(item.fob_cost);
        if (sku && Number.isFinite(fob) && fob > 0) {
          fobBySku.set(sku, fob);
        }
      }

      return (purchaseOrders || []).map((po: any) => {
        const lines = (Array.isArray(po?.lines) ? po.lines : []).map((line: any) => {
          const skuKey = String(line?.sku || "").trim().toLowerCase();
          const fobCost = fobBySku.get(skuKey);
          if (!fobCost) return line;

          const quantity = normalizeCurrency(line?.quantity);
          return {
            ...line,
            unit_price: fobCost,
            line_total: quantity * fobCost,
          };
        });

        return {
          ...po,
          lines,
          status: derivePaymentStatus({ ...po, lines }),
          total_amount: deriveTotalFromLines({ ...po, lines }),
        };
      });
    };

    let query = supabase
      .from("purchase_orders")
      .select(`
        *,
        lines:purchase_order_lines(*),
        payments:purchase_order_payments(*)
      `)
      .order("order_date", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    if (china === "true") {
      query = query.eq("is_china_supplier", true);
    }

    const { data, error } = await query;
    if (error) throw error;

    const normalizedData = await enrichPurchaseOrdersWithFobCosts(data || []);

    return NextResponse.json({ ok: true, data: normalizedData });
  } catch (error: any) {
    console.error("Fetch purchase orders error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session: any = await getSession();

  const body = await req.json();
  const {
    po_number,
    vendor_name,
    vendor_address,
    vendor_city_state_zip,
    vendor_contact_name,
    vendor_email,
    vendor_phone,
    ship_to_name,
    ship_to_address,
    ship_to_city_state_zip,
    representative,
    authorized_by,
    destination,
    terms,
    payment_method,
    order_date,
    expected_delivery,
    status,
    notes,
    lines,
    is_china_supplier,
    country,
  } = body;

  // Normalize dates to avoid empty-string failures when the client sends ""
  const orderDate = order_date || new Date().toISOString().split("T")[0];
  const expectedDelivery = expected_delivery || null;

  if (!po_number || !vendor_name || !orderDate || !Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json(
      { error: "po_number, vendor_name, order_date, and lines are required" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabaseClient();

  try {
    // Calculate total
    const total_amount = lines.reduce((sum: number, line: any) => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unit_price) || 0;
      return sum + qty * price;
    }, 0);

    // Create PO
    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .insert({
        po_number,
        vendor_name,
        vendor_address,
        vendor_city_state_zip,
        vendor_contact_name,
        vendor_email,
        vendor_phone,
        ship_to_name,
        ship_to_address,
        ship_to_city_state_zip,
        representative,
        authorized_by,
        destination,
        terms,
        payment_method,
        order_date: orderDate,
        expected_delivery: expectedDelivery,
        total_amount,
        status: status || "DRAFT",
        notes,
        is_china_supplier: is_china_supplier || false,
        country: country || "USA",
        created_by_user_id: session.user?.id || null,
      })
      .select()
      .single();

    if (poError) throw poError;

    // Create lines
    const linesData = lines.map((line: any, index: number) => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unit_price) || 0;
      return {
        purchase_order_id: po.id,
        line_number: index + 1,
        sku: line.sku || "",
        description: line.description || "",
        quantity: qty,
        unit_price: price,
        line_total: qty * price,
        weight_lbs: line.weight_lbs ? Number(line.weight_lbs) : null,
      };
    });

    const { error: linesError } = await supabase.from("purchase_order_lines").insert(linesData);
    if (linesError) throw linesError;

    // Auto-generate PDF for China suppliers
    if (is_china_supplier) {
      try {
        const generatePdfRes = await fetch(
          `${req.nextUrl.origin}/api/purchase-orders/${po.id}/generate-pdf`,
          { method: "POST" }
        );
        if (!generatePdfRes.ok) {
          console.error("Failed to auto-generate PDF for China PO");
        }
      } catch (pdfError) {
        console.error("PDF generation error:", pdfError);
        // Don't fail the PO creation if PDF generation fails
      }
    }

    return NextResponse.json({ ok: true, data: po }, { status: 201 });
  } catch (error: any) {
    console.error("Create purchase order error:", error);
    return NextResponse.json({ error: error.message || "Failed to create" }, { status: 500 });
  }
}
