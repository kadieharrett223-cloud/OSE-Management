import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch } from "@/lib/qbo";
import { getServerSupabaseClient } from "@/lib/supabase";

interface QboItem {
  Id: string;
  Name: string;
  Sku?: string;
  Description?: string;
}

interface MatchResult {
  priceListSku: string;
  qboItemId: string;
  qboItemName: string;
  matchType: "exact" | "fuzzy" | "manual";
  confidence: number;
}

/**
 * GET /api/admin/sync/price-list-items
 * Fetch all QBO items and optionally sync matches to price list
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const sync = searchParams.get("sync") === "true";

    // Fetch QBO items
    const query = "SELECT * FROM Item";
    const qboData = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(query)}&minorversion=65`
    );

    const qboItems = qboData?.QueryResponse?.Item || [];

    // Fetch price list items
    const supabase = await getServerSupabaseClient();
    const { data: priceListItems, error: priceListError } = await supabase
      .from("price_list_items")
      .select("id, sku, description, qbo_item_id, qbo_item_name");

    if (priceListError) {
      return NextResponse.json(
        { error: "Failed to fetch price list items" },
        { status: 500 }
      );
    }

    // Find matches
    const matches: MatchResult[] = [];
    const updatePromises: Promise<any>[] = [];

    for (const priceItem of priceListItems || []) {
      const match = findBestMatch(priceItem, qboItems);

      if (match) {
        matches.push(match);

        // If sync is enabled and match is new, update the price list
        if (sync && match.confidence > 0.5) {
          const updatePromise = supabase
            .from("price_list_items")
            .update({
              qbo_item_id: match.qboItemId,
              qbo_item_name: match.qboItemName,
              last_synced_with_qbo: new Date().toISOString(),
            })
            .eq("sku", priceItem.sku);

          updatePromises.push(updatePromise);
        }
      }
    }

    // Execute all updates in parallel
    if (sync && updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    return NextResponse.json({
      ok: true,
      qboItemsCount: qboItems.length,
      priceListItemsCount: priceListItems?.length || 0,
      matchesFound: matches.length,
      matches,
      synced: sync ? updatePromises.length : 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to sync items" },
      { status: 500 }
    );
  }
}

/**
 * Find the best matching QBO item for a price list item
 * Strategy: try exact match, then fuzzy match
 */
function findBestMatch(
  priceItem: any,
  qboItems: QboItem[]
): MatchResult | null {
  const priceSku = priceItem.sku.toUpperCase();
  const priceDesc = (priceItem.description || "").toUpperCase();

  // If already matched, skip
  if (priceItem.qbo_item_id) {
    return null;
  }

  // 1. Try exact match on SKU
  for (const qboItem of qboItems) {
    if (qboItem.Sku && qboItem.Sku.toUpperCase() === priceSku) {
      return {
        priceListSku: priceItem.sku,
        qboItemId: qboItem.Id,
        qboItemName: qboItem.Name,
        matchType: "exact",
        confidence: 1.0,
      };
    }
  }

  // 2. Try match on item name
  for (const qboItem of qboItems) {
    if (qboItem.Name.toUpperCase() === priceSku) {
      return {
        priceListSku: priceItem.sku,
        qboItemId: qboItem.Id,
        qboItemName: qboItem.Name,
        matchType: "exact",
        confidence: 1.0,
      };
    }
  }

  // 3. Try fuzzy match - check if QBO name contains price SKU
  for (const qboItem of qboItems) {
    const qboName = qboItem.Name.toUpperCase();
    const qboSku = (qboItem.Sku || "").toUpperCase();

    if (qboName.includes(priceSku) || qboSku.includes(priceSku)) {
      return {
        priceListSku: priceItem.sku,
        qboItemId: qboItem.Id,
        qboItemName: qboItem.Name,
        matchType: "fuzzy",
        confidence: 0.75,
      };
    }
  }

  // 4. Try fuzzy match - check if price description matches QBO name/SKU
  if (priceDesc.length > 3) {
    for (const qboItem of qboItems) {
      const qboName = qboItem.Name.toUpperCase();
      const qboDesc = (qboItem.Description || "").toUpperCase();

      // Check if words overlap
      const priceWords = priceDesc.split(/\s+/).filter((w) => w.length > 2);
      const qboWords = new Set([...qboName.split(/\s+/), ...qboDesc.split(/\s+/)]);

      const matchingWords = priceWords.filter((w) => qboWords.has(w)).length;
      const confidence = matchingWords / Math.max(priceWords.length, 1);

      if (confidence > 0.5) {
        return {
          priceListSku: priceItem.sku,
          qboItemId: qboItem.Id,
          qboItemName: qboItem.Name,
          matchType: "fuzzy",
          confidence,
        };
      }
    }
  }

  return null;
}
