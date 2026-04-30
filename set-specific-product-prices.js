const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = '.env.local';
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const updates = [
  { inputSku: '2PCFHD-15', item_no: '2PCFHD-15', sell_price: 7354.00, list_price: 9192.50 },
  { inputSku: '2PCFHD-12', item_no: '2PCFHD-12', sell_price: 5850.00, list_price: 7312.50 },
  { inputSku: '2PBP-12', item_no: '2PBP-12', sell_price: 5145.00, list_price: 6431.25 },
  { inputSku: '2PDDA-10', item_no: '2PDDA-10', sell_price: 4924.00, list_price: 6155.00 },
  { inputSku: '2PCFXL-10', item_no: '2PCFXL-10', sell_price: 4665.00, list_price: 5831.25 },
  { inputSku: '2PBBXW-10', item_no: '2PBPXW-10', sell_price: 3766.00, list_price: 4707.50 },
  { inputSku: '2PBP-10', item_no: '2PBP-10', sell_price: 3539.00, list_price: 4423.75 },
  { inputSku: '2PCF-9', item_no: '2PCF-9', sell_price: 3474.00, list_price: 4342.50 },
  { inputSku: '2PBP-8', item_no: '2PBP-8', sell_price: 2824.00, list_price: 3530.00 },
  { inputSku: '4PXLA-10', item_no: '4PXLA-10', sell_price: 9499.00, list_price: 11873.75 },
  { inputSku: '4PXL-10B', item_no: '4PXL-10B', sell_price: 8333.00, list_price: 10416.25 },
  { inputSku: 'HDMBL-10', item_no: 'HDMBL-10', sell_price: 6105.71, list_price: 7632.14 },
  { inputSku: '4PHDXLA-11', item_no: '4PHDXLA-11', sell_price: 11775.49, list_price: 14719.36 },
  { inputSku: '4PHDXL-12', item_no: '4PHDXL-12', sell_price: 6813.81, list_price: 8517.26 },
  { inputSku: '4PXW-10', item_no: '4PXW-10', sell_price: 8492.00, list_price: 10615.00 },
  { inputSku: '4PXL-10', item_no: '4PXL-10', sell_price: 5751.24, list_price: 7189.05 },
  { inputSku: '4PHR-9X', item_no: '4PHR-9X', sell_price: 4767.00, list_price: 5958.75 },
  { inputSku: 'HDMBL-9', item_no: 'HDMBL-9', sell_price: 5330.00, list_price: 6662.50 },
  { inputSku: '4PML-9', item_no: '4PML-9', sell_price: 3719.00, list_price: 4648.75 },
];

async function getShopifyTokens() {
  const { data, error } = await supabase.from('shopify_tokens').select('*').single();
  if (error || !data) {
    console.warn('No Shopify tokens found; DB prices will be updated but Shopify sync will be skipped.');
    return null;
  }
  return data;
}

async function updateShopifyVariant(tokens, variantId, price, compareAtPrice) {
  const shop = tokens.shop;
  const accessToken = tokens.access_token;
  const url = `https://${shop}/admin/api/2024-01/variants/${variantId}.json`;
  const body = {
    variant: {
      id: variantId,
      price: price.toFixed(2),
      compare_at_price: compareAtPrice.toFixed(2),
    },
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify ${variantId}: ${res.status} ${text}`);
  }
}

async function run() {
  const tokens = await getShopifyTokens();
  let dbUpdated = 0;
  let shopifyUpdated = 0;
  const missing = [];
  const shopifyErrors = [];

  for (const update of updates) {
    const { data: row, error: fetchError } = await supabase
      .from('price_list_items')
      .select('id, item_no, zone5_shipping, shopify_variant_id')
      .eq('item_no', update.item_no)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError || !row) {
      missing.push(update.inputSku);
      console.error(`Missing SKU: ${update.inputSku} (mapped to ${update.item_no})`);
      continue;
    }

    const zone5 = Number(row.zone5_shipping || 0);
    const perUnit = Number((update.sell_price - zone5).toFixed(2));

    const payload = {
      manual_pricing_override: true,
      margin: 0,
      tariff_105: 0,
      ocean_frt: 0,
      importing: 0,
      per_unit: perUnit,
      cost_with_shipping: update.sell_price,
      list_price: update.list_price,
    };

    const { error: updateError } = await supabase
      .from('price_list_items')
      .update(payload)
      .eq('id', row.id);

    if (updateError) {
      console.error(`DB update failed for ${update.inputSku}: ${updateError.message}`);
      continue;
    }

    dbUpdated += 1;
    console.log(`✓ DB ${update.inputSku}: sell=$${update.sell_price.toFixed(2)} list=$${update.list_price.toFixed(2)}`);

    if (tokens && row.shopify_variant_id) {
      try {
        await updateShopifyVariant(tokens, Number(row.shopify_variant_id), update.sell_price, update.list_price);
        shopifyUpdated += 1;
        console.log(`✓ Shopify ${update.inputSku}`);
      } catch (error) {
        shopifyErrors.push(`${update.inputSku}: ${error.message}`);
        console.error(`✗ Shopify ${update.inputSku}: ${error.message}`);
      }
    }
  }

  console.log('\nDone.');
  console.log(`DB updated: ${dbUpdated}`);
  console.log(`Shopify updated: ${shopifyUpdated}`);
  if (missing.length) console.log(`Missing SKUs: ${missing.join(', ')}`);
  if (shopifyErrors.length) console.log(`Shopify errors:\n${shopifyErrors.join('\n')}`);
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
