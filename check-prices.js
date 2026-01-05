// Verify list prices in database
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

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPrices() {
  const { data, error } = await supabase
    .from('price_list_items')
    .select('item_no, list_price')
    .order('item_no')
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('First 10 items in database:');
  data.forEach(item => {
    console.log(`${item.item_no}: $${item.list_price}`);
  });
}

checkPrices().then(() => process.exit(0));
