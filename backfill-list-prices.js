// Script to recalculate and update all derived fields in price_list_items
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env.local manually
const envPath = '.env.local';
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
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

// Same formula as in the frontend computeDerivedFields
function calculateDerivedFields(item) {
  const fob_cost = item.fob_cost || 0;
  const quantity = item.quantity || 0;
  const ocean_per_unit = quantity > 0 ? 3000 / quantity : (item.ocean_frt || 0);
  const importing_per_unit = quantity > 0 ? 2100 / quantity : (item.importing || 0);
  const zone5_shipping = item.zone5_shipping || 0;
  const multiplier = item.multiplier || 1;

  // 1) Tariff: FOB × 2
  const tariff_105 = fob_cost * 2;

  // 2) Per unit: Tariff + Ocean per-unit + Importing per-unit
  const per_unit = tariff_105 + ocean_per_unit + importing_per_unit;

  // 3) Final cost with shipping: Per unit + Zone 5
  const cost_with_shipping = per_unit + zone5_shipping;

  // 4) Base sell price: (Cost × Multiplier) + Shipping
  const base_sell_price = (per_unit * multiplier) + zone5_shipping;

  // 5) List price: Always calculated as 20% above base sell price
  const list_price = base_sell_price * 1.2;

  // 6) Sell price at default 20% discount
  const sell_price = list_price * 0.8;

  // 7) Profit: Discounted sell price - Final cost with shipping
  const profit = sell_price - cost_with_shipping;

  // Legacy fields
  const rounded_normal_price = list_price * 0.8;
  const black_friday_price = list_price * 0.75;
  const rounded_sale_price = Math.floor(sell_price / 100) * 100 - 1;

  return {
    tariff_105,
    ocean_frt: ocean_per_unit,
    importing: importing_per_unit,
    per_unit,
    cost_with_shipping,
    sell_price,
    list_price,
    profit,
    rounded_normal_price,
    black_friday_price,
    rounded_sale_price,
  };
}

async function backfillPrices() {
  console.log('Fetching all price list items...');
  
  const { data: items, error } = await supabase
    .from('price_list_items')
    .select('*')
    .order('item_no');

  if (error) {
    console.error('Error fetching items:', error);
    process.exit(1);
  }

  console.log(`Found ${items.length} items to update`);

  let updated = 0;
  let failed = 0;

  for (const item of items) {
    const derived = calculateDerivedFields(item);
    
    const { error: updateError } = await supabase
      .from('price_list_items')
      .update(derived)
      .eq('id', item.id);

    if (updateError) {
      console.error(`Failed to update ${item.item_no}:`, updateError.message);
      failed++;
    } else {
      updated++;
      console.log(`✓ Updated ${item.item_no}: list_price ${item.list_price?.toFixed(2)} → ${derived.list_price.toFixed(2)}`);
    }
  }

  console.log(`\nComplete: ${updated} updated, ${failed} failed`);
}

backfillPrices();
