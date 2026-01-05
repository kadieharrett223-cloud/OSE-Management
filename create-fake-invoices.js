const fs = require('fs');

// Manual .env.local loading
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

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createFakeInvoices() {
  try {
    // Get first wholesaler
    const { data: wholesalers, error: whError } = await supabase
      .from('wholesalers')
      .select('id')
      .limit(1);
    
    if (whError || !wholesalers || wholesalers.length === 0) {
      console.error('❌ No wholesalers found. Create a wholesaler first!');
      return;
    }

    const wholesalerId = wholesalers[0].id;
    console.log(`✓ Using wholesaler ID: ${wholesalerId}`);

    // Get or create a fake rep
    let { data: reps, error: repError } = await supabase
      .from('reps')
      .select('id')
      .limit(1);
    
    let repId;
    if (repError || !reps || reps.length === 0) {
      console.log('Creating fake rep...');
      const { data: newRep, error: createRepError } = await supabase
        .from('reps')
        .insert([{
          name: 'Demo Sales Rep',
          qbo_code: 'DEMO',
          email: 'demo@example.com',
          commission_rate: 0.05
        }])
        .select()
        .single();
      
      if (createRepError) {
        console.error('❌ Error creating rep:', createRepError);
        return;
      }
      repId = newRep.id;
    } else {
      repId = reps[0].id;
    }

    console.log(`✓ Using rep ID: ${repId}`);

    // Create fake invoices (mix of this month and previous months)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const fakeInvoices = [
      // This month invoices (for "Next Check" calculation)
      {
        qbo_invoice_id: 'FAKE-INV-001',
        invoice_number: 'INV-2601',
        rep_id: repId,
        wholesaler_id: wholesalerId,
        txn_date: new Date(currentYear, currentMonth, 5).toISOString().split('T')[0],
        total_amount: 5430.00,
        commission_total: 271.50,
        payment_status: 'paid'
      },
      {
        qbo_invoice_id: 'FAKE-INV-002',
        invoice_number: 'INV-2602',
        rep_id: repId,
        wholesaler_id: wholesalerId,
        txn_date: new Date(currentYear, currentMonth, 12).toISOString().split('T')[0],
        total_amount: 8920.00,
        commission_total: 446.00,
        payment_status: 'paid'
      },
      {
        qbo_invoice_id: 'FAKE-INV-003',
        invoice_number: 'INV-2603',
        rep_id: repId,
        wholesaler_id: wholesalerId,
        txn_date: new Date(currentYear, currentMonth, 18).toISOString().split('T')[0],
        total_amount: 3245.00,
        commission_total: 162.25,
        payment_status: 'paid'
      },
      // Last month invoices
      {
        qbo_invoice_id: 'FAKE-INV-004',
        invoice_number: 'INV-2512',
        rep_id: repId,
        wholesaler_id: wholesalerId,
        txn_date: new Date(currentYear, currentMonth - 1, 8).toISOString().split('T')[0],
        total_amount: 12340.00,
        commission_total: 617.00,
        payment_status: 'paid'
      },
      {
        qbo_invoice_id: 'FAKE-INV-005',
        invoice_number: 'INV-2515',
        rep_id: repId,
        wholesaler_id: wholesalerId,
        txn_date: new Date(currentYear, currentMonth - 1, 22).toISOString().split('T')[0],
        total_amount: 7650.00,
        commission_total: 382.50,
        payment_status: 'paid'
      },
      // Two months ago
      {
        qbo_invoice_id: 'FAKE-INV-006',
        invoice_number: 'INV-2411',
        rep_id: repId,
        wholesaler_id: wholesalerId,
        txn_date: new Date(currentYear, currentMonth - 2, 15).toISOString().split('T')[0],
        total_amount: 4580.00,
        commission_total: 229.00,
        payment_status: 'paid'
      }
    ];

    console.log(`\nCreating ${fakeInvoices.length} fake invoices...`);
    
    const { data, error } = await supabase
      .from('invoices')
      .insert(fakeInvoices)
      .select();

    if (error) {
      console.error('❌ Error creating invoices:', error);
      return;
    }

    console.log(`\n✅ Created ${data.length} fake invoices successfully!`);
    console.log('\nThis month invoices (for Next Check):');
    data.slice(0, 3).forEach(inv => {
      console.log(`  - ${inv.invoice_number}: $${inv.total_amount.toFixed(2)} (commission: $${inv.commission_total.toFixed(2)})`);
    });
    
    const thisMonthTotal = fakeInvoices.slice(0, 3).reduce((sum, inv) => sum + inv.total_amount, 0);
    const thisMonthCommission = fakeInvoices.slice(0, 3).reduce((sum, inv) => sum + inv.commission_total, 0);
    console.log(`\nNext Check Total: $${thisMonthCommission.toFixed(2)} (5% of $${thisMonthTotal.toFixed(2)})`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createFakeInvoices();
