#!/usr/bin/env node

/**
 * Insert Hangzhou Yizhan supplier directly into Supabase
 * Usage: node insert-yizhan.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let value = match[2];
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    envVars[match[1]] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? `✓ ${supabaseUrl.substring(0, 30)}...` : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', envVars.SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
    console.log('🔍 Checking if supplier already exists...');
    
    // Check if supplier exists
    const { data: existing, error: checkError } = await supabase
      .from('suppliers')
      .select('id, name')
      .ilike('name', supplier.name);
    
    if (checkError) {
      console.error('❌ Error checking existing supplier:', checkError.message);
      process.exit(1);
    }
    
    if (existing && existing.length > 0) {
      console.log('⚠️  Supplier already exists:');
      console.log('   ID:', existing[0].id);
      console.log('   Name:', existing[0].name);
      process.exit(0);
    }
    
    console.log('✅ Supplier does not exist, creating...\n');
    
    const { data, error } = await supabase
      .from('suppliers')
      .insert([supplier])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating supplier:', error.message);
      console.error('   Details:', error.details);
      process.exit(1);
    }
    
    console.log('✅ Supplier created successfully!\n');
    console.log('ID:', data.id);
    console.log('Name:', data.name);
    console.log('Address:', data.address);
    console.log('City/State/ZIP:', data.city_state_zip);
    console.log('Contact:', data.contact_name);
    console.log('Terms:', data.terms);
    console.log('Payment:', data.payment_method);
    console.log('Ship To:', data.ship_to_name);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

addSupplier();
