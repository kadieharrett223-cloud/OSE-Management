"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/Sidebar";

type PurchaseOrder = {
  id: string;
  po_number: string;
  vendor_name: string;
  order_date: string;
  total_amount: number;
  status: string;
  lines?: any[];
  payments?: any[];
};

type PriceListItem = {
  id: string;
  sku: string;
  description: string;
  currentSalePricePerUnit: number;
  weight_lbs?: number;
  fob_cost?: number;
};

type Supplier = {
  id: string;
  name: string;
  address?: string;
  city_state_zip?: string;
  contact_name?: string;
  representative?: string;
  email?: string;
  phone?: string;
  terms?: string;
  payment_method?: string;
  ship_to_name?: string;
  ship_to_address?: string;
  ship_to_city_state_zip?: string;
};

const WEIGHT_LIMIT_LBS = 44000;

const money = (value: number | undefined) => {
  if (value === undefined || value === null || isNaN(value)) return "0.00";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function titleCase(value: string) {
  return (value || "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function PurchasingPage() {
  const { data: session } = useSession();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [priceList, setPriceList] = useState<PriceListItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [formData, setFormData] = useState({
    po_number: "",
    vendor_name: "",
    vendor_address: "",
    vendor_city_state_zip: "",
    vendor_contact_name: "",
    vendor_email: "",
    vendor_phone: "",
    ship_to_name: "Top Secret Customs",
    ship_to_address: "DBA Olympic Shop Equipment",
    ship_to_city_state_zip: "18935 59th Ave NE, Arlington WA. 98223",
    representative: "",
    authorized_by: "",
    destination: "",
    terms: "",
    payment_method: "",
    order_date: new Date().toISOString().split("T")[0],
    expected_delivery: "",
    status: "DRAFT",
    notes: "",
    lines: [{ sku: "", description: "", quantity: 1, unit_price: 0, weight_lbs: 0 }],
  });
  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split("T")[0],
    amount: 0,
    payment_method: "",
    reference_number: "",
    notes: "",
  });

  const [supplierModal, setSupplierModal] = useState<{open:boolean, mode:"create"|"edit", supplier?: Supplier|null}>({open:false, mode:"create"});
  const [supplierForm, setSupplierForm] = useState<Supplier>({
    id: "",
    name: "",
    address: "",
    city_state_zip: "",
    contact_name: "",
    email: "",
    phone: "",
    terms: "",
    payment_method: "",
    ship_to_name: "",
    ship_to_address: "",
    ship_to_city_state_zip: "",
  });

  useEffect(() => {
    fetchPOs();
    fetchPriceList();
    fetchSuppliers();
  }, []);

  async function fetchPriceList() {
    try {
      const res = await fetch("/api/price-list");
      if (!res.ok) {
        console.error("Price list fetch failed with status:", res.status);
        return;
      }
      const data = await res.json();
      console.log("Price list fetched:", data);
      setPriceList(data || []);
    } catch (error) {
      console.error("Failed to fetch price list:", error);
    }
  }

  async function fetchSuppliers() {
    try {
      const res = await fetch("/api/suppliers");
      const payload = await res.json();
      if (payload.ok) setSuppliers(payload.data || []);
    } catch (error) {
      console.error("Failed to fetch suppliers:", error);
    }
  }

  async function fetchPOs() {
    setLoading(true);
    try {
      const res = await fetch("/api/purchase-orders");
      const payload = await res.json();
      if (payload.ok) {
        setPos(payload.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch POs:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePO(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const payload = await res.json();
      if (res.ok) {
        await fetchPOs();
        setShowForm(false);
        resetForm();
      } else {
        alert(payload.error || "Failed to create PO");
      }
    } catch (error) {
      console.error("Create PO error:", error);
      alert("Failed to create PO");
    }
  }

  async function handleAddPayment(poId: string) {
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentForm),
      });
      const payload = await res.json();
      if (res.ok) {
        await fetchPOs();
        setSelectedPO(null);
        setPaymentForm({
          payment_date: new Date().toISOString().split("T")[0],
          amount: 0,
          payment_method: "",
          reference_number: "",
          notes: "",
        });
      } else {
        alert(payload.error || "Failed to add payment");
      }
    } catch (error) {
      console.error("Add payment error:", error);
      alert("Failed to add payment");
    }
  }

  async function handleSaveSupplier() {
    try {
      const isEdit = supplierModal.mode === "edit" && supplierModal.supplier?.id;
      const url = isEdit ? `/api/suppliers/${supplierModal.supplier!.id}` : "/api/suppliers";
      const method = isEdit ? "PATCH" : "POST";
      const payload = { ...supplierForm };
      if (!payload.name) { alert("Supplier name is required"); return; }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to save supplier");
        return;
      }
      setSupplierModal({ open: false, mode: "create", supplier: null });
      setSupplierForm({
        id: "",
        name: "",
        address: "",
        city_state_zip: "",
        contact_name: "",
        email: "",
        phone: "",
        terms: "",
        payment_method: "",
        ship_to_name: "",
        ship_to_address: "",
        ship_to_city_state_zip: "",
      });
      await fetchSuppliers();
    } catch (error) {
      console.error("Save supplier error:", error);
      alert("Failed to save supplier");
    }
  }

  function resetForm() {
    setFormData({
      po_number: "",
      vendor_name: "",
      vendor_address: "",
      vendor_city_state_zip: "",
      vendor_contact_name: "",
      vendor_email: "",
      vendor_phone: "",
      ship_to_name: "",
      ship_to_address: "",
      ship_to_city_state_zip: "",
      representative: "",
      authorized_by: "",
      destination: "",
      terms: "",
      payment_method: "",
      order_date: new Date().toISOString().split("T")[0],
      expected_delivery: "",
      status: "DRAFT",
      notes: "",
      lines: [{ sku: "", description: "", quantity: 1, unit_price: 0, weight_lbs: 0 }],
    });
  }

  function addLine() {
    setFormData({
      ...formData,
      lines: [...formData.lines, { sku: "", description: "", quantity: 1, unit_price: 0, weight_lbs: 0 }],
    });
  }

  function removeLine(index: number) {
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index),
    });
  }

  function updateLine(index: number, field: string, value: any) {
    const updated = [...formData.lines];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-populate description, price, and weight when SKU is selected
    if (field === "sku" && value) {
      const item = priceList.find((p) => p.sku === value);
      if (item) {
        updated[index].description = item.description || "";
        updated[index].unit_price = item.fob_cost || 0;
        updated[index].weight_lbs = item.weight_lbs || 0;
      }
    }

    setFormData({ ...formData, lines: updated });
  }

  const totalPaid = (po: PurchaseOrder) =>
    (po.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = (po: PurchaseOrder) => Number(po.total_amount) - totalPaid(po);

  // Calculate total weight from line items
  const calculateTotalWeight = () => {
    return formData.lines.reduce((sum, line) => {
      const lineWeight = (line.weight_lbs || 0) * (line.quantity || 0);
      return sum + lineWeight;
    }, 0);
  };

  const totalWeight = calculateTotalWeight();
  const remainingWeight = WEIGHT_LIMIT_LBS - totalWeight;
  const weightPercentage = (totalWeight / WEIGHT_LIMIT_LBS) * 100;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Purchasing" />
        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900">
          <div className="mx-auto max-w-7xl px-8 py-10 space-y-8">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-700">Purchasing</p>
                <h1 className="mt-2 text-3xl font-semibold text-slate-900">Purchase Orders</h1>
              </div>
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700"
                >
                  Create New PO
                </button>
              )}
            </header>

            {showForm && (
              <form onSubmit={handleCreatePO} className="rounded-xl bg-white p-8 shadow-md ring-1 ring-slate-200 space-y-6">
                {/* Header Section */}
                <div className="grid grid-cols-2 gap-6 pb-6 border-b border-slate-200">
                  <div>
                    <h2 className="text-2xl font-bold text-blue-600 mb-2">Purchase Order</h2>
                    <div className="text-sm text-slate-600">
                      <p className="font-semibold">Olympic Shop Equipment</p>
                      <p>18935 59th Ave NE</p>
                      <p>Arlington WA. 98223</p>
                      <p>Phone: 360-651-2540</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-sm font-semibold text-slate-700">Date</label>
                      <input
                        type="date"
                        value={formData.order_date}
                        onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                        className="rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        required
                      />
                      <label className="text-sm font-semibold text-slate-700">PO Number</label>
                      <input
                        type="text"
                        value={formData.po_number}
                        onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                        className="rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Supplier and Ship To Section */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-2 bg-slate-100 px-2 py-1">Supplier</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedSupplierId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSelectedSupplierId(id);
                            const s = suppliers.find((sup) => sup.id === id);
                            if (s) {
                              setFormData({
                                ...formData,
                                vendor_name: titleCase(s.name || ""),
                                vendor_address: s.address || "",
                                vendor_city_state_zip: s.city_state_zip || "",
                                vendor_contact_name: s.contact_name || "",
                                representative: (s.representative || s.contact_name || ""),
                                vendor_email: s.email || "",
                                vendor_phone: s.phone || "",
                                terms: "30% advance",
                                payment_method: "WT",
                                authorized_by: "Peter Harrett",
                                destination: "Port of Seattle WA. USA",
                              });
                            }
                          }}
                          className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="">Select supplier...</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        {/* New Supplier button removed; available in main menu */}
                        {selectedSupplierId && (
                          <button
                            type="button"
                            onClick={() => {
                              const s = suppliers.find((sup) => sup.id === selectedSupplierId);
                              setSupplierForm({
                                id: s?.id || "",
                                name: s?.name || "",
                                address: s?.address || "",
                                city_state_zip: s?.city_state_zip || "",
                                contact_name: s?.contact_name || "",
                                email: s?.email || "",
                                phone: s?.phone || "",
                                terms: s?.terms || "",
                                payment_method: s?.payment_method || "",
                                ship_to_name: s?.ship_to_name || "",
                                ship_to_address: s?.ship_to_address || "",
                                ship_to_city_state_zip: s?.ship_to_city_state_zip || "",
                              });
                              setSupplierModal({ open: true, mode: "edit", supplier: s || null });
                            }}
                            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Company Name"
                        value={formData.vendor_name}
                        onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                        className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Address"
                        value={formData.vendor_address}
                        onChange={(e) => setFormData({ ...formData, vendor_address: e.target.value })}
                        className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="City, State, ZIP"
                        value={formData.vendor_city_state_zip}
                        onChange={(e) => setFormData({ ...formData, vendor_city_state_zip: e.target.value })}
                        className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-2 bg-slate-100 px-2 py-1">Ship To</h3>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Company/Person Name"
                        value={formData.ship_to_name}
                        onChange={(e) => setFormData({ ...formData, ship_to_name: e.target.value })}
                        className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Address"
                        value={formData.ship_to_address}
                        onChange={(e) => setFormData({ ...formData, ship_to_address: e.target.value })}
                        className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="City, State, ZIP"
                        value={formData.ship_to_city_state_zip}
                        onChange={(e) => setFormData({ ...formData, ship_to_city_state_zip: e.target.value })}
                        className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Details Row */}
                <div className="grid grid-cols-4 gap-3 py-3 border-t border-b border-slate-200">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Supplier Contact</label>
                    <input
                      type="text"
                      value={formData.vendor_contact_name}
                      onChange={(e) => setFormData({ ...formData, vendor_contact_name: e.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Representative</label>
                    <input
                      type="text"
                      value={formData.representative}
                      onChange={(e) => setFormData({ ...formData, representative: e.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Contact Email</label>
                    <input
                      type="email"
                      value={formData.vendor_email}
                      onChange={(e) => setFormData({ ...formData, vendor_email: e.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Phone</label>
                    <input
                      type="tel"
                      value={formData.vendor_phone}
                      onChange={(e) => setFormData({ ...formData, vendor_phone: e.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Terms Row */}
                <div className="grid grid-cols-4 gap-3 py-3 border-b border-slate-200">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Authorized By</label>
                    <input
                      type="text"
                      value={formData.authorized_by}
                      onChange={(e) => setFormData({ ...formData, authorized_by: e.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Destination</label>
                    <input
                      type="text"
                      value={formData.destination}
                      onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Terms</label>
                    <input
                      type="text"
                      placeholder="e.g., 30% advance"
                      value={formData.terms}
                      onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Payment Method</label>
                    <input
                      type="text"
                      placeholder="e.g., WT"
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Line Items Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-slate-700">Line Items</h3>
                    <div className="flex items-center gap-4">
                      <div className="text-xs text-slate-600">
                        <span className="font-semibold">Container weight:</span> 
                        <span className={`ml-1 ${
                          totalWeight > WEIGHT_LIMIT_LBS ? 'text-red-600 font-bold' : 
                          weightPercentage > 90 ? 'text-yellow-600 font-semibold' : 
                          'text-slate-700'
                        }`}>
                          {(totalWeight || 0).toLocaleString()} / 44,000 lbs
                        </span>
                        {totalWeight > WEIGHT_LIMIT_LBS && (
                          <span className="ml-2 text-red-600 font-bold">⚠ OVER</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={addLine}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                      >
                        + Add Line
                      </button>
                    </div>
                  </div>
                  <div className="border border-slate-300 rounded">
                    <div className="grid grid-cols-12 gap-0 bg-slate-100 border-b border-slate-300">
                      <div className="col-span-2 px-3 py-2 text-xs font-semibold text-slate-700 border-r border-slate-300">Part Number</div>
                      <div className="col-span-4 px-3 py-2 text-xs font-semibold text-slate-700 border-r border-slate-300">Description</div>
                      <div className="col-span-1 px-3 py-2 text-xs font-semibold text-slate-700 text-center border-r border-slate-300">QTY</div>
                      <div className="col-span-1 px-3 py-2 text-xs font-semibold text-slate-700 text-center border-r border-slate-300">Weight</div>
                      <div className="col-span-2 px-3 py-2 text-xs font-semibold text-slate-700 text-right border-r border-slate-300">Rate</div>
                      <div className="col-span-2 px-3 py-2 text-xs font-semibold text-slate-700 text-right">Amount</div>
                    </div>
                    {formData.lines.map((line, index) => (
                      <div key={index} className="grid grid-cols-12 gap-0 border-b border-slate-200 hover:bg-slate-50">
                        <div className="col-span-2 border-r border-slate-200 p-2">
                          <input
                            type="text"
                            list={`sku-list-${index}`}
                            placeholder="Enter or search SKU"
                            value={line.sku}
                            onChange={(e) => updateLine(index, "sku", e.target.value)}
                            className="w-full border-0 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none bg-transparent"
                            required
                          />
                          <datalist id={`sku-list-${index}`}>
                            {priceList.map((item) => (
                              <option key={item.id} value={item.sku}>{item.description}</option>
                            ))}
                          </datalist>
                        </div>
                        <div className="col-span-4 border-r border-slate-200 p-2">
                          <textarea
                            placeholder="Description"
                            value={line.description}
                            onChange={(e) => updateLine(index, "description", e.target.value)}
                            className="w-full border-0 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none bg-transparent"
                            rows={3}
                            required
                          />
                        </div>
                        <div className="col-span-1 border-r border-slate-200 p-2">
                          <input
                            type="number"
                            step="1"
                            value={line.quantity}
                            onChange={(e) => updateLine(index, "quantity", Number(e.target.value))}
                            className="w-full border-0 px-2 py-1 text-sm text-center focus:ring-1 focus:ring-blue-500 focus:outline-none bg-transparent"
                            required
                          />
                        </div>
                        <div className="col-span-1 border-r border-slate-200 p-2">
                          <input
                            type="number"
                            step="1"
                            value={line.weight_lbs || ""}
                            onChange={(e) => updateLine(index, "weight_lbs", Number(e.target.value) || 0)}
                            placeholder="lbs"
                            className="w-full border-0 px-2 py-1 text-sm text-center focus:ring-1 focus:ring-blue-500 focus:outline-none bg-transparent"
                          />
                        </div>
                        <div className="col-span-2 border-r border-slate-200 p-2">
                          <input
                            type="number"
                            step="0.01"
                            value={line.unit_price}
                            onChange={(e) => updateLine(index, "unit_price", Number(e.target.value))}
                            className="w-full border-0 px-2 py-1 text-sm text-right focus:ring-1 focus:ring-blue-500 focus:outline-none bg-transparent"
                            required
                          />
                        </div>
                        <div className="col-span-2 p-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-900">
                            ${money(line.quantity * line.unit_price)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="ml-2 text-red-600 hover:text-red-700 hover:bg-red-50 font-bold text-xl px-2 py-0 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            disabled={formData.lines.length === 1}
                            title={formData.lines.length === 1 ? "Cannot delete the last line" : "Delete line"}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-12 gap-0 bg-slate-50 border-t-2 border-slate-300">
                      <div className="col-span-7 px-3 py-3 text-right text-sm font-bold text-slate-700">Total Weight:</div>
                      <div className="col-span-3 px-3 py-3 text-right text-sm font-bold ${
                        totalWeight > WEIGHT_LIMIT_LBS ? 'text-red-600' : 'text-slate-900'
                      }">
                        {(totalWeight || 0).toLocaleString()} lbs
                      </div>
                      <div className="col-span-2"></div>
                    </div>
                    <div className="grid grid-cols-12 gap-0 bg-slate-50">
                      <div className="col-span-10 px-3 py-3 text-right text-sm font-bold text-slate-700">Total Amount:</div>
                      <div className="col-span-2 px-3 py-3 text-right text-sm font-bold text-slate-900">
                        ${money(formData.lines.reduce((sum, line) => sum + (line.quantity * line.unit_price), 0))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes Section */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    rows={4}
                    placeholder="Additional specifications, warranty info, shipping instructions, etc."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-6 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Create Purchase Order
                  </button>
                </div>
              </form>
            )}

            {/* Supplier Modal */}
            {supplierModal.open && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl space-y-4">
                  <h2 className="text-xl font-semibold text-slate-900">{supplierModal.mode === "create" ? "New Supplier" : "Edit Supplier"}</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Name" value={supplierForm.name} onChange={(e)=>setSupplierForm({...supplierForm,name:e.target.value})} />
                    <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Contact Name" value={supplierForm.contact_name} onChange={(e)=>setSupplierForm({...supplierForm,contact_name:e.target.value})} />
                    <input className="rounded border border-slate-300 px-3 py-2 text-sm col-span-2" placeholder="Address" value={supplierForm.address} onChange={(e)=>setSupplierForm({...supplierForm,address:e.target.value})} />
                    <input className="rounded border border-slate-300 px-3 py-2 text-sm col-span-2" placeholder="City, State, ZIP" value={supplierForm.city_state_zip} onChange={(e)=>setSupplierForm({...supplierForm,city_state_zip:e.target.value})} />
                    <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Email" value={supplierForm.email} onChange={(e)=>setSupplierForm({...supplierForm,email:e.target.value})} />
                    <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Phone" value={supplierForm.phone} onChange={(e)=>setSupplierForm({...supplierForm,phone:e.target.value})} />
                    <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Terms (e.g., 30% advance)" value={supplierForm.terms} onChange={(e)=>setSupplierForm({...supplierForm,terms:e.target.value})} />
                    <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Payment Method (e.g., WT)" value={supplierForm.payment_method} onChange={(e)=>setSupplierForm({...supplierForm,payment_method:e.target.value})} />
                    <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Ship To Name" value={supplierForm.ship_to_name} onChange={(e)=>setSupplierForm({...supplierForm,ship_to_name:e.target.value})} />
                    <input className="rounded border border-slate-300 px-3 py-2 text-sm col-span-2" placeholder="Ship To Address" value={supplierForm.ship_to_address} onChange={(e)=>setSupplierForm({...supplierForm,ship_to_address:e.target.value})} />
                    <input className="rounded border border-slate-300 px-3 py-2 text-sm col-span-2" placeholder="Ship To City, State, ZIP" value={supplierForm.ship_to_city_state_zip} onChange={(e)=>setSupplierForm({...supplierForm,ship_to_city_state_zip:e.target.value})} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={()=>setSupplierModal({open:false,mode:"create"})} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                    <button type="button" onClick={handleSaveSupplier} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Save</button>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">All Purchase Orders</h2>
              </div>
              {loading ? (
                <div className="px-6 py-8 text-center text-slate-600">Loading...</div>
              ) : pos.length === 0 ? (
                <div className="px-6 py-8 text-center text-slate-600">No purchase orders yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">PO #</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Vendor</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Date</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Total</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Paid</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Balance</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-slate-500">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pos.map((po) => (
                        <tr key={po.id} className="hover:bg-slate-50">
                          <td className="px-6 py-3 font-medium text-slate-900">{po.po_number}</td>
                          <td className="px-6 py-3 text-slate-600">{po.vendor_name}</td>
                          <td className="px-6 py-3 text-slate-600">{po.order_date}</td>
                          <td className="px-6 py-3 text-right font-semibold text-slate-900">${money(po.total_amount)}</td>
                          <td className="px-6 py-3 text-right text-emerald-700">${money(totalPaid(po))}</td>
                          <td className="px-6 py-3 text-right font-semibold text-slate-900">${money(balance(po))}</td>
                          <td className="px-6 py-3 text-center">
                            <span
                              className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                                po.status === "RECEIVED"
                                  ? "bg-green-100 text-green-800"
                                  : po.status === "SUBMITTED"
                                  ? "bg-blue-100 text-blue-800"
                                  : po.status === "CANCELLED"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-slate-100 text-slate-800"
                              }`}
                            >
                              {po.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => window.location.href = `/admin/purchasing/${po.id}`}
                                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                              >
                                View
                              </button>
                              <button
                                onClick={() => setSelectedPO(po)}
                                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                              >
                                Add Payment
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {selectedPO && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
                  <h2 className="text-xl font-semibold text-slate-900">Add Payment</h2>
                  <p className="text-sm text-slate-600">
                    PO: {selectedPO.po_number} | Balance: ${money(balance(selectedPO))}
                  </p>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Payment Date</label>
                    <input
                      type="date"
                      value={paymentForm.payment_date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Payment Method</label>
                    <select
                      value={paymentForm.payment_method}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Select...</option>
                      <option value="CHECK">Check</option>
                      <option value="WIRE">Wire Transfer</option>
                      <option value="ACH">ACH</option>
                      <option value="CREDIT_CARD">Credit Card</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Reference Number</label>
                    <input
                      type="text"
                      value={paymentForm.reference_number}
                      onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Notes</label>
                    <textarea
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => setSelectedPO(null)}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPayment(selectedPO.id)}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Add Payment
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
