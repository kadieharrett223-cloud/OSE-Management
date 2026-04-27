import { createClient } from "@supabase/supabase-js";

const SHOPIFY_API_VERSION = "2024-01";

// Supabase client for token storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface ShopifyTokens {
  shop: string;
  access_token: string;
  scope: string;
  created_at?: string;
}

/**
 * Get stored Shopify tokens from Supabase
 */
export async function getShopifyTokens(): Promise<ShopifyTokens | null> {
  const { data, error } = await supabase
    .from("shopify_tokens")
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to get Shopify tokens:", error);
    return null;
  }

  return data as ShopifyTokens;
}

/**
 * Save Shopify tokens to Supabase
 */
export async function saveShopifyTokens(tokens: ShopifyTokens): Promise<void> {
  const { error } = await supabase
    .from("shopify_tokens")
    .upsert({
      shop: tokens.shop,
      access_token: tokens.access_token,
      scope: tokens.scope,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Failed to save Shopify tokens:", error);
    throw new Error("Failed to save Shopify tokens");
  }
}

/**
 * Build Shopify OAuth authorization URL
 */
export function buildShopifyAuthUrl(shop: string): string {
  const clientId = process.env.SHOPIFY_API_KEY!;
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI || 'https://ose-management.vercel.app/api/shopify/callback';
  const scopes = "read_products,write_products,read_orders,read_checkouts,read_shopify_payments_payouts";
  const nonce = Math.random().toString(36).substring(7);

  console.log('[Shopify] Building auth URL:', { shop, clientId: clientId?.substring(0, 8), redirectUri });

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state: nonce,
  });

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  shop: string,
  code: string
): Promise<ShopifyTokens> {
  const clientId = process.env.SHOPIFY_API_KEY!;
  const clientSecret = process.env.SHOPIFY_API_SECRET!;

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify OAuth error: ${text}`);
  }

  const data = await response.json();
  return {
    shop,
    access_token: data.access_token,
    scope: data.scope,
  };
}

/**
 * Make authenticated request to Shopify API
 */
export async function shopifyApiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const tokens = await getShopifyTokens();
  if (!tokens) {
    throw new Error("No Shopify connection. Please connect your Shopify store first.");
  }

  const url = `https://${tokens.shop}/admin/api/${SHOPIFY_API_VERSION}${endpoint}`;
  const headers = new Headers(options.headers || {});
  headers.set("X-Shopify-Access-Token", tokens.access_token);
  headers.set("Content-Type", "application/json");

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Shopify API error:", {
      status: response.status,
      statusText: response.statusText,
      url,
      body: text,
    });
    throw new Error(`Shopify API error ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

/**
 * Get all Shopify products
 */
export async function getShopifyProducts() {
  const tokens = await getShopifyTokens();
  if (!tokens) {
    throw new Error("No Shopify connection. Please connect your Shopify store first.");
  }

  const allProducts: any[] = [];
  let nextUrl: string | null = `https://${tokens.shop}/admin/api/${SHOPIFY_API_VERSION}/products.json?limit=250`;

  const getNextPageUrl = (linkHeader: string | null): string | null => {
    if (!linkHeader) return null;
    const links = linkHeader.split(",").map((part) => part.trim());
    const next = links.find((link) => /rel="next"/.test(link));
    if (!next) return null;
    const match = next.match(/<([^>]+)>/);
    return match?.[1] || null;
  };

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        "X-Shopify-Access-Token": tokens.access_token,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { products: any[] };
    allProducts.push(...(data.products || []));
    nextUrl = getNextPageUrl(response.headers.get("Link"));
  }

  return allProducts;
}

type ShopifyCollection = {
  id: number;
  title: string;
  handle: string;
  products_count?: number;
};

export async function getShopifyCollections(): Promise<ShopifyCollection[]> {
  const [custom, smart] = await Promise.all([
    shopifyApiFetch<{ custom_collections: ShopifyCollection[] }>(
      "/custom_collections.json?limit=250"
    ),
    shopifyApiFetch<{ smart_collections: ShopifyCollection[] }>(
      "/smart_collections.json?limit=250"
    ),
  ]);

  return [...(custom.custom_collections || []), ...(smart.smart_collections || [])];
}

async function fetchProductIdsForCollections(collectionIds: string[]): Promise<number[]> {
  const allIds: number[] = [];

  for (const collectionId of collectionIds) {
    const data = await shopifyApiFetch<{ collects: Array<{ product_id: number }> }>(
      `/collects.json?collection_id=${collectionId}&limit=250`
    );
    (data.collects || []).forEach((collect) => allIds.push(collect.product_id));
  }

  return Array.from(new Set(allIds));
}

async function fetchProductsByIds(productIds: number[]) {
  if (productIds.length === 0) return [];

  const chunks: number[][] = [];
  for (let i = 0; i < productIds.length; i += 250) {
    chunks.push(productIds.slice(i, i + 250));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      shopifyApiFetch<{ products: any[] }>(`/products.json?ids=${chunk.join(",")}`)
    )
  );

  return results.flatMap((res) => res.products || []);
}

export async function getShopifyProductsByCollectionIds(collectionIds: string[]) {
  if (!collectionIds || collectionIds.length === 0) {
    return getShopifyProducts();
  }

  const productIds = await fetchProductIdsForCollections(collectionIds);
  return fetchProductsByIds(productIds);
}

/**
 * Update product variant price in Shopify
 */
export async function updateShopifyPrice(
  variantId: number, 
  newPrice: number, 
  compareAtPrice?: number | null
): Promise<void> {
  const body: any = {
    variant: {
      id: variantId,
      price: newPrice.toFixed(2),
    },
  };
  
  // Only set compare_at_price if provided (null will clear it)
  if (compareAtPrice !== undefined) {
    body.variant.compare_at_price = compareAtPrice ? compareAtPrice.toFixed(2) : null;
  }
  
  await shopifyApiFetch(`/variants/${variantId}.json`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/**
 * Sync prices from price list to Shopify using mapped variant IDs
 */
export async function syncPricesToShopify(): Promise<{
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
}> {
  const result = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    // Get price list items with Shopify mappings
    const { data: priceListItems, error: priceListError } = await supabase
      .from("price_list_items")
      .select("item_no, sell_price, list_price, shopify_variant_id")
      .eq("is_active", true);

    if (priceListError || !priceListItems) {
      throw new Error(`Failed to fetch price list: ${priceListError?.message}`);
    }

    console.log(`Loaded ${priceListItems.length} price list items`);

    // Update prices for mapped items
    for (const item of priceListItems) {
      // Skip if no Shopify mapping
      if (!item.shopify_variant_id) {
        result.skipped++;
        continue;
      }

      const variantId = parseInt(item.shopify_variant_id);
      if (isNaN(variantId)) {
        result.skipped++;
        continue;
      }

      const basePrice = item.sell_price;
      const listPrice = item.list_price;

      if (!basePrice || basePrice <= 0) {
        result.skipped++;
        console.log(`No valid sell_price for ${item.item_no}`);
        continue;
      }

      try {
        const compareAt = listPrice && listPrice > 0 ? listPrice : null;

        await updateShopifyPrice(variantId, basePrice, compareAt);
        result.success++;
        console.log(`Updated ${item.item_no}: base=$${basePrice}${compareAt ? ` compare_at=$${compareAt}` : ""}`);
      } catch (error: any) {
        result.failed++;
        const errorMsg = `Failed to update ${item.item_no}: ${error.message}`;
        result.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    return result;
  } catch (error: any) {
    console.error("Sync error:", error);
    result.errors.push(error.message);
    return result;
  }
}
