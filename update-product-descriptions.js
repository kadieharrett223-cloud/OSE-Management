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
  {
    item_no: '2PBP-8',
    description: 'Silver Series 2-post base plate lift, 8,000 lb capacity, open carriage dual-point lock release, secondary lock, 110" posts, 2-stage arms, 2-stage adjustable foot pads, 3.5" truck adapter set, with all pulleys, cables, and hoses factory installed. Includes 110V 60Hz 2.2kW power unit packaged inside the bundle in an accessible area.'
  },
  {
    item_no: '2PCF-9',
    description: 'Silver Series 2-post clear floor lift, 9,000 lb capacity, 142" H x 129" W posts, 2-stage arms, 2-stage foot pads, dual lock release, open carriage, secondary lock, and 3.5" truck adapter set. All pulleys, cables, and hoses are factory installed. Includes 110V 60Hz 3kW power unit packaged inside the bundle in an accessible area.'
  },
  {
    item_no: '2PBP-10',
    description: 'Silver Series 2-post base plate lift, 10,000 lb capacity, open carriage dual-point lock release, secondary lock, 110" posts, 2-stage arms, 2-stage adjustable foot pads, and 3.5" truck adapter set. All pulleys, cables, and hoses are factory installed. Includes 220V 60Hz 3hp power unit packaged inside the bundle in an accessible area.'
  },
  {
    item_no: '2PBPXW-10',
    description: 'Gold Series 2-post base plate lift, 10,000 lb capacity, open carriage design with single lock release and secondary lock, 110" H x 137" W overall dimensions, 3-stage arms, 3-stage adjustable foot pads, and 3.5" truck adapter set. All pulleys, cables, and hoses are factory installed. Includes 220V 60Hz 3hp power unit packaged inside the bundle in an accessible area.'
  },
  {
    item_no: '2PCFXL-10',
    description: 'Gold Series 2-post clear floor lift, 10,000 lb capacity, 153" H x 135" W, chain-drive system, open carriage, single lock release, secondary lock, 3-stage arms, 3-stage foot pads, and 3.5" truck adapter set. All pulleys, cables, and hoses are factory installed. Includes 220V 60Hz 3hp power unit packaged inside the bundle in an accessible area.'
  },
  {
    item_no: '2PDDA-10',
    description: 'Gold Series 2-post clear floor symmetric/asymmetric lift, 10,000 lb capacity, 153" H x 145" W, direct-drive open carriage design with single lock release and secondary lock. Features 3-stage arms, 3-stage foot pads, and 3.5" truck adapter set. All pulleys, cables, and hoses are factory installed. Includes 220V 60Hz 3hp power unit packaged inside the bundle in an accessible area.'
  },
  {
    item_no: '2PBP-12',
    description: 'Gold Series 2-post base plate lift, 12,000 lb capacity, 115" H x 153" W, open carriage design with single lock release and secondary lock. Includes 3-stage arms, 3-stage adjustable foot pads, and 3.5" truck adapter set. All pulleys, cables, and hoses are factory installed. Includes 220V 60Hz 3hp power unit packaged inside the bundle in an accessible area.'
  },
  {
    item_no: '2PCFHD-12',
    description: 'Gold Series 2-post clear floor car lift, 12,000 lb capacity, 174" x 156", open carriage design with single lock release and secondary lock. Features 3-stage arms, 3-stage foot pads, and 3.5" truck adapter set. All pulleys, cables, and hoses are factory installed. Includes 220V 60Hz 3hp power unit packaged inside the bundle in an accessible area.'
  },
  {
    item_no: '2PCFHD-15',
    description: 'Gold Series 2-post clear floor maintenance lift, 15,000 lb capacity, 190" W overall height, 168.5" overall width, chain-drive system, open carriage, 3-stage arms, 3-stage adjustable foot pads, and 3.5" truck adapter set. All pulleys, cables, and hoses are factory installed. Includes 220V 60Hz 3hp power unit packaged inside the bundle in an accessible area.'
  },
  {
    item_no: '4PC-6',
    description: '"The Little Buddy" compact 4-post car storage lift with 6,000 lb capacity, measuring 96.57" W x 173.4" L with 145" runway length and 60" storage clearance. Includes 3 drip trays, drive-through design, and factory-installed pulleys, cables, and hoses. Equipped with a 110V 2.2kW power unit packaged inside the bundle in an accessible area. Tool tray, jack tray, caster arms, rolling jack, and additional accessories are sold and packaged separately.'
  },
  {
    item_no: '4PML-9',
    description: 'Gold Series 4-post car storage lift, 9,000 lb capacity, 108" W x 198" L. Includes tool tray, 3 drip trays, caster arms, drive-through design, and factory-installed pulleys, cables, and hoses. Features a 110V 60Hz 2.2kW power unit packaged inside the bundle in an accessible area. Tool tray packaged separately.'
  },
  {
    item_no: '4PHR-9X',
    description: 'Model 4PHR-9X four-post lift with 9,000 lb lifting capacity, 181" runways, 98.7" clearance between posts, 78.74" vertical clearance, and 85.43" drive-through width. Includes 3 drip trays, caster arms, tool tray, plug-in tire stops, and factory-installed pulleys, cables, and hoses. Powered by a 110V 60Hz 2.2kW power unit packaged inside the bundle in an accessible area. Tool tray packaged separately.'
  },
  {
    item_no: 'HDMBL-9',
    description: 'Gold Series 4-post car storage lift, 9,000 lb capacity, 136.9" W x 198.49" L with sliding hitch rest, adjustable-width runways, 3 drip trays, caster arms, and drive-through design. All pulleys, cables, and hoses are factory installed. Includes 110V 60Hz 2.2kW power unit packaged inside the bundle in an accessible area. Tool tray packaged separately.'
  },
  {
    item_no: '4PHDXL-12',
    description: 'Gold Series 4-post maintenance lift, 12,000 lb capacity, overall height 87.40", width 132.40", length 245.47", runway length 196.85", runway width 21.6", and 114.37" between posts. Features manual lock system, tool tray, 3 drip trays, and factory-installed pulleys, cables, and hoses. Includes 220V 60Hz 2.2kW power unit packaged inside the bundle in an accessible area. Tool tray packaged separately.'
  },
  {
    item_no: '4PXL-10',
    description: 'Dually Gold Series 4-post high-rise storage lift, portable design, 10,000 lb capacity, minimum 84" storage height on top lock, 112" drive-through width, and 195" runways. Includes tool tray, 3 drip trays, caster arms, and factory-installed pulleys, cables, and hoses. Features 110V 60Hz 2.2kW power unit packaged inside the bundle in an accessible area. Tool tray packaged separately.'
  },
  {
    item_no: '4PXW-10',
    description: 'Gold Series 4-post high-rise 2-car storage lift, portable design, 10,000 lb capacity, 82" lifting height, 78" clearance resting on top lock, and overall dimensions of 208" W x 224" L. Includes tool tray, 6 drip trays, caster arms, and factory-installed pulleys, cables, and hoses. Equipped with 110V 60Hz 2.2kW power unit packaged inside the bundle in an accessible area. Tool tray packaged separately.'
  },
  {
    item_no: '4PHDXLA-14',
    description: 'Gold Series 4-post alignment lift, 14,000 lb capacity, overall height 87.40", width 99.60", length 246.06", 116.65" between posts, 99.60" drive-through width, 21.65" runway width, and 196.85" runway length. Includes air lock release, slip plates, turntables, tool tray, and two air/hydraulic bridge jacks packaged separately. All pulleys, cables, and hoses are factory installed. Includes 220V 60Hz 3kW power unit packaged inside the bundle in an accessible area.'
  },
  {
    item_no: '4PHDXLA-11',
    description: 'Gold Series 4-post open-front alignment lift, 11,000 lb capacity, overall height 87.40", width 137.8", length 246.06", 99.60" drive-through width, 70.86" lifting height, 196.85" runway length, and 21.65" runway width. Features air lock release, slip plates, turntables, and two air/hydraulic bridge jacks packaged separately. All pulleys, cables, and hoses are factory installed. Includes 220V 60Hz 2.2kW power unit and accessories packaged inside the bundle in an accessible area.'
  },
  {
    item_no: '4PHDXLA-15',
    description: 'Gold Series 4-post open-front alignment lift, 15,000 lb capacity, overall height 87.40", width 137.8", length 246.06", 99.60" drive-through width, 70.86" lifting height, 196.85" runway length, and 21.65" runway width. Includes air lock release, slip plates, turntables, and two air/hydraulic bridge jacks packaged separately. All pulleys, cables, and hoses are factory installed. Includes 220V 60Hz 3kW power unit and accessories packaged inside the bundle in an accessible area.'
  },
  {
    item_no: '4032XL',
    description: 'Gold Series 3-car stacking lift with 16,000 lb total capacity, featuring 174" column height, 113.7" overall width, and 229.4" overall length. Lower platform capacity is 9,000 lb with 82" rise and 87.2" maximum lifting height. Upper platform capacity is 7,000 lb with 151.4" rise and 156.5" maximum lifting height. Includes concrete anchors, 8 drip trays, steel ramps, and factory-installed pulleys, cables, and hoses. Includes 220V 3kW 60Hz power unit packaged inside the bundle in an accessible area.'
  }
];

async function updateDescriptions() {
  console.log(`Updating descriptions for ${updates.length} products...`);

  let successCount = 0;
  const missing = [];
  const errors = [];

  for (const update of updates) {
    const { data: row, error: fetchError } = await supabase
      .from('price_list_items')
      .select('id, item_no')
      .eq('item_no', update.item_no)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError) {
      errors.push(`${update.item_no}: ${fetchError.message}`);
      console.error(`Error checking ${update.item_no}: ${fetchError.message}`);
      continue;
    }

    if (!row) {
      missing.push(update.item_no);
      console.warn(`Missing item_no: ${update.item_no}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('price_list_items')
      .update({ description: update.description })
      .eq('id', row.id);

    if (updateError) {
      errors.push(`${update.item_no}: ${updateError.message}`);
      console.error(`Failed ${update.item_no}: ${updateError.message}`);
      continue;
    }

    successCount += 1;
    console.log(`Updated ${update.item_no}`);
  }

  console.log('\nDone.');
  console.log(`Updated: ${successCount}`);
  if (missing.length) console.log(`Missing: ${missing.join(', ')}`);
  if (errors.length) console.log(`Errors:\n${errors.join('\n')}`);
}

updateDescriptions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
