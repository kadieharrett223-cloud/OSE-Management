"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { usePathname } from "next/navigation";

type PurchaseOrder = {
  id: string;
  po_number: string;
  vendor_name: string;
  order_date: string;
  expected_delivery?: string | null;
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
  shippingIncludedPerUnit?: number;
  list_price?: number;
  sell_price?: number;
  per_unit?: number;
  cost_with_shipping?: number;
  zone5_shipping?: number;
  weight_lbs?: number;
  fob_cost?: number;
  category_id?: string | null;
  category_name?: string | null;
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
  notes?: string;
};

const WEIGHT_LIMIT_LBS = 44000;

const money = (value: number | undefined) => {
  if (value === undefined || value === null || isNaN(value)) return "0.00";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const statusLabel = (status: string) => {
  if (status === "TO_BE_PAID") return "To Be Paid";
  return status ? status.charAt(0) + status.slice(1).toLowerCase() : "";
};

function titleCase(value: string) {
  return (value || "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function PurchasingPage() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [priceList, setPriceList] = useState<PriceListItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [paymentsTodayTotal, setPaymentsTodayTotal] = useState(0);
  const [loadingPaymentsToday, setLoadingPaymentsToday] = useState(true);
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
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
    status: "TO_BE_PAID",
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
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

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
    notes: "",
  });

  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [creatingForLineIndex, setCreatingForLineIndex] = useState<number | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [draggedLineIndex, setDraggedLineIndex] = useState<number | null>(null);
  const [activeSkuSuggestionLine, setActiveSkuSuggestionLine] = useState<number | null>(null);
  const [newProductForm, setNewProductForm] = useState({
    item_no: "",
    description: "",
    category_id: "",
    supplier: "",
    fob_cost: 0,
    quantity: 0,
    ocean_frt: 0,
    importing: 0,
    zone5_shipping: 0,
    multiplier: 1,
    weight_lbs: 0,
  });

  useEffect(() => {
    fetchPOs();
    fetchPriceList();
    fetchSuppliers();
    fetchCategories();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchPaymentsTodayTotal = async () => {
      try {
        setLoadingPaymentsToday(true);
        const today = new Date().toLocaleDateString("en-CA");
        const res = await fetch(`/api/qbo/payment/query?startDate=${today}&endDate=${today}&_=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to fetch payments");
        const data = await res.json();
        const payments = data.payments || [];
        const computedTotal = payments.reduce((sum: number, payment: any) => {
          const total = Number(payment.TotalAmt) || 0;
          const unapplied = Number(payment.UnappliedAmt) || 0;
          const applied = Math.max(total - unapplied, 0);
          return sum + applied;
        }, 0);
        if (isMounted) setPaymentsTodayTotal(Number(data.totalApplied ?? computedTotal ?? 0));
      } catch (error) {
        console.error("Failed to fetch payments today:", error);
        if (isMounted) setPaymentsTodayTotal(0);
      } finally {
        if (isMounted) setLoadingPaymentsToday(false);
      }
    };

    fetchPaymentsTodayTotal();
    const interval = setInterval(fetchPaymentsTodayTotal, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setShowForm(true);
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, rangeStart, rangeEnd]);

  async function fetchPriceList() {
    try {
      const res = await fetch("/api/price-list?_=" + Date.now(), { 
        cache: "no-store"
      });
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

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/price-list/categories");
      const data = await res.json();
      if (res.ok) {
        setCategories(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  const openCreateProductModal = (lineIndex: number) => {
    setCreatingForLineIndex(lineIndex);
    const line = formData.lines[lineIndex];
    setNewProductForm({
      ...newProductForm,
      item_no: line.sku,
      description: line.description,
    });
    setShowCreateProductModal(true);
  };

  const handleCreateProduct = async () => {
    if (!newProductForm.item_no || !newProductForm.description) {
      alert("SKU and Description are required");
      return;
    }

    setCreatingProduct(true);
    try {
      const res = await fetch("/api/price-list/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_no: newProductForm.item_no,
          description: newProductForm.description,
          category_id: newProductForm.category_id || null,
          supplier: newProductForm.supplier || null,
          fob_cost: Number.isFinite(newProductForm.fob_cost) ? newProductForm.fob_cost : null,
          quantity: Number.isFinite(newProductForm.quantity) ? newProductForm.quantity : null,
          ocean_frt: Number.isFinite(newProductForm.ocean_frt) ? newProductForm.ocean_frt : null,
          importing: Number.isFinite(newProductForm.importing) ? newProductForm.importing : null,
          zone5_shipping: Number.isFinite(newProductForm.zone5_shipping) ? newProductForm.zone5_shipping : null,
          multiplier: Number.isFinite(newProductForm.multiplier) ? newProductForm.multiplier : 1,
          weight_lbs: Number.isFinite(newProductForm.weight_lbs) ? newProductForm.weight_lbs : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to create product");
        return;
      }

      const data = await res.json();
      const newItem = data.item;
      if (newItem) {
        setPriceList((prev) => [newItem, ...prev]);
        // Update the line item with the created product info
        if (creatingForLineIndex !== null) {
          updateLine(creatingForLineIndex, "unit_price", newItem.fob_cost || 0);
        }
      }

      setShowCreateProductModal(false);
      setNewProductForm({
        item_no: "",
        description: "",
        category_id: "",
        supplier: "",
        fob_cost: 0,
        quantity: 0,
        ocean_frt: 0,
        importing: 0,
        zone5_shipping: 0,
        multiplier: 1,
        weight_lbs: 0,
      });
      setCreatingForLineIndex(null);
    } catch (error) {
      console.error("Create product error:", error);
      alert("Failed to create product");
    } finally {
      setCreatingProduct(false);
    }
  };

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

  function resetPaymentForm() {
    setPaymentForm({
      payment_date: new Date().toISOString().split("T")[0],
      amount: 0,
      payment_method: "",
      reference_number: "",
      notes: "",
    });
    setEditingPaymentId(null);
  }

  async function refreshSelectedPO(poId: string) {
    const updatedPORes = await fetch(`/api/purchase-orders/${poId}`);
    const updatedPOPayload = await updatedPORes.json();
    if (updatedPOPayload.ok && updatedPOPayload.data) {
      setSelectedPO(updatedPOPayload.data);
    }
    await fetchPOs();
  }

  function startEditingPayment(payment: any) {
    setEditingPaymentId(payment.id);
    setPaymentForm({
      payment_date: payment.payment_date || new Date().toISOString().split("T")[0],
      amount: Number(payment.amount) || 0,
      payment_method: payment.payment_method || "",
      reference_number: payment.reference_number || "",
      notes: payment.notes || "",
    });
  }

  async function handleDeletePayment(poId: string, paymentId: string) {
    if (!confirm("Delete this payment?")) return;

    try {
      const res = await fetch(`/api/purchase-orders/${poId}/payments/${paymentId}`, {
        method: "DELETE",
      });
      const payload = await res.json();

      if (res.ok) {
        if (editingPaymentId === paymentId) {
          resetPaymentForm();
        }
        await refreshSelectedPO(poId);
        alert("Payment deleted successfully");
      } else {
        alert(payload.error || "Failed to delete payment");
      }
    } catch (error) {
      console.error("Delete payment error:", error);
      alert("Failed to delete payment");
    }
  }

  async function handleSavePayment(poId: string) {
    try {
      const isEditing = Boolean(editingPaymentId);
      const res = await fetch(
        isEditing
          ? `/api/purchase-orders/${poId}/payments/${editingPaymentId}`
          : `/api/purchase-orders/${poId}/payments`,
        {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentForm),
      });
      const payload = await res.json();

      if (res.ok) {
        await refreshSelectedPO(poId);
        const amountMessage = Number(paymentForm.amount || 0).toFixed(2);
        resetPaymentForm();
        alert(isEditing ? "Payment updated successfully!" : `Payment of $${amountMessage} added successfully!`);
      } else {
        alert(payload.error || (editingPaymentId ? "Failed to update payment" : "Failed to add payment"));
      }
    } catch (error) {
      console.error("Save payment error:", error);
      alert(editingPaymentId ? "Failed to update payment" : "Failed to add payment");
    }
  }

  async function updatePoStatus(poId: string, status: string) {
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      await fetchPOs();
    } catch (error) {
      console.error("Failed to update PO status:", error);
      alert("Failed to update status");
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
        notes: "",
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
      status: "TO_BE_PAID",
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

  function reorderLine(fromIndex: number, toIndex: number) {
    const newLines = [...formData.lines];
    const [removed] = newLines.splice(fromIndex, 1);
    newLines.splice(toIndex, 0, removed);
    setFormData({ ...formData, lines: newLines });
  }

  function updateLine(index: number, field: string, value: any) {
    setFormData((prev) => {
      const updated = [...prev.lines];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, lines: updated };
    });

    if (field !== "sku") return;

    const sku = String(value || "");
    if (!sku) return;

    const resolveUnitPrice = (item: any) => {
      const candidates = [
        Number(item?.fob_cost),
        Number(item?.cost_with_shipping),
        Number(item?.shippingIncludedPerUnit),
        Number(item?.per_unit),
        Number(item?.sell_price),
        Number(item?.currentSalePricePerUnit),
        Number(item?.list_price),
        Number(item?.zone5_shipping),
      ];

      for (const value of candidates) {
        if (Number.isFinite(value) && value > 0) return value;
      }

      return 0;
    };

    // Try immediate local cache match first.
    const cachedItem = priceList.find((p) => p.sku === sku);
    if (cachedItem) {
      setFormData((prev) => {
        const updated = [...prev.lines];
        const current = updated[index];
        if (!current) return prev;
        if ((current.sku || "") !== sku) return prev;

        updated[index] = {
          ...current,
          description: cachedItem.description || "",
          unit_price: resolveUnitPrice(cachedItem),
          weight_lbs: cachedItem.weight_lbs || 0,
        };

        return { ...prev, lines: updated };
      });
      return;
    }

    // Fallback to fresh fetch; apply only if the user still has same SKU typed.
    fetch("/api/price-list?_=" + Date.now(), { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const freshItem = data.find((p: any) => p.sku === sku);
        if (!freshItem) return;

        setFormData((prev) => {
          const updated = [...prev.lines];
          const current = updated[index];
          if (!current) return prev;
          if ((current.sku || "") !== sku) return prev;

          updated[index] = {
            ...current,
            description: freshItem.description || "",
            unit_price: resolveUnitPrice(freshItem),
            weight_lbs: freshItem.weight_lbs || 0,
          };

          return { ...prev, lines: updated };
        });
      })
      .catch((err) => console.error("Failed to fetch fresh product data:", err));
  }

  const toNumber = (value: unknown) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^0-9.-]/g, "");
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const computedTotal = (po: PurchaseOrder) => {
    const lines = po.lines || [];
    if (lines.length === 0) return toNumber(po.total_amount);
    return lines.reduce((sum, line) => {
      const lineTotal = toNumber(line?.line_total);
      if (lineTotal !== 0) return sum + lineTotal;
      const qty = toNumber(line?.quantity);
      const unitPrice = toNumber(line?.unit_price);
      return sum + qty * unitPrice;
    }, 0);
  };

  const totalPaid = (po: PurchaseOrder) =>
    (po.payments || []).reduce((sum, p) => sum + toNumber(p?.amount), 0);
  const balance = (po: PurchaseOrder) => computedTotal(po) - totalPaid(po);

  // Calculate total weight from line items
  const calculateTotalWeight = () => {
    return formData.lines.reduce((sum, line) => {
      const lineWeight = (line.weight_lbs || 0) * (line.quantity || 0);
      return sum + lineWeight;
    }, 0);
  };

  const totalWeight = calculateTotalWeight();
  const weightPercentage = (totalWeight / WEIGHT_LIMIT_LBS) * 100;

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredPos = pos.filter((po) => {
    const matchesQuery =
      !normalizedQuery ||
      po.po_number.toLowerCase().includes(normalizedQuery) ||
      po.vendor_name.toLowerCase().includes(normalizedQuery);

    const matchesStatus = statusFilter === "all" || po.status.toLowerCase() === statusFilter;

    const poDate = po.order_date ? new Date(po.order_date).toISOString().slice(0, 10) : "";
    const matchesStart = !rangeStart || (poDate && poDate >= rangeStart);
    const matchesEnd = !rangeEnd || (poDate && poDate <= rangeEnd);

    return matchesQuery && matchesStatus && matchesStart && matchesEnd;
  });

  const sortedFilteredPos = [...filteredPos].sort((a, b) => {
    const aNum = Number.parseInt(String(a.po_number || "").replace(/\D/g, ""), 10);
    const bNum = Number.parseInt(String(b.po_number || "").replace(/\D/g, ""), 10);

    if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) {
      return bNum - aNum;
    }

    return String(b.po_number || "").localeCompare(String(a.po_number || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  const totalPages = Math.max(Math.ceil(sortedFilteredPos.length / pageSize), 1);
  const safePage = Math.min(currentPage, totalPages);
  const pagedPos = sortedFilteredPos.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pathname = usePathname();
  const tabs = [
    { label: "Purchase Orders", href: "/admin/purchasing" },
    { label: "Shipment Tracking", href: "/admin/purchasing/shipment-tracking" },
    { label: "China Docs", href: "/admin/purchasing/china-docs" },
    { label: "Suppliers", href: "/admin/suppliers" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Purchasing" />
        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900">
          {/* Chrome-style Tabs */}
          <div className="bg-slate-800 border-b border-slate-700 px-4 md:px-8 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {tabs.map((tab) => (
                <a
                  key={tab.href}
                  href={tab.href}
                  className={`px-4 md:px-6 py-3 text-sm font-medium transition relative whitespace-nowrap ${
                    pathname === tab.href
                      ? "bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900 rounded-t-lg"
                      : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                  }`}
                >
                  {tab.label}
                </a>
              ))}
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-4 md:px-8 py-4 space-y-8">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Purchase Orders</h1>
                <p className="text-sm text-slate-600">Manage purchasing with clear status tracking.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search PO or supplier"
                  className="w-full sm:w-52 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="to_be_paid">To Be Paid</option>
                  <option value="shipped">Shipped</option>
                  <option value="received">Received</option>
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    className="flex-1 sm:flex-initial rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-500">to</span>
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    className="flex-1 sm:flex-initial rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {!showForm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full sm:w-auto rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700"
                  >
                    Create PO
                  </button>
                )}
              </div>
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
                                notes: s?.notes || "",
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
                      <div className="col-span-1 px-3 py-2 text-xs font-semibold text-slate-700 border-r border-slate-300 text-center">⋮</div>
                      <div className="col-span-2 px-3 py-2 text-xs font-semibold text-slate-700 border-r border-slate-300">Part Number</div>
                      <div className="col-span-3 px-3 py-2 text-xs font-semibold text-slate-700 border-r border-slate-300">Description</div>
                      <div className="col-span-1 px-3 py-2 text-xs font-semibold text-slate-700 text-center border-r border-slate-300">QTY</div>
                      <div className="col-span-1 px-3 py-2 text-xs font-semibold text-slate-700 text-center border-r border-slate-300">Weight</div>
                      <div className="col-span-2 px-3 py-2 text-xs font-semibold text-slate-700 text-right border-r border-slate-300">Rate</div>
                      <div className="col-span-2 px-3 py-2 text-xs font-semibold text-slate-700 text-right">Amount</div>
                    </div>
                    {formData.lines.map((line, index) => (
                      <div
                        key={index}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggedLineIndex !== null && draggedLineIndex !== index) {
                            reorderLine(draggedLineIndex, index);
                            setDraggedLineIndex(null);
                          }
                        }}
                        className={`grid grid-cols-12 gap-0 border-b border-slate-200 ${
                          draggedLineIndex === index ? 'bg-blue-100 opacity-70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="col-span-1 border-r border-slate-200 p-2 flex items-center justify-center text-slate-400 hover:text-slate-600">
                          <span
                            draggable
                            onDragStart={() => setDraggedLineIndex(index)}
                            onDragEnd={() => setDraggedLineIndex(null)}
                            className="cursor-move select-none"
                            title="Drag to reorder"
                          >
                            ⋮
                          </span>
                        </div>
                        <div className="col-span-2 border-r border-slate-200 p-2">
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              placeholder="Type SKU to search product"
                              value={line.sku}
                              onChange={(e) => updateLine(index, "sku", e.target.value)}
                              onFocus={() => setActiveSkuSuggestionLine(index)}
                              onBlur={() => {
                                setTimeout(() => {
                                  setActiveSkuSuggestionLine((prev) => (prev === index ? null : prev));
                                }, 120);
                              }}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                              autoComplete="off"
                              required
                            />

                            {!!line.sku && activeSkuSuggestionLine === index && !priceList.some((item) => (item.sku || "").toLowerCase() === (line.sku || "").toLowerCase()) && (
                              <div className="max-h-36 overflow-y-auto rounded border border-slate-200 bg-white">
                                {priceList
                                  .filter((item) => {
                                    const query = (line.sku || "").toLowerCase();
                                    return (
                                      (item.sku || "").toLowerCase().includes(query) ||
                                      (item.description || "").toLowerCase().includes(query)
                                    );
                                  })
                                  .slice(0, 8)
                                  .map((item) => (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => {
                                        updateLine(index, "sku", item.sku);
                                        setActiveSkuSuggestionLine(null);
                                      }}
                                      className="block w-full border-b border-slate-100 px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-50"
                                    >
                                      <span className="font-mono font-semibold">{item.sku}</span>
                                      <span className="ml-2 text-slate-500">{item.description}</span>
                                    </button>
                                  ))}
                              </div>
                            )}

                            {!priceList.some((item) => item.sku === line.sku) && line.sku && (
                              <button
                                type="button"
                                onClick={() => openCreateProductModal(index)}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                              >
                                + Create new product
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="col-span-3 border-r border-slate-200 p-2">
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
                    <textarea className="rounded border border-slate-300 px-3 py-2 text-sm col-span-2" placeholder="Notes" value={supplierForm.notes || ""} onChange={(e)=>setSupplierForm({...supplierForm,notes:e.target.value})} rows={2} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={()=>setSupplierModal({open:false,mode:"create"})} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                    <button type="button" onClick={handleSaveSupplier} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Save</button>
                  </div>
                </div>
              </div>
            )}

            {/* Create Product Modal */}
            {showCreateProductModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4 max-h-96 overflow-y-auto">
                  <h2 className="text-xl font-semibold text-slate-900">Create Product</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">SKU *</label>
                      <input
                        type="text"
                        value={newProductForm.item_no}
                        onChange={(e) => setNewProductForm({ ...newProductForm, item_no: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
                      <select
                        value={newProductForm.category_id}
                        onChange={(e) => setNewProductForm({ ...newProductForm, category_id: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="">Select category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Description *</label>
                      <input
                        type="text"
                        value={newProductForm.description}
                        onChange={(e) => setNewProductForm({ ...newProductForm, description: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Supplier</label>
                      <input
                        type="text"
                        value={newProductForm.supplier}
                        onChange={(e) => setNewProductForm({ ...newProductForm, supplier: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">FOB Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newProductForm.fob_cost}
                        onChange={(e) => setNewProductForm({ ...newProductForm, fob_cost: Number(e.target.value) })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Weight (lbs)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newProductForm.weight_lbs}
                        onChange={(e) => setNewProductForm({ ...newProductForm, weight_lbs: Number(e.target.value) })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateProductModal(false)}
                      disabled={creatingProduct}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateProduct}
                      disabled={creatingProduct}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {creatingProduct ? "Creating..." : "Create Product"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">PO #</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Supplier</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Created</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Total</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Balance Due</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-slate-500">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      Array.from({ length: 6 }).map((_, idx) => (
                        <tr key={`skeleton-${idx}`} className="animate-pulse">
                          <td className="px-6 py-4"><div className="h-3 w-24 rounded bg-slate-200" /></td>
                          <td className="px-6 py-4"><div className="h-3 w-40 rounded bg-slate-200" /></td>
                          <td className="px-6 py-4"><div className="h-3 w-28 rounded bg-slate-200" /></td>
                          <td className="px-6 py-4 text-right"><div className="ml-auto h-3 w-20 rounded bg-slate-200" /></td>
                          <td className="px-6 py-4 text-right"><div className="ml-auto h-3 w-20 rounded bg-slate-200" /></td>
                          <td className="px-6 py-4 text-center"><div className="mx-auto h-3 w-16 rounded bg-slate-200" /></td>
                          <td className="px-6 py-4 text-right"><div className="ml-auto h-3 w-24 rounded bg-slate-200" /></td>
                        </tr>
                      ))
                    ) : sortedFilteredPos.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-600">
                          <div className="text-lg font-semibold text-slate-900">No purchase orders yet</div>
                          <div className="mt-2 text-sm text-slate-600">Create your first PO to start tracking purchasing.</div>
                          <div className="mt-4">
                            <button
                              onClick={() => setShowForm(true)}
                              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700"
                            >
                              Create your first PO
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      pagedPos.map((po) => (
                        <tr key={po.id} className="hover:bg-slate-50">
                          <td className="px-6 py-3 font-medium text-slate-900">{po.po_number}</td>
                          <td className="px-6 py-3 text-slate-600">{po.vendor_name}</td>
                          <td className="px-6 py-3 text-slate-600">{formatDate(po.order_date)}</td>
                          <td className="px-6 py-3 text-right font-semibold text-slate-900">${money(computedTotal(po))}</td>
                          <td className="px-6 py-3 text-right font-semibold text-amber-700">${money(balance(po))}</td>
                          <td className="px-6 py-3 text-center">
                            <span
                              className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                                po.status === "RECEIVED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : po.status === "SHIPPED"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {statusLabel(po.status)}
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
                                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                              >
                                Add Payment
                              </button>
                              {po.status === "TO_BE_PAID" && (
                                <button
                                  onClick={() => updatePoStatus(po.id, "SHIPPED")}
                                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                                >
                                  Mark Shipped
                                </button>
                              )}
                              {po.status === "SHIPPED" && (
                                <button
                                  onClick={() => updatePoStatus(po.id, "RECEIVED")}
                                  className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                                >
                                  Mark Received
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <div key={`skeleton-${idx}`} className="p-4 animate-pulse space-y-2">
                      <div className="h-4 w-24 rounded bg-slate-200" />
                      <div className="h-3 w-40 rounded bg-slate-200" />
                      <div className="h-3 w-32 rounded bg-slate-200" />
                    </div>
                  ))
                ) : sortedFilteredPos.length === 0 ? (
                  <div className="p-8 text-center text-slate-600">
                    <div className="text-lg font-semibold text-slate-900">No purchase orders yet</div>
                    <div className="mt-2 text-sm text-slate-600">Create your first PO to start tracking purchasing.</div>
                    <div className="mt-4">
                      <button
                        onClick={() => setShowForm(true)}
                        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700"
                      >
                        Create your first PO
                      </button>
                    </div>
                  </div>
                ) : (
                  pagedPos.map((po) => (
                    <div key={po.id} className="p-4 hover:bg-slate-50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-mono text-sm font-semibold text-slate-900">{po.po_number}</div>
                          <div className="text-xs text-slate-600 mt-0.5">{po.vendor_name}</div>
                        </div>
                        <span
                          className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                            po.status === "RECEIVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : po.status === "SHIPPED"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {statusLabel(po.status)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div>
                          <span className="text-slate-500">Created:</span>{" "}
                          <span className="text-slate-700">{formatDate(po.order_date)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500">Total:</span>{" "}
                          <span className="font-semibold text-slate-900">${money(computedTotal(po))}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-slate-200">
                        <button
                          onClick={() => window.location.href = `/admin/purchasing/${po.id}`}
                          className="flex-1 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                        >
                          View
                        </button>
                        {po.status === "TO_BE_PAID" && (
                          <button
                            onClick={() => updatePoStatus(po.id, "SHIPPED")}
                            className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                          >
                            Mark Shipped
                          </button>
                        )}
                        {po.status === "SHIPPED" && (
                          <button
                            onClick={() => updatePoStatus(po.id, "RECEIVED")}
                            className="px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100"
                          >
                            Mark Received
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {!loading && sortedFilteredPos.length > 0 && (
                <div className="flex items-center justify-between border-t border-slate-200 px-4 md:px-6 py-3 text-sm text-slate-600">
                  <div className="text-xs md:text-sm">
                    Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sortedFilteredPos.length)} of {sortedFilteredPos.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={safePage === 1}
                      className="rounded border border-slate-300 px-2 md:px-3 py-1 text-xs md:text-sm font-semibold text-slate-600 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span className="text-xs text-slate-500">Page {safePage} of {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={safePage === totalPages}
                      className="rounded border border-slate-300 px-2 md:px-3 py-1 text-xs md:text-sm font-semibold text-slate-600 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selectedPO && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4">
                  <h2 className="text-xl font-semibold text-slate-900">Add Payment</h2>
                  <p className="text-sm text-slate-600">
                    PO: {selectedPO.po_number} | Total: ${money(computedTotal(selectedPO))} | Balance: ${money(balance(selectedPO))}
                  </p>
                  
                  {/* Existing Payments */}
                  {selectedPO.payments && selectedPO.payments.length > 0 && (
                    <div className="border-t border-slate-200 pt-4">
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">Payment History</h3>
                      <div className="space-y-2">
                        {selectedPO.payments.map((payment: any) => (
                          <div key={payment.id} className="flex justify-between items-start text-xs bg-slate-50 rounded p-2">
                            <div>
                              <div className="font-medium text-slate-900">
                                ${money(payment.amount)} - {payment.payment_method || 'N/A'}
                              </div>
                              <div className="text-slate-600">
                                {new Date(payment.payment_date).toLocaleDateString()}
                                {payment.reference_number && ` • Ref: ${payment.reference_number}`}
                              </div>
                              {payment.notes && (
                                <div className="text-slate-500 mt-1">{payment.notes}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => startEditingPayment(payment)}
                                className="text-blue-600 hover:text-blue-700 font-semibold"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePayment(selectedPO.id, payment.id)}
                                className="text-red-600 hover:text-red-700 font-semibold"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-xs font-semibold text-slate-700">
                        Total Paid: ${money(selectedPO.payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0))}
                      </div>
                    </div>
                  )}
                  
                  {/* Payment Form */}
                  <div className="border-t border-slate-200 pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">{editingPaymentId ? "Edit Payment" : "New Payment"}</h3>
                      {editingPaymentId && (
                        <button
                          type="button"
                          onClick={resetPaymentForm}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-800"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>
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
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Amount</label>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setPaymentForm({ ...paymentForm, amount: Number((computedTotal(selectedPO) * 0.3).toFixed(2)) })}
                        className="flex-1 rounded-lg border-2 border-blue-500 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        30% Down
                        <div className="text-[10px] font-normal text-blue-600">${money(computedTotal(selectedPO) * 0.3)}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentForm({ ...paymentForm, amount: Number((computedTotal(selectedPO) * 0.7).toFixed(2)) })}
                        className="flex-1 rounded-lg border-2 border-green-500 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors"
                      >
                        70% Final
                        <div className="text-[10px] font-normal text-green-600">${money(computedTotal(selectedPO) * 0.7)}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentForm({ ...paymentForm, amount: 0 })}
                        className="flex-1 rounded-lg border-2 border-slate-400 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        Custom
                        <div className="text-[10px] font-normal text-slate-600">Enter amount</div>
                      </button>
                    </div>
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
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        resetPaymentForm();
                        setSelectedPO(null);
                      }}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSavePayment(selectedPO.id)}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      {editingPaymentId ? "Save Payment" : "Add Payment"}
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
