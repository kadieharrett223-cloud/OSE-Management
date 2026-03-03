"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChinesePOFiles } from "@/components/ChinesePOFiles";

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
  updated_at?: string;
  lines: Array<{
    id: string;
    sku?: string;
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    weight_lbs?: number;
  }>;
  payments?: Array<{
    id: string;
    payment_date: string;
    amount: number;
    payment_method?: string;
    reference_number?: string;
    notes?: string;
  }>;
}

interface POChangeLogEntry {
  id: string;
  created_at: string;
  changed_by?: string;
  event_type?: string;
  notes?: string;
  changes: Array<{
    field: string;
    oldValue: string;
    newValue: string;
  }>;
}

export default function ViewPO() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to_email: "",
    recipient_name: "",
    subject: "",
    message: "",
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [poNotes, setPoNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPO, setDeletingPO] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPO, setEditingPO] = useState(false);
  const [editForm, setEditForm] = useState({
    po_number: "",
    vendor_name: "",
    vendor_contact_name: "",
    vendor_email: "",
    vendor_phone: "",
    terms: "",
    expected_delivery: "",
  });
  const [showLineItemModal, setShowLineItemModal] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<any>(null);
  const [lineItemForm, setLineItemForm] = useState({
    sku: "",
    description: "",
    quantity: 0,
    unit_price: 0,
    weight_lbs: 0,
  });
  const [savingLineItem, setSavingLineItem] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [priceList, setPriceList] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [draggedLineId, setDraggedLineId] = useState<string | null>(null);
  const [editingLineItems, setEditingLineItems] = useState(false);
  const [tempLines, setTempLines] = useState<any[]>([]);
  const [draggedLineIndex, setDraggedLineIndex] = useState<number | null>(null);
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
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [changeReport, setChangeReport] = useState<any>(null);
  const [notificationNotes, setNotificationNotes] = useState("");
  const [oldPOData, setOldPOData] = useState<any>(null);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [changeLogs, setChangeLogs] = useState<POChangeLogEntry[]>([]);
  const [loadingChangeLogs, setLoadingChangeLogs] = useState(false);

  const loadChangeLogs = async (poId: string) => {
    setLoadingChangeLogs(true);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/change-log`);
      const result = await res.json();
      console.log(`[PO View] Change logs response:`, result);
      if (result.ok) {
        setChangeLogs(Array.isArray(result.data) ? result.data : []);
        console.log(`[PO View] Loaded ${result.data?.length || 0} change entries`);
      } else {
        console.error(`[PO View] API returned error:`, result.error);
      }
    } catch (error) {
      console.error("Failed to load PO change log:", error);
    } finally {
      setLoadingChangeLogs(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetch(`/api/purchase-orders/${id}`)
        .then((res) => res.json())
        .then((result) => {
          if (result.ok) {
            setPO(result.data);
            setPoNotes(result.data.notes || "");
            setEditForm({
              po_number: result.data.po_number || "",
              vendor_name: result.data.vendor_name || "",
              vendor_contact_name: result.data.vendor_contact_name || "",
              vendor_email: result.data.vendor_email || "",
              vendor_phone: result.data.vendor_phone || "",
              terms: result.data.terms || "",
              expected_delivery: result.data.expected_delivery || "",
            });
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadChangeLogs(id);
    }
  }, [id]);

  useEffect(() => {
    if (po?.id && po?.updated_at) {
      loadChangeLogs(po.id);
    }
  }, [po?.id, po?.updated_at]);

  // Load price list for autocomplete
  useEffect(() => {
    fetch("/api/price-list?_=" + Date.now(), {
      cache: "no-store"
    })
      .then((res) => res.json())
      .then((data) => {
        // API returns array directly, or wrapped in object
        const items = Array.isArray(data) ? data : (data.data || []);
        console.log("Loaded price list items:", items.length);
        setPriceList(items);
      })
      .catch((err) => console.error("Failed to load price list:", err));
  }, []);

  useEffect(() => {
    fetch("/api/price-list/categories")
      .then((res) => res.json())
      .then((data) => {
        const items = Array.isArray(data?.items) ? data.items : [];
        setCategories(items);
      })
      .catch((err) => console.error("Failed to load categories:", err));
  }, []);

  const handleSendEmail = async () => {
    if (!emailForm.to_email) {
      alert("Please enter a recipient email");
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch("/api/purchase-orders/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_email: emailForm.to_email,
          recipient_name: emailForm.recipient_name,
          po_number: po?.po_number,
          subject: emailForm.subject || `Purchase Order #${po?.po_number}`,
          message: emailForm.message || `Please find the PO #${po?.po_number} attached.`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to send email");
        return;
      }

      alert(`Email sent to ${emailForm.recipient_name || emailForm.to_email}!`);
      setShowEmailModal(false);
      setEmailForm({ to_email: "", recipient_name: "", subject: "", message: "" });
    } catch (error) {
      console.error("Email send error:", error);
      alert("Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDeletePO = async () => {
    if (!po?.id) return;
    
    setDeletingPO(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete PO");
        return;
      }

      alert("Purchase order deleted successfully");
      router.push("/admin/purchasing");
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete purchase order");
    } finally {
      setDeletingPO(false);
      setShowDeleteModal(false);
    }
  };

  const handleEditPO = async () => {
    if (!po?.id) return;
    
    setEditingPO(true);
    try {
      // Save old PO data for comparison
      setOldPOData(JSON.parse(JSON.stringify(po)));
      
      // Convert empty date strings to null for database compatibility
      const formData = {
        ...editForm,
        expected_delivery: editForm.expected_delivery || null,
      };

      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update PO");
        return;
      }

      const result = await res.json();
      setPO(result.data);
      alert("Purchase order updated successfully");
      setShowEditModal(false);
      
      // Show notification modal after successful update
      setShowNotifyModal(true);
      setNotificationNotes("");
    } catch (error) {
      console.error("Edit error:", error);
      alert("Failed to update purchase order");
    } finally {
      setEditingPO(false);
    }
  };

  const handleNotifyInventoryTeam = async () => {
    if (!po?.id || !oldPOData) return;

    setSendingNotification(true);
    try {
      const res = await fetch("/api/purchase-orders/notify-changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_id: po.id,
          old_po: oldPOData,
          new_po: po,
          notes: notificationNotes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to send notification");
        return;
      }

      const result = await res.json();
      setChangeReport(result.report);
      if (result?.emailStatus && result.emailStatus.sent !== true) {
        const errorText = result.emailStatus.error || "Email was not sent.";
        alert(`Notification created, but email failed: ${errorText}`);
      } else {
        alert("Inventory team has been notified of the changes!");
      }
      setShowNotifyModal(false);
      setNotificationNotes("");
      setOldPOData(null);
    } catch (error) {
      console.error("Notification error:", error);
      alert("Failed to notify inventory team");
    } finally {
      setSendingNotification(false);
    }
  };

  const openLineItemModal = (line?: any) => {
    if (line) {
      setEditingLineItem(line);
      setLineItemForm({
        sku: line.sku || "",
        description: line.description || "",
        quantity: line.quantity || 0,
        unit_price: line.unit_price || 0,
        weight_lbs: line.weight_lbs || 0,
      });
    } else {
      setEditingLineItem(null);
      setLineItemForm({
        sku: "",
        description: "",
        quantity: 0,
        unit_price: 0,
        weight_lbs: 0,
      });
    }
    setShowLineItemModal(true);
  };

  const handleSearchProducts = async (searchTerm: string) => {
    console.log("Searching for:", searchTerm);
    if (searchTerm.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    setShowSearchResults(true);
    try {
      const url = `/api/price-list/search?q=${encodeURIComponent(searchTerm)}`;
      console.log("Fetching from:", url);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      
      const data = await res.json();
      console.log("Search results:", data);
      setSearchResults(data.results || []);
    } catch (error) {
      console.error("Error searching products:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectProduct = (product: any) => {
    const isNote = (product.item_no || "").toLowerCase() === "note";
    setLineItemForm({
      sku: product.item_no || "",
      description: product.description || "",
      quantity: isNote ? 0 : (lineItemForm.quantity || 1),
      unit_price: isNote ? 0 : (product.fob_port_cost || product.cost_with_shipping || 0),
      weight_lbs: lineItemForm.weight_lbs || 0,
    });
    setShowSearchResults(false);
    setSearchResults([]);
  };

  const handleSaveLineItem = async () => {
    const isNote = (lineItemForm.sku || "").toLowerCase() === "note";
    
    // Validate: description is always required, but price/qty only required for non-note items
    if (!po?.id || !lineItemForm.description) {
      alert("Please fill in description");
      return;
    }
    
    if (!isNote && (lineItemForm.quantity <= 0 || lineItemForm.unit_price < 0)) {
      alert("Please fill in Quantity and Unit Price (required for product items)");
      return;
    }

    setSavingLineItem(true);
    try {
      const lineTotal = lineItemForm.quantity * lineItemForm.unit_price;
      const updatedLines = po.lines ? [...po.lines] : [];

      if (editingLineItem) {
        // Edit existing line item
        const index = updatedLines.findIndex(l => l.id === editingLineItem.id);
        if (index >= 0) {
          updatedLines[index] = {
            ...editingLineItem,
            ...lineItemForm,
            line_total: lineTotal,
          };
        }
      } else {
        // Add new line item
        updatedLines.push({
          id: `new_${Date.now()}`,
          ...lineItemForm,
          line_total: lineTotal,
        });
      }

      // Calculate new total
      const newTotal = updatedLines.reduce((sum, line) => sum + line.line_total, 0);

      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: updatedLines,
          total_amount: newTotal,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to save line item");
        return;
      }

      const result = await res.json();
      setPO(result.data);
      setShowLineItemModal(false);
      alert("Line item saved successfully");
    } catch (error) {
      console.error("Error saving line item:", error);
      alert("Failed to save line item");
    } finally {
      setSavingLineItem(false);
    }
  };

  const handleSaveAllLineItems = async () => {
    if (!po?.id) return;
    setSavingLineItem(true);
    try {
      const updatedLines = po.lines ? [...po.lines] : [];
      const newTotal = updatedLines.reduce((sum, line) => sum + (line.line_total || 0), 0);

      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: updatedLines,
          total_amount: newTotal,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to save line items");
        return;
      }

      const result = await res.json();
      setPO(result.data);
      alert("Line items saved successfully");
    } catch (error) {
      console.error("Error saving line items:", error);
      alert("Failed to save line items");
    } finally {
      setSavingLineItem(false);
    }
  };

  const handleDeleteLineItem = async (lineId: string) => {
    if (!po?.id || !confirm("Are you sure you want to delete this line item?")) return;

    try {
      const updatedLines = po.lines.filter(l => l.id !== lineId);
      const newTotal = updatedLines.reduce((sum, line) => sum + line.line_total, 0);

      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: updatedLines,
          total_amount: newTotal,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete line item");
      }

      const result = await res.json();
      setPO(result.data);
      alert("Line item deleted successfully");
    } catch (error) {
      console.error("Error deleting line item:", error);
      alert(`Failed to delete line item: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleReorderLineItems = async (fromId: string, toId: string) => {
    if (!po?.id || fromId === toId) return;

    try {
      const updatedLines = [...po.lines];
      const fromIndex = updatedLines.findIndex(l => l.id === fromId);
      const toIndex = updatedLines.findIndex(l => l.id === toId);

      if (fromIndex < 0 || toIndex < 0) return;

      const [removed] = updatedLines.splice(fromIndex, 1);
      updatedLines.splice(toIndex, 0, removed);

      const newTotal = updatedLines.reduce((sum, line) => sum + line.line_total, 0);

      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: updatedLines,
          total_amount: newTotal,
        }),
      });

      if (!res.ok) throw new Error("Failed to reorder line items");

      const result = await res.json();
      setPO(result.data);
      setDraggedLineId(null);
    } catch (error) {
      console.error("Error reordering line items:", error);
      setDraggedLineId(null);
    }
  };

  const startInlineEditingLineItems = () => {
    setTempLines(JSON.parse(JSON.stringify(po?.lines || [])));
    setEditingLineItems(true);
  };

  const cancelInlineEditingLineItems = () => {
    setEditingLineItems(false);
    setTempLines([]);
    setDraggedLineIndex(null);
  };

  const updateTempLine = (index: number, field: string, value: any) => {
    const updated = [...tempLines];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].line_total = (updated[index].quantity || 0) * (updated[index].unit_price || 0);
    }
    setTempLines(updated);
  };

  const removeTempLine = (index: number) => {
    setTempLines(tempLines.filter((_, i) => i !== index));
  };

  const reorderTempLine = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const updated = [...tempLines];
    const [removed] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, removed);
    setTempLines(updated);
  };

  const saveTempLineItems = async () => {
    if (!po?.id) return;
    setSavingLineItem(true);
    try {
      // Save old PO data for comparison
      setOldPOData(JSON.parse(JSON.stringify(po)));
      
      const newTotal = tempLines.reduce((sum, line) => sum + (line.line_total || 0), 0);
      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: tempLines,
          total_amount: newTotal,
        }),
      });

      if (!res.ok) throw new Error("Failed to save line items");

      const result = await res.json();
      setPO(result.data);
      setEditingLineItems(false);
      setTempLines([]);
      alert("Line items saved successfully");
      
      // Show notification modal after successful update
      setShowNotifyModal(true);
      setNotificationNotes("");
    } catch (error) {
      console.error("Error saving line items:", error);
      alert("Failed to save line items");
    } finally {
      setSavingLineItem(false);
    }
  };

  const containerMaxLbs = 44000;
  const totalWeightLbs = (po?.lines || []).reduce((sum, line) => {
    const weightEach = Number(line.weight_lbs) || 0;
    const qty = Number(line.quantity) || 0;
    return sum + weightEach * qty;
  }, 0);
  const remainingWeightLbs = Math.max(containerMaxLbs - totalWeightLbs, 0);

  const money = (num: number) => num.toFixed(2);
  const formatLogDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString();
  };

  // Calculate payment totals - only when po is not null
  const totalPaid = po ? (po.payments || []).reduce((sum, p) => sum + Number(p.amount), 0) : 0;
  const balanceDue = po ? po.total_amount - totalPaid : 0;

  const skuExists = Boolean(
    lineItemForm.sku && priceList.some((item) => (item.sku || item.item_no)?.toLowerCase() === lineItemForm.sku.toLowerCase())
  );

  const handlePrint = () => {
    if (!po) return;
    const originalTitle = document.title;
    const supplierName = po.vendor_name || "Purchase Order";
    const poNumber = po.po_number || "";
    document.title = `${supplierName} PO# ${poNumber}`;
    
    setTimeout(() => {
      window.print();
      document.title = originalTitle;
    }, 100);
  };

  const openCreateProductModal = () => {
    setNewProductForm((prev) => ({
      ...prev,
      item_no: lineItemForm.sku || prev.item_no,
      description: lineItemForm.description || prev.description,
      fob_cost: lineItemForm.unit_price || prev.fob_cost,
      weight_lbs: lineItemForm.weight_lbs || prev.weight_lbs,
    }));
    setShowCreateProductModal(true);
  };

  const handleCreateProduct = async () => {
    const itemNo = newProductForm.item_no.trim();
    const description = newProductForm.description.trim();

    if (!itemNo || !description) {
      alert("SKU and description are required.");
      return;
    }

    if (priceList.some((item) => (item.sku || item.item_no)?.toLowerCase() === itemNo.toLowerCase())) {
      alert("That SKU already exists in the price list.");
      return;
    }

    setCreatingProduct(true);
    try {
      const res = await fetch("/api/price-list/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newProductForm,
          item_no: itemNo,
          description,
          category_id: newProductForm.category_id || null,
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
        setLineItemForm((prev) => ({
          ...prev,
          sku: newItem.sku || itemNo,
          description: newItem.description || description,
          unit_price: Number(newItem.fob_cost ?? prev.unit_price),
        }));
      }

      setShowCreateProductModal(false);
    } catch (error) {
      console.error("Create product error:", error);
      alert("Failed to create product");
    } finally {
      setCreatingProduct(false);
    }
  };

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
        {/* Print/Back/Email Buttons */}
        <div className="flex justify-between mb-4 print:hidden gap-2">
          <button
            onClick={() => router.back()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Back
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setEditingNotes(!editingNotes)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {editingNotes ? "Done Editing" : "Add Notes"}
            </button>
            <button
              onClick={() => setShowEmailModal(true)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Send Email
            </button>
            <button
              onClick={handlePrint}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Print
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Edit
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-4">
          <aside className="print:hidden rounded-lg border border-slate-200 bg-slate-50 p-3 h-fit lg:sticky lg:top-4">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Note Log</h3>
            {loadingChangeLogs ? (
              <p className="text-xs text-slate-500">Loading...</p>
            ) : changeLogs.length === 0 ? (
              <p className="text-xs text-slate-500">No changes logged yet.</p>
            ) : (
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {changeLogs.map((entry) => (
                  <div key={entry.id} className="rounded border border-slate-200 bg-white p-2">
                    <p className="text-[11px] font-semibold text-slate-700">{formatLogDate(entry.created_at)}</p>
                    <p className="text-[11px] text-slate-500 mb-1">{entry.changed_by || "Unknown"}</p>
                    <div className="space-y-1">
                      {entry.changes?.map((change, index) => (
                        <p key={`${entry.id}-${index}`} className="text-[11px] text-slate-700 leading-tight">
                          <span className="font-semibold">{change.field}:</span> {change.oldValue} → {change.newValue}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <div>

        {/* Notes Section */}
        {editingNotes && (
          <div className="mb-4 print:hidden rounded-lg border border-amber-200 bg-amber-50 p-4">
            <label className="block text-sm font-semibold text-amber-900 mb-2">PO Notes</label>
            <textarea
              value={poNotes}
              onChange={(e) => setPoNotes(e.target.value)}
              placeholder="Add internal notes about this purchase order..."
              className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              rows={4}
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  // Save notes via API
                  if (po?.id) {
                    fetch(`/api/purchase-orders/${po.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ notes: poNotes }),
                    })
                      .then((res) => res.json())
                      .then((result) => {
                        if (result?.ok) {
                          setPO(result.data);
                          loadChangeLogs(po.id);
                        }
                        alert("Notes saved!");
                        setEditingNotes(false);
                      });
                  }
                }}
                className="rounded-lg bg-amber-600 px-3 py-1 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Save Notes
              </button>
              <button
                onClick={() => setEditingNotes(false)}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-sm font-semibold text-amber-900 hover:bg-amber-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {!editingNotes && poNotes && (
          <div className="mb-4 print:hidden rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900 mb-1">Notes:</p>
            <p className="text-sm text-amber-800">{poNotes}</p>
          </div>
        )}

        {/* Chinese PO Files Section */}
        <div className="mb-4 print:hidden">
          <ChinesePOFiles 
            poId={id}
            poNumber={po?.po_number || ""}
          />
        </div>

        {/* PO Document */}
        <div className="border border-gray-300 bg-white p-4 print:text-[10px] print:[&_td]:text-[10px] print:[&_th]:text-[9px] print:[&_p]:text-[10px] print:[&_span]:text-[10px]">
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
                <td className="px-2 py-1.5 font-bold uppercase text-[8px] tracking-wide">Terms</td>
              </tr>
              <tr>
                <td className="border-r border-gray-300 px-2 py-2">{po.po_number}</td>
                <td className="border-r border-gray-300 px-2 py-2">{po.authorized_by || "—"}</td>
                <td className="border-r border-gray-300 px-2 py-2">{po.order_date}</td>
                <td className="border-r border-gray-300 px-2 py-2">{po.vendor_contact_name || "—"}</td>
                <td className="px-2 py-2">{po.terms || "—"}</td>
              </tr>
            </tbody>
          </table>

          {/* Line Items Table */}
          <div className="mb-2 flex flex-col sm:flex-row items-center gap-2 print:hidden">
            {!editingLineItems ? (
              <>
                <button
                  onClick={() => openLineItemModal()}
                  className="w-full sm:w-auto rounded-lg bg-green-600 px-3 py-2 sm:py-1.5 text-sm sm:text-xs font-semibold text-white hover:bg-green-700"
                >
                  + Add Line Item
                </button>
                <button
                  onClick={handleSaveAllLineItems}
                  disabled={savingLineItem}
                  className="w-full sm:w-auto rounded-lg bg-blue-600 px-3 py-2 sm:py-1.5 text-sm sm:text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingLineItem ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={startInlineEditingLineItems}
                  className="w-full sm:w-auto rounded-lg bg-purple-600 px-3 py-2 sm:py-1.5 text-sm sm:text-xs font-semibold text-white hover:bg-purple-700"
                >
                  Edit Line Items
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={saveTempLineItems}
                  disabled={savingLineItem}
                  className="w-full sm:w-auto rounded-lg bg-emerald-600 px-3 py-2 sm:py-1.5 text-sm sm:text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingLineItem ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={cancelInlineEditingLineItems}
                  disabled={savingLineItem}
                  className="w-full sm:w-auto rounded-lg bg-slate-400 px-3 py-2 sm:py-1.5 text-sm sm:text-xs font-semibold text-white hover:bg-slate-500 disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
          <div className="mb-2">
            {!editingLineItems ? (
              /* NORMAL TABLE VIEW */
              <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-400 text-[9px] sm:text-[10px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border-r border-gray-400 px-2 py-1.5 text-center text-[8px] font-bold text-slate-900 uppercase tracking-wider w-6">
                      ⋮
                    </th>
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
                    <tr
                      key={line.id}
                      draggable
                      onDragStart={() => setDraggedLineId(line.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggedLineId && draggedLineId !== line.id) {
                          handleReorderLineItems(draggedLineId, line.id);
                        }
                      }}
                      onDragEnd={() => setDraggedLineId(null)}
                      className={`border-b border-gray-300 cursor-move ${
                        draggedLineId === line.id ? 'bg-blue-100 opacity-70' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <td className="border-r border-gray-300 px-2 py-1.5 text-center text-slate-400 hover:text-slate-600 align-top select-none">
                        ⋮
                      </td>
                      <td className="border-r border-gray-300 px-2 py-1.5 text-center text-slate-700 align-top">
                        {index + 1}
                      </td>
                      <td className="border-r border-gray-300 px-2 py-1.5 text-slate-900 align-top font-medium">
                        {line.sku || "—"}
                      </td>
                      <td className="border-r border-gray-300 px-2 py-1.5 text-slate-800 align-top whitespace-pre-wrap leading-tight">
                        <div className="flex items-start justify-between gap-2">
                          <span>{line.description}</span>
                          <span className="shrink-0 space-x-1 print:hidden">
                            <button
                              onClick={() => openLineItemModal(line)}
                              className="text-blue-600 hover:text-blue-800 font-semibold text-[8px] px-1"
                              title="Edit"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => handleDeleteLineItem(line.id)}
                              className="text-red-600 hover:text-red-800 font-semibold text-[8px] px-1"
                              title="Delete"
                            >
                              ✕
                            </button>
                          </span>
                        </div>
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
                  {po.payments && po.payments.length > 0 && (
                    <>
                      <tr className="border-t border-gray-300">
                        <td colSpan={6} className="px-2 py-2 text-right text-xs font-bold text-emerald-700 uppercase tracking-wide">
                          Total Paid
                        </td>
                        <td className="px-2 py-2 text-right text-sm font-bold text-emerald-700">
                          ${money(totalPaid)}
                        </td>
                      </tr>
                      <tr className="border-t border-gray-300">
                        <td colSpan={6} className="px-2 py-2 text-right text-xs font-bold text-amber-700 uppercase tracking-wide">
                          Balance Due
                        </td>
                        <td className="px-2 py-2 text-right text-sm font-bold text-amber-700">
                          ${money(balanceDue)}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr className="border-t border-gray-300">
                    <td colSpan={6} className="px-2 py-2 text-right text-[10px] font-semibold text-slate-700 uppercase tracking-wide">
                      Container Weight Remaining
                    </td>
                    <td className="px-2 py-2 text-right text-[10px] font-semibold text-slate-900">
                      {remainingWeightLbs.toLocaleString()} lbs (of {containerMaxLbs.toLocaleString()} lbs)
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
            ) : (
              /* INLINE EDITING VIEW */
              <div className="border border-slate-300 rounded bg-white overflow-x-auto">
                <div className="grid grid-cols-12 gap-0 bg-slate-100 border-b border-slate-300">
                  <div className="col-span-1 px-3 py-2 text-xs font-semibold text-slate-700 text-center border-r border-slate-300">⋮</div>
                  <div className="col-span-2 px-3 py-2 text-xs font-semibold text-slate-700 border-r border-slate-300">SKU</div>
                  <div className="col-span-3 px-3 py-2 text-xs font-semibold text-slate-700 border-r border-slate-300">Description</div>
                  <div className="col-span-1 px-3 py-2 text-xs font-semibold text-slate-700 text-center border-r border-slate-300">QTY</div>
                  <div className="col-span-1 px-3 py-2 text-xs font-semibold text-slate-700 text-center border-r border-slate-300">Weight</div>
                  <div className="col-span-2 px-3 py-2 text-xs font-semibold text-slate-700 text-right border-r border-slate-300">Rate</div>
                  <div className="col-span-2 px-3 py-2 text-xs font-semibold text-slate-700 text-right">Amount</div>
                </div>
                {tempLines.map((line, index) => (
                  <div
                    key={line.id || index}
                    draggable
                    onDragStart={() => setDraggedLineIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedLineIndex !== null && draggedLineIndex !== index) {
                        reorderTempLine(draggedLineIndex, index);
                        setDraggedLineIndex(null);
                      }
                    }}
                    onDragEnd={() => setDraggedLineIndex(null)}
                    className={`grid grid-cols-12 gap-0 border-b border-slate-200 ${
                      draggedLineIndex === index ? 'bg-blue-100 opacity-70' : 'hover:bg-slate-50'
                    } cursor-move`}
                  >
                    <div className="col-span-1 border-r border-slate-200 p-2 flex items-center justify-center text-slate-400 hover:text-slate-600">⋮</div>
                    <div className="col-span-2 border-r border-slate-200 p-2">
                      <input
                        type="text"
                        placeholder="SKU"
                        value={line.sku || ""}
                        onChange={(e) => updateTempLine(index, "sku", e.target.value)}
                        className="w-full border-0 px-2 py-1 text-sm text-slate-900 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-3 border-r border-slate-200 p-2">
                      <textarea
                        placeholder="Description"
                        value={line.description || ""}
                        onChange={(e) => updateTempLine(index, "description", e.target.value)}
                        className="w-full border-0 px-2 py-1 text-sm text-slate-900 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
                        rows={2}
                      />
                    </div>
                    <div className="col-span-1 border-r border-slate-200 p-2">
                      <input
                        type="number"
                        step="1"
                        value={line.quantity || ""}
                        onChange={(e) => updateTempLine(index, "quantity", Number(e.target.value) || 0)}
                        className="w-full border-0 px-2 py-1 text-sm text-slate-900 bg-white text-center focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-1 border-r border-slate-200 p-2">
                      <input
                        type="number"
                        step="1"
                        value={line.weight_lbs || ""}
                        onChange={(e) => updateTempLine(index, "weight_lbs", Number(e.target.value) || 0)}
                        placeholder="lbs"
                        className="w-full border-0 px-2 py-1 text-sm text-slate-900 bg-white text-center focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2 border-r border-slate-200 p-2">
                      <input
                        type="number"
                        step="0.01"
                        value={line.unit_price || ""}
                        onChange={(e) => updateTempLine(index, "unit_price", Number(e.target.value) || 0)}
                        className="w-full border-0 px-2 py-1 text-sm text-slate-900 bg-white text-right focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2 p-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">
                        ${((line.quantity || 0) * (line.unit_price || 0)).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeTempLine(index)}
                        className="ml-2 text-red-600 hover:text-red-700 hover:bg-red-50 font-bold text-xl px-2 py-0 rounded"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-12 gap-0 bg-slate-50 border-t-2 border-slate-300">
                  <div className="col-span-10 px-3 py-3 text-right text-sm font-bold text-slate-700">Total Weight:</div>
                  <div className="col-span-2 px-3 py-3 text-right text-sm font-bold text-slate-900">
                    {(tempLines.reduce((sum, line) => sum + ((line.quantity || 0) * (line.weight_lbs || 0)), 0) || 0).toLocaleString()} lbs
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-0 bg-slate-50">
                  <div className="col-span-10 px-3 py-3 text-right text-sm font-bold text-slate-700">Total Amount:</div>
                  <div className="col-span-2 px-3 py-3 text-right text-sm font-bold text-slate-900">
                    ${tempLines.reduce((sum, line) => sum + ((line.quantity || 0) * (line.unit_price || 0)), 0).toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment History Section */}
          {po.payments && po.payments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-300">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Payment History</h3>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300">
                    <th className="px-2 py-1.5 text-left font-bold text-slate-900">Date</th>
                    <th className="px-2 py-1.5 text-left font-bold text-slate-900">Method</th>
                    <th className="px-2 py-1.5 text-left font-bold text-slate-900">Reference</th>
                    <th className="px-2 py-1.5 text-right font-bold text-slate-900">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {po.payments.map((payment, index) => (
                    <tr key={payment.id} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-2 py-1.5 text-slate-900">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-1.5 text-slate-900">
                        {payment.payment_method || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-slate-900">
                        {payment.reference_number || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold text-slate-900">
                        ${money(payment.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-400 bg-gray-100">
                    <td colSpan={3} className="px-2 py-1.5 text-right font-bold text-slate-900">
                      Total Paid:
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold text-slate-900">
                      ${money(totalPaid)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

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
                <li>Customer Service: Shandra Colville phone: 866-774-4531 ext 2. email customerservice@olympic-equipment.com.</li>
                <li>Bookeeping: Emma Nagel: phone 866-774-4531 ext 13. Email: bookkeeping@olympic-equipment.com</li>
              </ul>
            </section>
          </div>
        </div>
      </div>

          </div>
        </div>

      <style>{`
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

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Send PO via Email</h2>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Recipient Name</label>
              <input
                type="text"
                value={emailForm.recipient_name}
                onChange={(e) => setEmailForm({ ...emailForm, recipient_name: e.target.value })}
                placeholder="e.g., John Smith"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                value={emailForm.to_email}
                onChange={(e) => setEmailForm({ ...emailForm, to_email: e.target.value })}
                placeholder="john@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email Subject</label>
              <input
                type="text"
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                placeholder={`Purchase Order #${po?.po_number}`}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Message</label>
              <textarea
                value={emailForm.message}
                onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                placeholder="Add a personal message to the supplier..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                rows={4}
              />
            </div>

            <div className="border-t border-slate-200 pt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailForm({ to_email: "", recipient_name: "", subject: "", message: "" });
                }}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {sendingEmail ? "Sending..." : `Send to ${emailForm.recipient_name || emailForm.to_email || "Supplier"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-4 sm:p-6 shadow-lg">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Delete Purchase Order?</h2>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete PO #{po?.po_number}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingPO}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePO}
                disabled={deletingPO}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingPO ? "Deleting..." : "Delete PO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit PO Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="w-full max-w-sm sm:max-w-md rounded-lg bg-white p-4 sm:p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Edit Purchase Order</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">PO Number</label>
                <input
                  type="text"
                  value={editForm.po_number}
                  onChange={(e) => setEditForm({ ...editForm, po_number: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Vendor Name</label>
                <input
                  type="text"
                  value={editForm.vendor_name}
                  onChange={(e) => setEditForm({ ...editForm, vendor_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={editForm.vendor_contact_name}
                  onChange={(e) => setEditForm({ ...editForm, vendor_contact_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.vendor_email}
                  onChange={(e) => setEditForm({ ...editForm, vendor_email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editForm.vendor_phone}
                  onChange={(e) => setEditForm({ ...editForm, vendor_phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Terms</label>
                <input
                  type="text"
                  value={editForm.terms}
                  onChange={(e) => setEditForm({ ...editForm, terms: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Expected Delivery</label>
                <input
                  type="date"
                  value={editForm.expected_delivery}
                  onChange={(e) => setEditForm({ ...editForm, expected_delivery: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                disabled={editingPO}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditPO}
                disabled={editingPO}
                className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {editingPO ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Line Item Modal */}
      {showLineItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="w-full max-w-sm sm:max-w-2xl rounded-lg bg-white p-4 sm:p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {editingLineItem ? "Edit Line Item" : "Add Line Item"}
            </h2>
            <div className="border border-slate-300 rounded overflow-hidden">
              <div className="grid grid-cols-12 gap-0 bg-slate-100 border-b border-slate-300">
                <div className="col-span-3 px-3 py-2 text-xs font-semibold text-slate-700 border-r border-slate-300">Part Number</div>
                <div className="col-span-4 px-3 py-2 text-xs font-semibold text-slate-700 border-r border-slate-300">Description</div>
                <div className="col-span-2 px-3 py-2 text-xs font-semibold text-slate-700 text-center border-r border-slate-300">QTY</div>
                <div className="col-span-2 px-3 py-2 text-xs font-semibold text-slate-700 text-right border-r border-slate-300">Unit Price</div>
                <div className="col-span-1 px-3 py-2 text-xs font-semibold text-slate-700 text-right">Amount</div>
              </div>
              <div className="grid grid-cols-12 gap-0 border-b border-slate-200 bg-slate-50 p-0">
                <div className="col-span-3 border-r border-slate-200 p-2">
                  <input
                    type="text"
                    list="sku-list-edit"
                    placeholder="Enter or search SKU"
                    value={lineItemForm.sku}
                    onChange={(e) => {
                      const sku = e.target.value;
                      setLineItemForm({ ...lineItemForm, sku });
                      // Auto-fill from price list ONLY when exact match found
                      const found = priceList.find(item => (item.sku || item.item_no)?.toLowerCase() === sku.toLowerCase());
                      if (found) {
                        const isNote = (found.item_no || "").toLowerCase() === "note";
                        setLineItemForm(prev => ({
                          ...prev,
                          sku: found.sku || found.item_no || "",
                          description: found.description || "",
                          unit_price: isNote ? 0 : (found.fob_cost || found.cost_with_shipping || 0),
                          quantity: isNote ? 0 : prev.quantity,
                        }));
                      }
                    }}
                    className="w-full border border-slate-300 px-2 py-1 text-sm text-slate-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    autoFocus
                    required
                  />
                  <datalist id="sku-list-edit">
                    {priceList.map((item) => (
                      <option key={item.id} value={item.sku || item.item_no || ""}>{item.description}</option>
                    ))}
                  </datalist>
                  {!priceList.find(item => (item.sku || item.item_no || "").toLowerCase() === lineItemForm.sku.toLowerCase()) && lineItemForm.sku && (
                    <button
                      type="button"
                      onClick={openCreateProductModal}
                      className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      + Create new product
                    </button>
                  )}
                </div>
                <div className="col-span-4 border-r border-slate-200 p-2">
                  <input
                    type="text"
                    placeholder="Description"
                    value={lineItemForm.description}
                    onChange={(e) => setLineItemForm({ ...lineItemForm, description: e.target.value })}
                    className="w-full border border-slate-300 px-2 py-1 text-sm text-slate-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div className="col-span-2 border-r border-slate-200 p-2">
                  <input
                    type="number"
                    step="1"
                    value={lineItemForm.quantity}
                    onChange={(e) => setLineItemForm({ ...lineItemForm, quantity: Number(e.target.value) })}
                    className="w-full border border-slate-300 px-2 py-1 text-sm text-center text-slate-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div className="col-span-2 border-r border-slate-200 p-2">
                  <input
                    type="number"
                    step="0.01"
                    value={lineItemForm.unit_price}
                    onChange={(e) => setLineItemForm({ ...lineItemForm, unit_price: Number(e.target.value) })}
                    className="w-full border border-slate-300 px-2 py-1 text-sm text-right text-slate-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div className="col-span-1 p-2 text-right">
                  <span className="text-sm font-semibold text-slate-900">
                    ${(lineItemForm.quantity * lineItemForm.unit_price).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowLineItemModal(false)}
                disabled={savingLineItem}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLineItem}
                disabled={savingLineItem || !lineItemForm.description}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {savingLineItem ? "Saving..." : "Save Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="w-full max-w-sm sm:max-w-xl rounded-lg bg-white p-4 sm:p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Create New Product</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
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
                  <option value="">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.category_name}</option>
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
                <label className="block text-sm font-semibold text-slate-700 mb-1">Quantity (container qty)</label>
                <input
                  type="number"
                  step="1"
                  value={newProductForm.quantity}
                  onChange={(e) => setNewProductForm({ ...newProductForm, quantity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Weight (lbs)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProductForm.weight_lbs}
                  onChange={(e) => setNewProductForm({ ...newProductForm, weight_lbs: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Ocean Freight</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProductForm.ocean_frt}
                  onChange={(e) => setNewProductForm({ ...newProductForm, ocean_frt: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Importing</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProductForm.importing}
                  onChange={(e) => setNewProductForm({ ...newProductForm, importing: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Zone 5 Shipping</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProductForm.zone5_shipping}
                  onChange={(e) => setNewProductForm({ ...newProductForm, zone5_shipping: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Multiplier</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProductForm.multiplier}
                  onChange={(e) => setNewProductForm({ ...newProductForm, multiplier: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
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

      {/* Notify Inventory Team Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="w-full max-w-md sm:max-w-lg rounded-lg bg-white p-4 sm:p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Let Inventory Team Know?</h2>
            <p className="text-slate-600 mb-4">
              Would you like to notify the inventory team of the changes made to this PO?
            </p>

            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 mb-4 max-h-64 overflow-y-auto">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Changes Made:</h3>
              {oldPOData && po ? (
                <div className="space-y-2 text-sm">
                  {po.po_number !== oldPOData.po_number && (
                    <div className="border-b border-slate-300 pb-2">
                      <p className="font-medium text-slate-700">PO Number</p>
                      <p className="text-slate-600">{oldPOData.po_number} → {po.po_number}</p>
                    </div>
                  )}
                  {po.vendor_name !== oldPOData.vendor_name && (
                    <div className="border-b border-slate-300 pb-2">
                      <p className="font-medium text-slate-700">Vendor Name</p>
                      <p className="text-slate-600">{oldPOData.vendor_name} → {po.vendor_name}</p>
                    </div>
                  )}
                  {po.vendor_contact_name !== oldPOData.vendor_contact_name && (
                    <div className="border-b border-slate-300 pb-2">
                      <p className="font-medium text-slate-700">Contact Name</p>
                      <p className="text-slate-600">{oldPOData.vendor_contact_name} → {po.vendor_contact_name}</p>
                    </div>
                  )}
                  {po.vendor_email !== oldPOData.vendor_email && (
                    <div className="border-b border-slate-300 pb-2">
                      <p className="font-medium text-slate-700">Email</p>
                      <p className="text-slate-600">{oldPOData.vendor_email} → {po.vendor_email}</p>
                    </div>
                  )}
                  {po.vendor_phone !== oldPOData.vendor_phone && (
                    <div className="border-b border-slate-300 pb-2">
                      <p className="font-medium text-slate-700">Phone</p>
                      <p className="text-slate-600">{oldPOData.vendor_phone} → {po.vendor_phone}</p>
                    </div>
                  )}
                  {po.terms !== oldPOData.terms && (
                    <div className="border-b border-slate-300 pb-2">
                      <p className="font-medium text-slate-700">Terms</p>
                      <p className="text-slate-600">{oldPOData.terms} → {po.terms}</p>
                    </div>
                  )}
                  {po.expected_delivery !== oldPOData.expected_delivery && (
                    <div className="border-b border-slate-300 pb-2">
                      <p className="font-medium text-slate-700">Expected Delivery</p>
                      <p className="text-slate-600">{oldPOData.expected_delivery || "—"} → {po.expected_delivery || "—"}</p>
                    </div>
                  )}
                  {po.total_amount !== oldPOData.total_amount && (
                    <div className="border-b border-slate-300 pb-2">
                      <p className="font-medium text-slate-700">Total Amount</p>
                      <p className="text-slate-600">${oldPOData.total_amount?.toFixed(2)} → ${po.total_amount?.toFixed(2)}</p>
                    </div>
                  )}
                  {JSON.stringify(po.lines) !== JSON.stringify(oldPOData.lines) && (
                    <div>
                      <p className="font-medium text-slate-700">Line Items</p>
                      <p className="text-slate-600">{oldPOData.lines?.length || 0} items → {po.lines?.length || 0} items</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500">No changes detected</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Notes for Inventory Team (Optional)</label>
              <textarea
                value={notificationNotes}
                onChange={(e) => setNotificationNotes(e.target.value)}
                placeholder="Add any additional notes about why these changes were made..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                rows={3}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowNotifyModal(false);
                  setNotificationNotes("");
                }}
                disabled={sendingNotification}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNotifyInventoryTeam}
                disabled={sendingNotification}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sendingNotification ? "Sending..." : "Yes, Notify Team"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
