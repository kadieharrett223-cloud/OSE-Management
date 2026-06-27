import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { QboApiError } from "@/lib/qbo";
import { findQboInvoiceByNumber, QboInvoice } from "@/lib/inventory-qbo";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServerSupabaseClient();

    const { data: product, error: productError } = await supabase
      .from("inventory_products")
      .select("id")
      .eq("id", params.id)
      .maybeSingle();

    if (productError) throw productError;

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const { data: orders, error: ordersError } = await supabase
      .from("inventory_order_entries")
      .select("id, created_at, updated_at, customer_name, invoice_number")
      .eq("product_id", params.id)
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    return NextResponse.json({
      data: (orders || []).map((order: any) => ({
        id: order.id,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        customerName: order.customer_name,
        invoiceNumber: order.invoice_number,
      })),
    });
  } catch (error) {
    console.error("inventory order list error", error);
    return NextResponse.json({ error: "Failed to load order entries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const customerName = String(body?.customerName || "").trim();
  const invoiceNumber = String(body?.invoiceNumber || "").trim();

  if (!invoiceNumber) {
    return NextResponse.json({ error: "Invoice number is required" }, { status: 400 });
  }

  try {
    const supabase = getServerSupabaseClient();
    const userId = (await getUserId()) || undefined;

    let qboInvoice: QboInvoice | undefined;
    try {
      qboInvoice = await findQboInvoiceByNumber(invoiceNumber, userId);
    } catch (error) {
      if (error instanceof QboApiError) {
        return NextResponse.json(
          { error: "Failed to verify invoice with QuickBooks", details: error.message },
          { status: error.status }
        );
      }
      throw error;
    }

    if (!qboInvoice) {
      return NextResponse.json({ error: "Invoice number not found in QuickBooks" }, { status: 404 });
    }

    const canonicalInvoiceNumber = String(qboInvoice.DocNumber || invoiceNumber).trim();
    const canonicalCustomerName = String(qboInvoice.CustomerRef?.name || customerName || "").trim() || "Unknown Customer";

    const { data: product, error: productError } = await supabase
      .from("inventory_products")
      .select("id")
      .eq("id", params.id)
      .maybeSingle();

    if (productError) throw productError;

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("inventory_order_entries")
      .select("id, customer_name, invoice_number")
      .eq("product_id", params.id)
      .eq("invoice_number", canonicalInvoiceNumber)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return NextResponse.json(
        {
          error: "Invoice is already linked to this product",
          data: {
            id: (existing as any).id,
            customerName: (existing as any).customer_name,
            invoiceNumber: (existing as any).invoice_number,
          },
        },
        { status: 409 }
      );
    }

    const { data: created, error: createdError } = await supabase
      .from("inventory_order_entries")
      .insert({
        product_id: params.id,
        customer_name: canonicalCustomerName,
        invoice_number: canonicalInvoiceNumber,
      })
      .select("id, created_at, updated_at, customer_name, invoice_number")
      .single();

    if (createdError) {
      if ((createdError as any).code === "23505") {
        return NextResponse.json({ error: "Invoice is already linked to this product" }, { status: 409 });
      }
      throw createdError;
    }

    return NextResponse.json(
      {
        data: {
          id: (created as any).id,
          createdAt: (created as any).created_at,
          updatedAt: (created as any).updated_at,
          customerName: (created as any).customer_name,
          invoiceNumber: (created as any).invoice_number,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("inventory order create error", error);
    return NextResponse.json({ error: "Failed to create order entry" }, { status: 500 });
  }
}
