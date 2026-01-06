"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_name: string;
  vendor_address?: string;
  vendor_city_state_zip?: string;
  vendor_contact_name?: string;
  vendor_email?: string;
  vendor_phone?: string;
  ship_to_name?: string;
  ship_to_address?: string;
  ship_to_city_state_zip?: string;
  representative?: string;
  authorized_by?: string;
  destination?: string;
  terms?: string;
  payment_method?: string;
  order_date: string;
  expected_delivery?: string;
  total_amount: number;
  status: string;
  notes?: string;
  lines: Array<{
    id: string;
    sku?: string;
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    weight_lbs?: number;
  }>;
}

export default function ViewPO() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetch(`/api/purchase-orders/${id}`)
        .then((res) => res.json())
        .then((result) => {
          if (result.ok) {
            setPO(result.data);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [id]);

  const money = (num: number) => num.toFixed(2);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-slate-600">Purchase order not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto p-8">
        {/* Print/Back Buttons */}
        <div className="flex justify-between mb-4 print:hidden">
          <button
            onClick={() => router.back()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Back
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Print
          </button>
        </div>

        {/* PO Document */}
        <div className="border border-gray-300 bg-white p-4">
          {/* Header Section */}
          <div className="grid grid-cols-2 gap-6 pb-3 mb-3 border-b border-gray-300">
            <div>
              <h1 className="text-lg font-semibold text-slate-700 mb-1.5 tracking-wide">OLYMPIC®</h1>
              <div className="text-[10px] text-slate-700 leading-tight space-y-0">
                <p className="font-semibold">Olympic Shop Equipment</p>
                <p>18935 59th Ave NE, Arlington WA. 98223</p>
                <p>Phone: 360-651-2540</p>
              </div>
            </div>
            <div className="flex flex-col items-end justify-start">
              <h2 className="text-3xl font-bold text-slate-900 mb-1.5 tracking-tight">PURCHASE ORDER</h2>
              <table className="border border-gray-400 text-[9px]">
                <tbody>
                  <tr>
                    <td className="border-r border-gray-400 px-2 py-1 bg-gray-50 font-bold uppercase text-[8px] tracking-wide">PO number</td>
                    <td className="border-r border-gray-400 px-2 py-1 bg-gray-50 font-bold uppercase text-[8px] tracking-wide">PO DATE</td>
                  </tr>
                  <tr>
                    <td className="border-r border-gray-400 px-2 py-1 font-semibold">{po.po_number}</td>
                    <td className="px-2 py-1 font-semibold">{po.order_date}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Vendor and Ship To Section */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="border border-gray-300">
              <div className="border-b border-gray-300 px-2 py-1 bg-gray-50">
                <h3 className="text-[9px] font-bold text-slate-900 uppercase tracking-wider">VENDOR</h3>
              </div>
              <div className="px-2 py-1.5 text-[9px] text-slate-800 space-y-1">
                <div>
                  <p className="text-[8px] font-semibold text-gray-600 uppercase tracking-wide mb-0">Name</p>
                  <p className="font-medium">{po.vendor_name}</p>
                </div>
                <div>
                  <p className="text-[8px] font-semibold text-gray-600 uppercase tracking-wide mb-0">Street Address</p>
                  <p>{po.vendor_address || "—"}</p>
                </div>
                <div>
                  <p className="text-[8px] font-semibold text-gray-600 uppercase tracking-wide mb-0">City / State / ZIP</p>
                  <p>{po.vendor_city_state_zip || "—"}</p>
                </div>
                <div>
                  <p className="text-[8px] font-semibold text-gray-600 uppercase tracking-wide mb-0">Phone</p>
                  <p>{po.vendor_phone || "—"}</p>
                </div>
                <div>
                  <p className="text-[8px] font-semibold text-gray-600 uppercase tracking-wide mb-0">Email</p>
                  <p>{po.vendor_email || "—"}</p>
                </div>
              </div>
            </div>
            <div className="border border-gray-300">
              <div className="border-b border-gray-300 px-2 py-1 bg-gray-50">
                <h3 className="text-[9px] font-bold text-slate-900 uppercase tracking-wider">SHIP TO</h3>
              </div>
              <div className="px-2 py-1.5 text-[9px] text-slate-800 space-y-1">
                <div>
                  <p className="text-[8px] font-semibold text-gray-600 uppercase tracking-wide mb-0">Name</p>
                  <p className="font-medium">{po.ship_to_name || "Top Secret Customs"}</p>
                </div>
                <div>
                  <p className="text-[8px] font-semibold text-gray-600 uppercase tracking-wide mb-0">Company</p>
                  <p>Olympic Shop Equipment</p>
                </div>
                <div>
                  <p className="text-[8px] font-semibold text-gray-600 uppercase tracking-wide mb-0">Street Address</p>
                  <p>{po.ship_to_address || "DBA Olympic Shop Equipment"}</p>
                </div>
                <div>
                  <p className="text-[8px] font-semibold text-gray-600 uppercase tracking-wide mb-0">City / State / ZIP</p>
                  <p>{po.ship_to_city_state_zip || "18935 59th Ave NE, Arlington WA. 98223"}</p>
                </div>
                <div>
                  <p className="text-[8px] font-semibold text-gray-600 uppercase tracking-wide mb-0">Phone</p>
                  <p>360-651-2540</p>
                </div>
              </div>
            </div>
          </div>

          {/* Deliver To Section */}
          <div className="border border-gray-300 mb-3 mt-3">
            <div className="border-b border-gray-300 px-2 py-1 bg-blue-50">
              <h3 className="text-[9px] font-bold text-slate-900 uppercase tracking-wider">DELIVER TO</h3>
            </div>
            <div className="px-2 py-1 text-[9px] text-slate-800">
              <p className="font-medium">{po.destination || "Same as Ship To"}</p>
            </div>
          </div>

          {/* Order Details Row */}
          <table className="w-full border border-gray-400 mb-3 text-[9px]">
            <tbody>
              <tr className="bg-gray-100">
                <td className="border-r border-gray-400 px-2 py-1.5 font-bold uppercase text-[8px] tracking-wide">PO Number</td>
                <td className="border-r border-gray-400 px-2 py-1.5 font-bold uppercase text-[8px] tracking-wide">Buyer</td>
                <td className="border-r border-gray-400 px-2 py-1.5 font-bold uppercase text-[8px] tracking-wide">Date</td>
                <td className="border-r border-gray-400 px-2 py-1.5 font-bold uppercase text-[8px] tracking-wide">Vendor No</td>
                <td className="border-r border-gray-400 px-2 py-1.5 font-bold uppercase text-[8px] tracking-wide">Terms</td>
                <td className="px-2 py-1.5 font-bold uppercase text-[8px] tracking-wide">Ship via</td>
              </tr>
              <tr>
                <td className="border-r border-gray-300 px-2 py-2">{po.po_number}</td>
                <td className="border-r border-gray-300 px-2 py-2">{po.authorized_by || "—"}</td>
                <td className="border-r border-gray-300 px-2 py-2">{po.order_date}</td>
                <td className="border-r border-gray-300 px-2 py-2">{po.vendor_contact_name || "—"}</td>
                <td className="border-r border-gray-300 px-2 py-2">{po.terms || "—"}</td>
                <td className="px-2 py-2">{po.payment_method || "—"}</td>
              </tr>
            </tbody>
          </table>

          {/* Line Items Table */}
          <div className="mb-2">
            <table className="w-full border-collapse border border-gray-400 text-[9px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border-r border-gray-400 px-2 py-1.5 text-center text-[8px] font-bold text-slate-900 uppercase tracking-wider w-8">
                    n#
                  </th>
                  <th className="border-r border-gray-400 px-2 py-1.5 text-left text-[8px] font-bold text-slate-900 uppercase tracking-wider">
                    Part number
                  </th>
                  <th className="border-r border-gray-400 px-2 py-1.5 text-left text-[8px] font-bold text-slate-900 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="border-r border-gray-400 px-2 py-1.5 text-center text-[8px] font-bold text-slate-900 uppercase tracking-wider w-12">
                    QTY
                  </th>
                  <th className="border-r border-gray-400 px-2 py-1.5 text-center text-[8px] font-bold text-slate-900 uppercase tracking-wider w-20">
                    Weight (lbs)
                  </th>
                  <th className="border-r border-gray-400 px-2 py-1.5 text-right text-[8px] font-bold text-slate-900 uppercase tracking-wider w-20">
                    Unit Price
                  </th>
                  <th className="px-2 py-1.5 text-right text-[8px] font-bold text-slate-900 uppercase tracking-wider w-24">Amount</th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((line, index) => (
                  <tr key={line.id} className={`border-b border-gray-300 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="border-r border-gray-300 px-2 py-1.5 text-center text-slate-700 align-top">
                      {index + 1}
                    </td>
                    <td className="border-r border-gray-300 px-2 py-1.5 text-slate-900 align-top font-medium">
                      {line.sku || "—"}
                    </td>
                    <td className="border-r border-gray-300 px-2 py-1.5 text-slate-800 align-top whitespace-pre-wrap leading-tight">
                      {line.description}
                    </td>
                    <td className="border-r border-gray-300 px-2 py-1.5 text-center text-slate-900 align-top font-medium">
                      {line.quantity}
                    </td>
                    <td className="border-r border-gray-300 px-2 py-1.5 text-center text-slate-900 align-top">
                      {line.weight_lbs ? line.weight_lbs.toFixed(0) : "—"}
                    </td>
                    <td className="border-r border-gray-300 px-2 py-1.5 text-right text-slate-900 align-top font-medium">
                      ${money(line.unit_price)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-slate-900 align-top font-semibold">
                      ${money(line.line_total)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-500">
                  <td colSpan={6} className="px-2 py-2 text-right text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Total Net (USD)
                  </td>
                  <td className="px-2 py-2 text-right text-sm font-bold text-slate-900">
                    ${money(po.total_amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="mt-3 pt-2 border-t border-gray-300 text-center">
            <p className="text-[9px] text-slate-600 mb-0.5">If you have any questions about this purchase order, please contact</p>
            <p className="text-[9px] text-slate-900 font-bold">Peter Harrett • 360-651-2540 • <span className="font-bold">peter@olympicequipment.com</span></p>
            <p className="text-[8px] text-slate-400 mt-1 italic">Thank you for your business</p>
            <p className="text-[8px] text-slate-400 mt-0.5">PO #{po.po_number}</p>
          </div>
        </div>

        {/* Page 2: Standard Terms and Specifications */}
        <div className="border border-slate-300 bg-white p-6 mt-8 page-break-before">
          <h2 className="text-base font-bold text-slate-900 mb-3">Page 2 - NOTES</h2>

          <div className="space-y-2 text-xs text-slate-800">
            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">Documents</h3>
              <p>All documents related to this order, including Alibaba submissions, must include Olympic order number.</p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">2-post Silver Series Lift Specifications:</h3>
              <p>Clear Floor: Open carriage, dual lock release, 2 stage arms, 2 stage foot, secondary lock, 3.5" truck adapters, *2 piece post, palletize power units seperately.</p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">2-post Gold Series Lift Specifications:</h3>
              <p>Clear Floor: Open carriage, single point lock release, 3 stage arms, 3 stage foot, secondary lock, 3.5" truck-adapters, palletize power units seperately.</p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">4 Post Portable Lift Specifications:</h3>
              <p>Steel ramps, 3 drip trays, caster arms, secondary lock, "J" rail platform to accomidate bridge jacks. palletize power units seperately, aluminum ramps and center platforms are optional.</p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">4 Post Alignment Lift Specifications:</h3>
              <p>Air lock release, secondary lock, "J" rail platform to accomidate bridge jacks.24v control box, include 1 bridge jack include slip plates and turn tables, pack power unit inside packlage.</p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">Factory Warranty:</h3>
              <p>1 year from date of US port arrival.</p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">Olympic identification:</h3>
              <p>Powder coat posts (RAL9005), All other components (RAL3020 (red).</p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">Olympic logos:</h3>
              <p>Apply white Olympic logos on front and back posts (one each).</p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">Olympic ID plate:</h3>
              <p>Apply to post directly above power unit. Include warning lables to opposite front post</p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">Packaging specifications:</h3>
              <p>Olympic packaging specifications apply (provided by Olympic).</p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">Parts:</h3>
              <p>Warranty parts and replacement parts will be provided at no cost to Olympic for 1 year from arrival date. Missing / unusable parts weighing less than 10 lbs per pc will be provided at no cost and shipped express. Missing / unusable parts weighing more than 10 lbs per pc will be provided at no cost shipped by container</p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">Operating Guides:</h3>
              <p>Include operating guide with every machine package.</p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">Shipping Instructions.</h3>
              <p>Olympic uses standard 40' double-door dry containers. Exceptions may occur. US over the road container cargo weight is 42-43,000 lb maximum.</p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">Shipping / Receiving / Logistics</h3>
              <p>Contact Paul Stark at 866-774-4531,or email info@olympic-equipment.com.</p>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">Freight Forwarding Contacts (OEC Freight Logistics)</h3>
              <ul className="list-none space-y-0 ml-2">
                <li>OEC Dalian: Hesty, TEL: 86-411-82828586, Email: all.dlc@oecgroup.com.cn</li>
                <li>OEC Shanghai: Chris Hu, TEL: 86-21-51188363, Email: nw.sha@oecgroup.com.cn</li>
                <li>OEC Qingdao: Tony, Email: all.qdo@oecgroup.com.cn</li>
                <li>OEC Ningbo: Vickie Tu, Email: Vickie.nbo@oecgroup.com</li>
                <li>OEC Tianjin: Fiona, Email: all.tjn@oecgroup.com</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-slate-900 mb-0.5">Contacts:</h3>
              <ul className="list-none space-y-0 ml-2">
                <li>Purchasing: Peter Harrett phone: 866-774-4531 ext 1. email peter@olympic-equipment.com.</li>
                <li>Purchasing: Kadie Harrett, phone 866-774-4531 ext 1. email kadie@olympic-equipment.com.</li>
                <li>Customer Service: Jared Henderson phone: 866-774-4531 ext 2. email customerservice@olympic-equipment.com.</li>
                <li>Bookeeping: Emma Nagel: phone 866-774-4531 ext 13. Email: bookkeeping@olympic-equipment.com</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>

      <style jsx global>{`
        @media print {
          @page {
            size: auto;
            margin: 0.5in;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif !important;
            color: #1e293b !important;
          }
          .print\\:hidden {
            display: none !important;
          }

          /* Force page 2 to start on a new page */
          .page-break-before {
            page-break-before: always;
            break-before: page;
          }

          /* Light gray borders */
          .border-gray-300 {
            border-color: #d1d5db !important;
            border-width: 0.5pt !important;
          }
          
          .border-gray-400 {
            border-color: #9ca3af !important;
            border-width: 0.75pt !important;
          }
          
          .border-gray-500 {
            border-color: #6b7280 !important;
            border-width: 1.5pt !important;
          }
          
          /* Maintain background colors for visual hierarchy */
          .bg-gray-50 {
            background-color: #f9fafb !important;
          }
          
          .bg-gray-100 {
            background-color: #f3f4f6 !important;
          }
          
          .bg-blue-50 {
            background-color: #eff6ff !important;
          }
          
          /* Color preservation for labels and text */
          .text-gray-400 {
            color: #9ca3af !important;
          }
          
          .text-slate-400 {
            color: #94a3b8 !important;
          }
          
          .text-gray-600 {
            color: #4b5563 !important;
          }
          
          .text-slate-500 {
            color: #64748b !important;
          }
          
          .text-slate-600 {
            color: #475569 !important;
          }
          
          .text-slate-700 {
            color: #334155 !important;
          }
          
          .text-slate-800 {
            color: #1e293b !important;
          }
          
          .text-slate-900 {
            color: #0f172a !important;
          }

          .rounded, .rounded-md, .rounded-lg, .rounded-xl {
            border-radius: 0 !important;
          }

          .shadow, [class*="shadow-"] {
            box-shadow: none !important;
          }

          /* Improved typography hierarchy */
          .text-4xl { font-size: 28pt !important; font-weight: 700 !important; line-height: 1.1 !important; }
          .text-3xl { font-size: 20pt !important; line-height: 1.2 !important; }
          .text-2xl { font-size: 16pt !important; line-height: 1.2 !important; }
          .text-xl { font-size: 13pt !important; font-weight: 600 !important; line-height: 1.3 !important; }
          .text-lg { font-size: 11pt !important; font-weight: bold !important; line-height: 1.3 !important; }
          .text-base { font-size: 10pt !important; line-height: 1.4 !important; }
          .text-sm { font-size: 10pt !important; line-height: 1.4 !important; font-weight: 600 !important; }
          table th { font-size: 9pt !important; font-weight: 700 !important; }
          table td { font-size: 9pt !important; }
          .text-xs { font-size: 8pt !important; line-height: 1.4 !important; }
          .text-\\[10px\\] { font-size: 7pt !important; text-transform: uppercase !important; letter-spacing: 0.05em !important; }
          .text-\\[9px\\] { font-size: 6pt !important; }
          
          /* Spacing adjustments */
          .max-w-6xl { max-width: 100% !important; }
          .p-4 { padding: 10px !important; }
          .p-8 { padding: 10px !important; }
          .p-6 { padding: 8px !important; }
          .px-2 { padding-left: 5px !important; padding-right: 5px !important; }
          .px-3 { padding-left: 6px !important; padding-right: 6px !important; }
          .py-1 { padding-top: 3px !important; padding-bottom: 3px !important; }
          .py-1\\.5 { padding-top: 4px !important; padding-bottom: 4px !important; }
          .py-2 { padding-top: 4px !important; padding-bottom: 4px !important; }
          .py-2\\.5 { padding-top: 5px !important; padding-bottom: 5px !important; }
          .py-3 { padding-top: 6px !important; padding-bottom: 6px !important; }
          .py-4 { padding-top: 8px !important; padding-bottom: 8px !important; }
          .mt-3 { margin-top: 6px !important; }
          .mt-8 { margin-top: 6px !important; }
          .mt-4 { margin-top: 4px !important; }
          .mt-2 { margin-top: 2px !important; }
          .mt-1 { margin-top: 2px !important; }
          .mt-0\\.5 { margin-top: 1px !important; }
          .mb-2 { margin-bottom: 4px !important; }
          .mb-3 { margin-bottom: 6px !important; }
          .mb-4 { margin-bottom: 8px !important; }
          .mb-6 { margin-bottom: 6px !important; }
          .mb-1\\.5 { margin-bottom: 2px !important; }
          .mb-1 { margin-bottom: 2px !important; }
          .mb-0\\.5 { margin-bottom: 1px !important; }
          .pt-2 { padding-top: 4px !important; }
          .pt-4 { padding-top: 4px !important; }
          .pb-3 { padding-bottom: 6px !important; }
          .pb-6 { padding-bottom: 6px !important; }
          .gap-3 { gap: 6px !important; }
          .gap-6 { gap: 6px !important; }
          .gap-8 { gap: 6px !important; }
          .grid { gap: 4px !important; }
          .space-y-4 > * + * { margin-top: 8px !important; }
          .space-y-2 > * + * { margin-top: 2px !important; }
          .space-y-1 > * + * { margin-top: 2px !important; }
          .space-y-0 > * + * { margin-top: 0 !important; }
          .space-y-0\\.5 > * + * { margin-top: 1px !important; }
          .ml-4 { margin-left: 8px !important; }
          .ml-2 { margin-left: 4px !important; }
          
          /* Better table spacing */
          table { border-collapse: collapse !important; width: 100% !important; }
          td, th { padding: 6px 8px !important; }
          
          /* Ensure proper line spacing in descriptions */
          .leading-relaxed { line-height: 1.5 !important; }
        }
      `}</style>
    </div>
  );
}
