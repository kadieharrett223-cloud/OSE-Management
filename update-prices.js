// Script to update list prices in Supabase
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

const updates = [
  // 2 Post Lifts
  { item_no: '2PBP-8', list_price: 3474.90 },
  { item_no: '2PCF-9', list_price: 3555.07 },
  { item_no: '2PBP-10', list_price: 3254.26 },
  { item_no: '2PRXVW-10', list_price: 4314.13 },
  { item_no: '2PCFXL-10', list_price: 5394.14 },
  { item_no: '2PRXVL-10', list_price: 5754.80 },
  { item_no: '2PBP-12', list_price: 5294.27 },
  { item_no: '2PCFHD-12', list_price: 6834.45 },
  { item_no: '2PCFHD-15', list_price: 8593.46 },
  
  // 4 Post Lifts Accessories
  { item_no: '4PTA-3', list_price: 145.32 },
  { item_no: '4PTA-4', list_price: 290.24 },
  { item_no: '4PTA-4.5', list_price: 248.78 },
  { item_no: '8PTA', list_price: 441.44 },
  { item_no: '2PFC', list_price: 427.70 },
  
  // 4 POST LIFTS
  { item_no: '4PML-9', list_price: 4670.55 },
  { item_no: 'HDML-9', list_price: 6072.22 },
  { item_no: '4PHR-9x', list_price: 5994.37 },
  { item_no: 'HDML-10', list_price: 7914.18 },
  { item_no: '4PXL-10', list_price: 7194.19 },
  { item_no: '4PXV-10', list_price: 10673.86 },
  { item_no: '4PHDXLA-11', list_price: 15593.77 },
  { item_no: '4PHDXL-10', list_price: 17794.92 },
  { item_no: '4PHDXLA-14', list_price: 11154.66 },
  { item_no: '4PHDXLA-15', list_price: 17394.48 },
  { item_no: '4O12XL', list_price: 20017.80 },
  { item_no: '4PHDXL-22', list_price: 29631.84 },
  { item_no: '4PHDXLA-22', list_price: 33243.34 },
  { item_no: '4PHDXL-27', list_price: 32613.04 },
  { item_no: '4PHDXLA-27', list_price: 36053.67 },
  { item_no: '4PHDL-33', list_price: 38696.74 },
  { item_no: '4PHDXLA-33', list_price: 41708.67 },
  { item_no: '4PHDL-13', list_price: 0.00 },
  { item_no: 'HLCL-6', list_price: 1620.12 },
  { item_no: 'FRC-4', list_price: 1618.91 },
  { item_no: 'HLCL-14', list_price: 2059.40 },
  { item_no: 'HR-10', list_price: 420.00 },
  { item_no: '4PRI-9', list_price: 2994.35 },
  { item_no: 'HDML-8LI', list_price: 5633.73 },
  { item_no: '4PTT', list_price: 179.05 },
  { item_no: '4PRT', list_price: 474.21 },
  { item_no: 'FBAR-2', list_price: 839.27 },
  { item_no: 'Y2CL-10BLT', list_price: 551.02 },
  { item_no: 'ALT-11-15', list_price: 1618.91 },
  { item_no: 'S3ALT-11-15', list_price: 1618.91 },
  { item_no: '4PDT', list_price: 1618.91 },
  { item_no: 'ML-8X10EFM', list_price: 360.45 },
  { item_no: 'FR-3PLFM', list_price: 360.45 },
  { item_no: 'HR-10PLFM', list_price: 360.45 },
  { item_no: 'XW-10PLFM', list_price: 360.45 },
  { item_no: '4PD 27-15', list_price: 480.85 },
  
  // SCISSOR LIFTS
  { item_no: 'MRS1-70', list_price: 3235.44 },
  { item_no: 'MRSL-75', list_price: 4428.03 },
  { item_no: 'FRS5-75', list_price: 5994.14 },
  
  // Tire Machines
  { item_no: 'T999-E', list_price: 6714.44 },
  { item_no: 'T600', list_price: 4434.13 },
  { item_no: 'T620', list_price: 2393.53 },
  
  // Wheel Balancers
  { item_no: 'WB60', list_price: 3679.65 },
  { item_no: 'WB10', list_price: 2133.65 },
  { item_no: 'WB20', list_price: 3395.42 },
  
  // Alignment Machines
  { item_no: 'AS800', list_price: 16781.37 },
  { item_no: 'AS600', list_price: 14334.46 },
  { item_no: 'ACB-1', list_price: 2939.62 },
  
  // SHOP EQUIPMENT
  { item_no: 'R-45', list_price: 2458.52 },
  { item_no: 'R-30', list_price: 2154.82 },
  { item_no: 'RT-1', list_price: 478.80 },
  
  // MOTORCYCLE LIFTS
  { item_no: 'HDML-8', list_price: 2273.14 },
  
  // BUNDLES
  { item_no: 'BNDL-POF11', list_price: 55184.40 },
  
  // ACCESSORIES
  { item_no: 'APU-1', list_price: 563.00 },
  { item_no: 'UHS-5075', list_price: 178.90 },
  { item_no: 'UHS-750', list_price: 203.02 },
  { item_no: 'OD-430', list_price: 147.74 },
  { item_no: 'OD-7170', list_price: 275.00 },
  { item_no: 'OD-3338AE', list_price: 0.00 },
  { item_no: 'OD-3198', list_price: 234.91 },
  { item_no: 'FH-11027 71-707', list_price: 506.46 },
  { item_no: 'TI-1101A / TI2718', list_price: 328.77 },
  { item_no: 'AI-1201', list_price: 51.39 },
  { item_no: 'AU-22X4', list_price: 538.33 },
  { item_no: 'HPI-220', list_price: 478.98 },
  { item_no: 'APU-3', list_price: 435.05 },
];

async function updatePrices() {
  console.log(`Updating ${updates.length} items...`);
  
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  
  for (const update of updates) {
    const { data, error } = await supabase
      .from('price_list_items')
      .update({ list_price: update.list_price })
      .eq('item_no', update.item_no);
    
    if (error) {
      errorCount++;
      errors.push({ item: update.item_no, error: error.message });
      console.error(`❌ ${update.item_no}: ${error.message}`);
    } else {
      successCount++;
      console.log(`✓ ${update.item_no}: $${update.list_price}`);
    }
  }
  
  console.log(`\n✅ Updated ${successCount} items successfully`);
  if (errorCount > 0) {
    console.log(`❌ ${errorCount} items failed`);
    console.log('Errors:', errors);
  }
}

updatePrices().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
