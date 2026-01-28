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
  const scopes = "read_products,write_products";
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
  interface ShopifyProductsResponse {
    products: Array<{
      id: number;
      title: string;
      variants: Array<{
        id: number;
        sku: string;
        price: string;
        inventory_item_id: number;
      }>;
    }>;
  }

  const data = await shopifyApiFetch<ShopifyProductsResponse>("/products.json?limit=250");
  return data.products;
}

/**
 * Update product variant price in Shopify
 */
export async function updateShopifyPrice(variantId: number, newPrice: number): Promise<void> {
  await shopifyApiFetch(`/variants/${variantId}.json`, {
    method: "PUT",
    body: JSON.stringify({
      variant: {
        id: variantId,
        price: newPrice.toFixed(2),
      },
    }),
  });
}

/**
 * Sync prices from price list to Shopify
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
    // Get price list from Supabase
    const { data: priceListItems, error: priceListError } = await supabase
      .from("price_list_items")
      .select("item_no, list_price")
      .eq("is_active", true);

    if (priceListError || !priceListItems) {
      throw new Error(`Failed to fetch price list: ${priceListError?.message}`);
    }

    // Create SKU -> Price map
    const priceMap = new Map<string, number>();
    for (const item of priceListItems) {
      if (item.item_no && item.list_price) {
        priceMap.set(item.item_no.trim().toUpperCase(), item.list_price);
      }
    }

    console.log(`Loaded ${priceMap.size} prices from price list`);

    // Get Shopify products
    const shopifyProducts = await getShopifyProducts();
    console.log(`Found ${shopifyProducts.length} Shopify products`);

    // Update prices
    for (const product of shopifyProducts) {
      for (const variant of product.variants) {
        if (!variant.sku) {
          result.skipped++;
          continue;
        }

        const sku = variant.sku.trim().toUpperCase();
        const newPrice = priceMap.get(sku);

        if (!newPrice) {
          result.skipped++;
          console.log(`No price found for SKU: ${sku}`);
          continue;
        }

        const currentPrice = parseFloat(variant.price);
        if (Math.abs(currentPrice - newPrice) < 0.01) {
          result.skipped++;
          console.log(`Price unchanged for SKU ${sku}: $${currentPrice}`);
          continue;
        }

        try {
          await updateShopifyPrice(variant.id, newPrice);
          result.success++;
          console.log(`Updated ${sku}: $${currentPrice} -> $${newPrice}`);
        } catch (error: any) {
          result.failed++;
          const errorMsg = `Failed to update ${sku}: ${error.message}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }
    }

    return result;
  } catch (error: any) {
    console.error("Sync error:", error);
    result.errors.push(error.message);
    return result;
  }
}
