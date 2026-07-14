import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = getServerSupabaseClient();

  try {
    const { data: settings } = await supabase
      .from("pricing_settings")
      .select("global_tariff_percent")
      .eq("id", "00000000-0000-0000-0000-000000000002")
      .single();

    const globalTariffPercent = Number(settings?.global_tariff_percent ?? 100);

    const primarySelect = "id, item_no, description, list_price, sell_price, per_unit, cost_with_shipping, zone5_shipping, shipping_included_per_unit, weight_lbs, fob_cost, quantity, tariff_105, ocean_frt, importing, indirect_labor, direct_labor, overhead_cost, manual_pricing_override, tariff_exempt, margin, shopify_variant_id, website_product_url, category_id, price_list_categories(category_name)";

    const primaryResult = await supabase
      .from("price_list_items")
      .select(primarySelect)
      .eq("is_active", true);

    let data: any[] = primaryResult.data || [];
    let queryError: any = primaryResult.error;

    // Some environments can be missing newer columns/relationships.
    // Fall back to a minimal, stable query so SKU search still works.
    if (queryError) {
      console.warn("Primary price_list_items select failed; using minimal fallback:", queryError.message);
      const fallbackResult = await supabase
        .from("price_list_items")
        .select("id, item_no, description, list_price, sell_price, cost_with_shipping, zone5_shipping, weight_lbs, fob_cost, quantity")
        .eq("is_active", true);

      data = fallbackResult.data || [];
      queryError = fallbackResult.error;
    }

    if (queryError) throw queryError;

    // Sort by list_price from lowest to highest (cheapest to most expensive)
    const sortedData = (data || []).sort((a, b) => {
      const priceA = Number(a.list_price || 0);
      const priceB = Number(b.list_price || 0);
      return priceA - priceB;
    });

    const computeDerived = (item: any) => {
      const fobCost = Number(item?.fob_cost || 0);
      const quantity = Number(item?.quantity || 0);
      const zone5Shipping = Number(item?.zone5_shipping || 0);
      const indirectLabor = Number(item?.indirect_labor || 0);
      const directLabor = Number(item?.direct_labor || 0);
      const overheadCost = Number(item?.overhead_cost || 0);
      const margin = Number(item?.margin || 0);
      const tariffMultiplier = 1 + globalTariffPercent / 100;
      const isTariffExempt = item?.tariff_exempt === true;
      const isManualOverride = item?.manual_pricing_override === true;

      let tariff = 0;
      let oceanPerUnit = 0;
      let importingPerUnit = 0;

      if (isTariffExempt) {
        tariff = 0;
        oceanPerUnit = 0;
        importingPerUnit = 0;
      } else if (isManualOverride) {
        tariff = Number(item?.tariff_105 || 0);
        oceanPerUnit = Number(item?.ocean_frt || 0);
        importingPerUnit = Number(item?.importing || 0);
      } else {
        tariff = fobCost * tariffMultiplier;
        oceanPerUnit = quantity > 0 ? 8000 / quantity : Number(item?.ocean_frt || 0);
        importingPerUnit = quantity > 0 ? 2100 / quantity : Number(item?.importing || 0);
      }

      const perUnit = (isTariffExempt ? fobCost : tariff) + oceanPerUnit + importingPerUnit;
      const costWithShipping = perUnit + zone5Shipping + indirectLabor + directLabor + overheadCost;
      const sellPrice = costWithShipping * (1 + margin);
      const listPrice = Number(item?.list_price || sellPrice / 0.8 || 0);

      return {
        tariff,
        oceanPerUnit,
        importingPerUnit,
        perUnit,
        costWithShipping,
        sellPrice,
        listPrice,
      };
    };

    // Map to match expected format
    const items = (sortedData || []).map((item: any) => {
      const derived = computeDerived(item);

      return {
        id: item.id,
        sku: item.item_no,
        description: item.description || "",
        currentSalePricePerUnit: Number(derived.listPrice || 0),
        shippingIncludedPerUnit: Number(item.shipping_included_per_unit || 0),
        list_price: Number(derived.listPrice || 0),
        sell_price: Number(derived.sellPrice || 0),
        per_unit: Number(derived.perUnit || 0),
        cost_with_shipping: Number(derived.costWithShipping || 0),
        zone5_shipping: Number(item.zone5_shipping || 0),
        indirect_labor: Number(item.indirect_labor || 0),
        direct_labor: Number(item.direct_labor || 0),
        overhead_cost: Number(item.overhead_cost || 0),
        weight_lbs: item.weight_lbs ? Number(item.weight_lbs) : null,
        fob_cost: item.fob_cost ? Number(item.fob_cost) : null,
        quantity: item.quantity ? Number(item.quantity) : null,
        tariff_105: Number(derived.tariff || 0),
        ocean_frt: Number(derived.oceanPerUnit || 0),
        importing: Number(derived.importingPerUnit || 0),
        manual_pricing_override: item.manual_pricing_override === true,
        tariff_exempt: item.tariff_exempt === true,
        shopify_variant_id: item.shopify_variant_id || null,
        website_product_url: item.website_product_url || null,
        category_id: item.category_id || null,
        category_name: item.price_list_categories?.category_name || null,
      };
    });

    const response = NextResponse.json(items);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    return response;
  } catch (error: any) {
    console.error("Fetch price list error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch" }, { status: 500 });
  }
}
