import * as XLSX from 'xlsx';
import { getServerSupabaseClient } from '@/lib/supabase';

/**
 * Price List Excel Importer
 * 
 * Parses "OLYMPIC EQUIPMENT REVISED PRICELIST (4-25)" Excel format:
 * - Handles section headers (categories)
 * - Extracts input fields (item_no, fob_cost, ocean_frt, etc.)
 * - Auto-computes derived fields via database trigger
 * - Supports versioning with version_tag
 */

type PriceListRow = {
  // Core
  item_no: string;
  description?: string;
  supplier?: string;
  version_tag: string;
  category_id?: string;
  
  // Inputs
  fob_cost?: number;
  quantity?: number;
  ocean_frt?: number;
  importing?: number;
  zone5_shipping?: number; // Shipping included per unit
  multiplier?: number;
};

export async function importPriceListFromExcel(
  file: File,
  versionTag: string = '2025-04-25'
): Promise<{ success: boolean; imported: number; errors: string[] }> {
  const supabase = getServerSupabaseClient();
  const errors: string[] = [];
  let imported = 0;

  try {
    // Read Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });

    // Fetch categories
    const { data: categories } = await supabase
      .from('price_list_categories')
      .select('*');
    
    const categoryMap = new Map(categories?.map(c => [c.category_name.toLowerCase(), c.id]) || []);

    let currentCategoryId: string | undefined = undefined;
    const itemsToImport: PriceListRow[] = [];

    for (const row of json) {
      // Detect section header (category)
      const firstCol = Object.values(row)[0];
      if (typeof firstCol === 'string' && isSectionHeader(firstCol, categoryMap)) {
        const categoryName = firstCol.trim();
        currentCategoryId = categoryMap.get(categoryName.toLowerCase());
        continue;
      }

      // Parse item row
      const itemNo = normalizeString(row['Item No'] || row['item_no'] || row['SKU']);
      if (!itemNo) continue; // Skip empty rows

      const item: PriceListRow = {
        item_no: itemNo,
        description: normalizeString(row['Description'] || row['description']),
        supplier: normalizeString(row['Supplier'] || row['supplier']),
        version_tag: versionTag,
        category_id: currentCategoryId,
        
        // Input fields
        fob_cost: parseNumber(row['FOB Cost'] || row['fob_cost']),
        quantity: parseNumber(row['Quantity'] || row['quantity']),
        ocean_frt: parseNumber(row['Ocean frt'] || row['ocean_frt']),
        importing: parseNumber(row['importing'] || row['Importing']),
        zone5_shipping: parseNumber(row['Zone 5'] || row['zone5_shipping'] || row['zone5']),
        multiplier: parseNumber(row['Multiplier'] || row['multiplier']),
      };

      itemsToImport.push(item);
    }

    // Batch insert with upsert (update existing items with same item_no + version_tag)
    const { error } = await supabase
      .from('price_list_items')
      .upsert(itemsToImport, { onConflict: 'item_no,version_tag' });

    if (error) throw error;

    imported = itemsToImport.length;

    return { success: true, imported, errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
    return { success: false, imported, errors };
  }
}

function isSectionHeader(value: string, categoryMap: Map<string, string>): boolean {
  const normalized = value.trim().toLowerCase();
  return categoryMap.has(normalized);
}

function normalizeString(value: any): string | undefined {
  if (value == null || value === '') return undefined;
  return String(value).trim();
}

function parseNumber(value: any): number | undefined {
  if (value == null || value === '') return undefined;
  const num = Number(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Helper to generate SQL INSERT statements from Excel
 * (For manual import via SQL Editor)
 */
export async function generateInsertSQL(file: File, versionTag: string = '2025-04-25'): Promise<string> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });

  const lines: string[] = [];
  lines.push(`-- Price List Import for version: ${versionTag}`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('');

  let currentCategoryId = 'NULL';
  
  for (const row of json) {
    const firstCol = Object.values(row)[0];
    
    // Detect category
    if (typeof firstCol === 'string' && firstCol.match(/^[A-Z\s\-]+$/)) {
      lines.push(`-- Category: ${firstCol}`);
      currentCategoryId = `(SELECT id FROM price_list_categories WHERE category_name = '${firstCol.replace(/'/g, "''")}')`;
      continue;
    }

    const itemNo = normalizeString(row['Item No'] || row['item_no']);
    if (!itemNo) continue;

    const values = [
      `'${versionTag}'`,
      currentCategoryId,
      `'${itemNo.replace(/'/g, "''")}'`,
      sqlValue(normalizeString(row['Description'])),
      sqlValue(normalizeString(row['Supplier'])),
      sqlValue(parseNumber(row['FOB Cost'])),
      sqlValue(parseNumber(row['Quantity'])),
      sqlValue(parseNumber(row['Ocean frt'])),
      sqlValue(parseNumber(row['importing'])),
      sqlValue(parseNumber(row['Zone 5'])),
      sqlValue(parseNumber(row['Multiplier'])),
    ];

    lines.push(
      `INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier)` +
      `\nVALUES (${values.join(', ')})` +
      `\nON CONFLICT (item_no, version_tag) DO UPDATE SET` +
      `\n  description = EXCLUDED.description, supplier = EXCLUDED.supplier, fob_cost = EXCLUDED.fob_cost,` +
      `\n  quantity = EXCLUDED.quantity, ocean_frt = EXCLUDED.ocean_frt, importing = EXCLUDED.importing,` +
      `\n  zone5_shipping = EXCLUDED.zone5_shipping, multiplier = EXCLUDED.multiplier;`
    );
    lines.push('');
  }

  return lines.join('\n');
}

function sqlValue(val: any): string {
  if (val == null || val === undefined) return 'NULL';
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
  return String(val);
}
