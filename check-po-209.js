const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPO() {
  try {
    const po = await prisma.purchase_order.findUnique({
      where: { id: 'dca54bd4-8aec-4115-98ab-17b5f84b7410' },
      include: {
        lines: {
          orderBy: { line_number: 'asc' }
        },
        payments: true,
        chinese_po_files: true
      }
    });
    
    if (!po) {
      console.log('PO not found');
    } else {
      console.log('PO Number:', po.po_number);
      console.log('Status:', po.status);
      console.log('Lines count:', po.lines?.length || 0);
      console.log('Payments count:', po.payments?.length || 0);
      console.log('Chinese PO files:', po.chinese_po_files?.length || 0);
      console.log('\nLines:');
      po.lines?.forEach((line, i) => {
        console.log(`  ${i + 1}. Line ${line.line_number}: ${line.description?.substring(0, 50) || 'N/A'}`);
      });
      
      if (po.chinese_po_files && po.chinese_po_files.length > 0) {
        console.log('\nChinese PO Files:');
        po.chinese_po_files.forEach(file => {
          console.log(`  - ${file.file_name} (${file.file_path})`);
        });
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPO();
