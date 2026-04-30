const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

if (fs.existsSync('.env.local')) {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length) process.env[key.trim()] = valueParts.join('=').trim();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const skuList = [
  '2PCFHD-15',
  '2PCFHD-12',
  '2PBP-12',
  '2PDDA-10',
  '2PCFXL-10',
  '2PBPXW-10',
  '2PBP-10',
  '2PCF-9',
  '2PBP-8',
  'HDMBL-10',
  '4PHDXLA-11',
  '4PHDXL-12',
  '4PXW-10',
  '4PXL-10',
  '4PHR-9X',
  'HDMBL-9',
  '4PML-9',
];

function normalizeMargin(value) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 0.95) return 0.95;
  return Number(value.toFixed(6));
}

async function run() {
  const { data: settingRow } = await supabase
    .from('pricing_settings')
    .select('global_tariff_percent')
    .eq('id', '00000000-0000-0000-0000-000000000002')
    .maybeSingle();

  const tariffPercent = Number(settingRow?.global_tariff_percent ?? 80);
  const tariffMultiplier = 1 + tariffPercent / 100;

  const { data: rows, error } = await supabase
    .from('price_list_items')
    .select('id,item_no,supplier,tariff_exempt,fob_cost,quantity,ocean_frt,importing,zone5_shipping,sell_price,manual_pricing_override')
    .in('item_no', skuList)
    .eq('is_active', true);

  if (error) throw error;

  let updated = 0;

  for (const row of rows || []) {
    const fob = Number(row.fob_cost || 0);
    const qty = Number(row.quantity || 0);
    const shipping = Number(row.zone5_shipping || 0);
    const sell = Number(row.sell_price || 0);

    const supplier = String(row.supplier || '').toUpperCase();
    const isKatool = supplier.includes('KATOOL') || supplier.includes('KATA');
    const exempt = Boolean(row.tariff_exempt) || isKatool;

    let costNoShipping;
    if (exempt) {
      costNoShipping = fob;
    } else {
      const tariff = fob * tariffMultiplier;
      const ocean = qty > 0 ? 3000 / qty : Number(row.ocean_frt || 0);
      const importing = qty > 0 ? 2100 / qty : Number(row.importing || 0);
      costNoShipping = tariff + ocean + importing;
    }

    const finalCost = costNoShipping + shipping;
    const margin = sell > 0 ? normalizeMargin(1 - finalCost / sell) : 0;

    const { error: updateError } = await supabase
      .from('price_list_items')
      .update({
        manual_pricing_override: false,
        margin,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    if (updateError) {
      console.error(`Failed ${row.item_no}: ${updateError.message}`);
      continue;
    }

    updated += 1;
    console.log(`✓ ${row.item_no} manual override cleared, margin set to ${margin}`);
  }

  console.log(`\nDone. Updated rows: ${updated}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
