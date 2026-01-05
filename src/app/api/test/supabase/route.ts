import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/test/supabase
 * 
 * Test endpoint to verify Supabase connection
 */
export async function GET() {
  try {
    // Test connection by querying a system table
    const { data, error } = await supabase
      .from('reps')
      .select('count')
      .limit(1);

    if (error) {
      return NextResponse.json({
        connected: false,
        error: error.message,
        hint: 'Make sure you have run the migration in Supabase SQL Editor'
      }, { status: 500 });
    }

    return NextResponse.json({
      connected: true,
      message: 'Supabase connection successful',
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
