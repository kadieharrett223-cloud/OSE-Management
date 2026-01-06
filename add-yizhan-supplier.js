#!/usr/bin/env node

/**
 * Add Hangzhou Yizhan supplier
 * Run with: node add-yizhan-supplier.js
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Missing Supabase credentials in environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supplier = {
  name: 'HANGZHOU YIZHAN TECHNOLOGY CO.,LTD.',
  address: 'Fuyang District',
  city_state_zip: 'Hangzhou City, Zhejiang Province',
  contact_name: 'Sara',
  terms: '30% Advance',
  payment_method: 'Wire Transfer',
  ship_to_name: 'Port of Seattle',
  ship_to_city_state_zip: 'Port of Seattle, Washington'
};

async function addSupplier() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/suppliers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify(supplier)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to add supplier: ${response.status} ${error}`);
    }

    const result = await response.json();
    console.log('✅ Supplier added successfully:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error adding supplier:', error.message);
    process.exit(1);
  }
}

addSupplier();
