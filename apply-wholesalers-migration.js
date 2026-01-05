// Apply wholesalers migration
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env.local
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

async function applyMigration() {
  console.log('Applying wholesalers migration...');
  
  try {
    // Drop existing table if it exists
    console.log('Dropping old wholesalers table if exists...');
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'DROP TABLE IF EXISTS wholesalers CASCADE;'
    });
    
    // Read and apply the migration
    const migration = fs.readFileSync('supabase/migrations/011_wholesalers.sql', 'utf8');
    
    // Execute the full migration
    console.log('Creating new wholesalers table...');
    
    // Split and execute each statement
    const statements = migration
      .replace(/--[^\n]*/g, '') // Remove comments
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const stmt of statements) {
      console.log(`Executing: ${stmt.substring(0, 50)}...`);
      
      // Use raw SQL query
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      if (error && !error.message.includes('already exists')) {
        console.error('Error:', error);
      }
    }
    
    console.log('✅ Migration applied successfully!');
    console.log('You can now use the wholesalers page.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\nPlease apply the migration manually:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy the contents of supabase/migrations/011_wholesalers.sql');
    console.log('4. Paste and run it');
  }
}

applyMigration().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
