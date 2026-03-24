import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { purchaseService } from "../../services/purchaseService";
import { supplierService } from "../../services/supplierService";
import toast from "react-hot-toast";
import { resolveUploadedFileUrl } from "../../utils/apiOrigin";
import "./RecordPurchaseBill.css";

const CREATE_SUPPLIER = "__CREATE__";
const DRAFT_KEY = "inventory_record_purchase_draft_v4";

// Size options
const SIZE_OPTIONS = [
  "MLXL",
  "0",
  "012",
  "16-20",
  "22-26",
  "20-30",
  "16-26",
  "24-34",
  "18-24"
];

const emptyLine = () => ({
  brand_name: "",
  article_number: "",
  // gender: "boy",
  category: "regular",
  size: "",
  cost_price: "",
  quantity: "",
  pricing_mode: "percentage",
  markup_percentage: "40",
  sell_price: "",
});

function lineFromBatchRow(row) {
  const p = row.products;
  const sp = p ? Number(p.sell_price) : 0;
  return {
    brand_name: p?.brand_name || "",
    article_number: p?.article_number || "",
    // gender: p?.gender || "boy",
    category: p?.category || "regular",
    size: p?.size || "",
    cost_price: String(row.cost_price ?? ""),
    quantity: String(row.quantity ?? "1"),
    pricing_mode: "manual",
    markup_percentage: "40",
    sell_price: sp > 0 ? String(sp) : "",
  };
}

// Date helper functions
const formatDateForInput = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDateForAPI = (dateStr) => {
  if (!dateStr) return "";
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

const isValidDate = (dateStr) => {
  if (!dateStr) return false;
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  if (!regex.test(dateStr)) return false;

  const day = parseInt(dateStr.split("/")[0], 10);
  const month = parseInt(dateStr.split("/")[1], 10);
  const year = parseInt(dateStr.split("/")[2], 10);

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const RecordPurchaseBill = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const editBatchId = searchParams.get("editBatch");

  const [suppliers, setSuppliers] = useState([]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierBillNo, setSupplierBillNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    formatDateForInput(new Date()),
  );
  const [paymentStatus, setPaymentStatus] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [billAttachment, setBillAttachment] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [gstPercent, setGstPercent] = useState("");
  const [otherCharges, setOtherCharges] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [paidDate, setPaidDate] = useState(formatDateForInput(new Date()));
  const [purchasedBy, setPurchasedBy] = useState("");

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);
  const submitLock = useRef(false);
  const draftLoaded = useRef(false);

  const supplierNames = useMemo(() => {
    const names = suppliers.map((s) => s.name).filter(Boolean);
    const set = new Set(names.map((n) => n.toLowerCase()));
    if (supplierName && !set.has(supplierName.toLowerCase())) {
      names.push(supplierName);
    }
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [suppliers, supplierName]);

  const selectSupplierValue = supplierNames.some(
    (n) => n.toLowerCase() === supplierName.toLowerCase(),
  )
    ? supplierNames.find((n) => n.toLowerCase() === supplierName.toLowerCase())
    : "";

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await supplierService.list();
      setSuppliers(res.data || []);
    } catch {
      setSuppliers([]);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const calculateSubtotal = useCallback(() => {
    let total = 0;
    for (const row of lines) {
      const cost = parseFloat(row.cost_price || 0);
      const qty = parseInt(row.quantity, 10);
      if (Number.isFinite(cost) && Number.isFinite(qty)) {
        total += cost * qty;
      }
    }
    return total;
  }, [lines]);

  const calculateDiscount = useCallback(
    (subtotal) => {
      const discount = parseFloat(discountPercent);
      if (Number.isFinite(discount) && discount > 0) {
        return (subtotal * discount) / 100;
      }
      return 0;
    },
    [discountPercent],
  );

  const calculateGST = useCallback(
    (subtotal, discountAmount) => {
      const gst = parseFloat(gstPercent);
      const amountAfterDiscount = subtotal - discountAmount;
      if (Number.isFinite(gst) && gst > 0) {
        return (amountAfterDiscount * gst) / 100;
      }
      return 0;
    },
    [gstPercent],
  );

  const calculateTotal = useCallback(() => {
    const subtotal = calculateSubtotal();
    const discountAmount = calculateDiscount(subtotal);
    const gstAmount = calculateGST(subtotal, discountAmount);
    const other = parseFloat(otherCharges) || 0;
    return subtotal - discountAmount + gstAmount + other;
  }, [calculateSubtotal, calculateDiscount, calculateGST, otherCharges]);

  const loadBatchForEdit = useCallback(async () => {
    if (!editBatchId) return;
    setLoadingBatch(true);
    try {
      const res = await purchaseService.getBatch(editBatchId);
      const d = res.data;
      setSupplierName(d.supplier_name || "");
      setSupplierBillNo(d.supplier_bill_no || "");
      setPurchaseDate(
        d.purchase_date
          ? formatDateForInput(d.purchase_date)
          : formatDateForInput(new Date()),
      );
      setPaymentStatus(d.payment_status || "");
      setBillAttachment(d.bill_attachment || "");
      setDiscountPercent(d.discount_percent?.toString() || "");
      setGstPercent(d.gst_percent?.toString() || "");
      setOtherCharges(d.other_charges?.toString() || "");
      setPaidBy(d.paid_by || "");
      setPaidTo(d.paid_to || "");
      setPaidDate(
        d.paid_date
          ? formatDateForInput(d.paid_date)
          : formatDateForInput(new Date()),
      );
      setPurchasedBy(d.purchased_by || "");

      const mapped = (d.lines || []).map(lineFromBatchRow);
      setLines(mapped.length ? mapped : [emptyLine()]);
      draftLoaded.current = true;
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not load bill");
      setSearchParams({});
    } finally {
      setLoadingBatch(false);
    }
  }, [editBatchId, setSearchParams]);

  useEffect(() => {
    if (editBatchId) {
      loadBatchForEdit();
      return;
    }
    if (draftLoaded.current) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d.supplierName === "string") setSupplierName(d.supplierName);
        if (typeof d.supplierBillNo === "string")
          setSupplierBillNo(d.supplierBillNo);
        if (d.purchaseDate) setPurchaseDate(d.purchaseDate);
        if (d.paymentStatus) setPaymentStatus(d.paymentStatus);
        if (typeof d.billAttachment === "string")
          setBillAttachment(d.billAttachment);
        if (Array.isArray(d.lines) && d.lines.length) setLines(d.lines);
        if (d.discountPercent) setDiscountPercent(d.discountPercent);
        if (d.gstPercent) setGstPercent(d.gstPercent);
        if (d.otherCharges) setOtherCharges(d.otherCharges);
        if (d.paidBy) setPaidBy(d.paidBy);
        if (d.paidTo) setPaidTo(d.paidTo);
        if (d.paidDate) setPaidDate(d.paidDate);
        if (d.purchasedBy) setPurchasedBy(d.purchasedBy);
      }
    } catch {
      /* ignore */
    }
    draftLoaded.current = true;
  }, [editBatchId, loadBatchForEdit]);

  useEffect(() => {
    if (!draftLoaded.current || editBatchId) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            supplierName,
            supplierBillNo,
            purchaseDate,
            paymentStatus,
            lines,
            billAttachment,
            discountPercent,
            gstPercent,
            otherCharges,
            paidBy,
            paidTo,
            paidDate,
            purchasedBy,
          }),
        );
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [
    supplierName,
    supplierBillNo,
    purchaseDate,
    paymentStatus,
    lines,
    billAttachment,
    discountPercent,
    gstPercent,
    otherCharges,
    paidBy,
    paidTo,
    paidDate,
    purchasedBy,
    editBatchId,
  ]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  };

  const discardDraft = () => {
    setSupplierName("");
    setSupplierBillNo("");
    setPurchaseDate(formatDateForInput(new Date()));
    setPaymentStatus("");
    setLines([emptyLine()]);
    setBillAttachment("");
    setDiscountPercent("");
    setGstPercent("");
    setOtherCharges("");
    setPaidBy("");
    setPaidTo("");
    setPaidDate(formatDateForInput(new Date()));
    setPurchasedBy("");
    clearDraft();
    toast.success("Draft cleared");
  };

  const updateLine = (index, field, value) => {
    setLines((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index) => {
    setLines((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
    );
  };

  const lineSellPrice = (row) => {
    const cost = parseFloat(row.cost_price || 0);
    if (row.pricing_mode === "manual") {
      return parseFloat(row.sell_price || 0);
    }
    return cost + (cost * parseFloat(row.markup_percentage || 0)) / 100;
  };

  const handleSupplierSelect = (e) => {
    const v = e.target.value;
    if (v === CREATE_SUPPLIER) {
      setNewSupplierOpen(true);
      setNewSupplierName("");
      return;
    }
    setSupplierName(v);
  };

  const saveNewSupplier = async () => {
    const name = newSupplierName.trim();
    if (!name) {
      toast.error("Enter supplier name");
      return;
    }
    try {
      const res = await supplierService.create(name);
      await loadSuppliers();
      setSupplierName(res.data.name || name);
      setNewSupplierOpen(false);
      toast.success("Supplier added");
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not create supplier");
    }
  };

  const handleAttachmentChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const res = await purchaseService.uploadAttachment(file);
      setBillAttachment(res.data.path || "");
      toast.success("Attachment uploaded");
    } catch (err) {
      toast.error(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const buildPayloadItems = () => {
    const items = [];
    for (let i = 0; i < lines.length; i++) {
      const row = lines[i];
      if (!row.brand_name.trim() || !row.article_number.trim()) {
        throw new Error(`Line ${i + 1}: brand and article are required`);
      }
      if (!row.size) {
        throw new Error(`Line ${i + 1}: size is required`);
      }
      const cost = parseFloat(row.cost_price);
      const qty = parseInt(row.quantity, 10);
      if (!Number.isFinite(cost) || cost < 0) {
        throw new Error(`Line ${i + 1}: invalid cost price`);
      }
      if (!Number.isFinite(qty) || qty < 1) {
        throw new Error(`Line ${i + 1}: invalid quantity`);
      }
      const sp = lineSellPrice(row);
      if (!Number.isFinite(sp) || sp <= 0) {
        throw new Error(`Line ${i + 1}: invalid selling price`);
      }
      items.push({
        brand_name: row.brand_name.trim(),
        article_number: row.article_number.trim(),
        // gender: row.gender,
        category: row.category,
        size: row.size,
        cost_price: cost,
        quantity: qty,
        sell_price: sp,
        pricing_mode: row.pricing_mode,
        markup_percentage: row.markup_percentage,
      });
    }
    return items;
  };

  const handlePreview = (e) => {
    e.preventDefault();

    // Validate basic info
    if (!supplierName.trim()) {
      toast.error("Select or create a supplier");
      return;
    }

    if (!isValidDate(purchaseDate)) {
      toast.error("Invalid date format. Please use DD/MM/YYYY");
      return;
    }

    // Validate payment info
    if (paymentStatus === "PAID" && !paidBy.trim()) {
      toast.error("Please enter who paid the bill");
      return;
    }

    if (paymentStatus === "DUE" && !purchasedBy.trim()) {
      toast.error("Please enter who purchased the items");
      return;
    }

    // Validate items
    let items;
    try {
      items = buildPayloadItems();
    } catch (err) {
      toast.error(err.message);
      return;
    }

    const subtotal = calculateSubtotal();
    const discountAmount = calculateDiscount(subtotal);
    const gstAmount = calculateGST(subtotal, discountAmount);
    const other = parseFloat(otherCharges) || 0;
    const total = subtotal - discountAmount + gstAmount + other;

    setConfirmationData({
      supplierName: supplierName.trim(),
      supplierBillNo: supplierBillNo.trim(),
      purchaseDate: purchaseDate,
      paymentStatus,
      items,
      billAttachment,
      discountPercent: discountPercent ? parseFloat(discountPercent) : null,
      gstPercent: gstPercent ? parseFloat(gstPercent) : null,
      otherCharges: other,
      paidBy: paymentStatus === "PAID" ? paidBy.trim() : null,
      paidTo: paymentStatus === "PAID" ? paidTo.trim() || null : null,
      paidDate: paymentStatus === "PAID" ? paidDate : null,
      purchasedBy: paymentStatus === "DUE" ? purchasedBy.trim() : null,
      subtotal,
      discountAmount,
      gstAmount,
      total,
    });

    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    if (submitLock.current) return;

    submitLock.current = true;
    setSubmitting(true);

    try {
      const body = {
        supplier_name: confirmationData.supplierName,
        supplier_bill_no: confirmationData.supplierBillNo,
        purchase_date: formatDateForAPI(confirmationData.purchaseDate),
        payment_status: confirmationData.paymentStatus || null,
        items: confirmationData.items,
        bill_attachment: confirmationData.billAttachment || undefined,
        discount_percent: confirmationData.discountPercent,
        gst_percent: confirmationData.gstPercent,
        other_charges: confirmationData.otherCharges,
        total_amount: confirmationData.total,
        paid_by: confirmationData.paidBy,
        paid_to: confirmationData.paidTo,
        paid_date: confirmationData.paidDate
          ? formatDateForAPI(confirmationData.paidDate)
          : null,
        purchased_by: confirmationData.purchasedBy,
      };

      if (editBatchId) {
        await purchaseService.updateBatch(editBatchId, body);
        toast.success("Purchase bill updated");
      } else {
        await purchaseService.createBatch(body);
        toast.success("Purchase bill saved — stock updated");
      }

      clearDraft();
      setShowConfirmation(false);
      setConfirmationData(null);

      // Reset form
      setSupplierName("");
      setSupplierBillNo("");
      setPurchaseDate(formatDateForInput(new Date()));
      setPaymentStatus("");
      setLines([emptyLine()]);
      setBillAttachment("");
      setDiscountPercent("");
      setGstPercent("");
      setOtherCharges("");
      setPaidBy("");
      setPaidTo("");
      setPaidDate(formatDateForInput(new Date()));
      setPurchasedBy("");

      if (editBatchId) {
        setSearchParams({});
        navigate("/purchases");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Could not save purchase bill",
      );
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  if (loadingBatch) {
    return <div className="loading">Loading bill…</div>;
  }

  const subtotal = calculateSubtotal();
  const discountAmount = calculateDiscount(subtotal);
  const gstAmount = calculateGST(subtotal, discountAmount);
  const other = parseFloat(otherCharges) || 0;
  const total = subtotal - discountAmount + gstAmount + other;

  return (
    <div className="record-purchase-container">
      <div className="page-header">
        <h2>{editBatchId ? "✏️ Edit Purchase Bill" : "📝 Record Purchase Bill"}</h2>
        <p className="record-purchase-intro">
          {editBatchId
            ? "Update this supplier bill. Stock will be adjusted automatically."
            : "Fill in supplier details, add products with sizes, and optionally add discount, GST, or other charges."}
        </p>
      </div>

      {!editBatchId && (
        <div className="purchase-draft-bar no-print">
          <span className="purchase-draft-hint">
            💾 Your work is automatically saved as a draft
          </span>
          <button
            type="button"
            className="purchase-discard-draft-btn"
            onClick={discardDraft}
          >
            🗑️ Clear Draft
          </button>
        </div>
      )}

      {newSupplierOpen && (
        <div
          className="new-supplier-overlay"
          role="presentation"
          onClick={() => setNewSupplierOpen(false)}
          onKeyDown={(ev) => ev.key === "Escape" && setNewSupplierOpen(false)}
        >
          <div
            className="new-supplier-modal"
            role="dialog"
            aria-modal="true"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3>➕ Add New Supplier</h3>
            <input
              type="text"
              value={newSupplierName}
              onChange={(ev) => setNewSupplierName(ev.target.value)}
              placeholder="Enter supplier name"
              autoFocus
            />
            <div className="new-supplier-actions">
              <button
                type="button"
                className="submit-bill-btn"
                onClick={saveNewSupplier}
              >
                Save Supplier
              </button>
              <button
                type="button"
                className="remove-line-btn"
                onClick={() => setNewSupplierOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handlePreview} className="record-purchase-form">
        {/* Basic Information Section */}
        <section className="form-section">
          <h3 className="section-title">📋 Basic Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Supplier *</label>
              <select value={selectSupplierValue} onChange={handleSupplierSelect}>
                <option value="">Select supplier…</option>
                {supplierNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value={CREATE_SUPPLIER}>➕ Create new supplier</option>
              </select>
            </div>

            <div className="form-group">
              <label>Bill Number</label>
              <input
                type="text"
                value={supplierBillNo}
                onChange={(e) => setSupplierBillNo(e.target.value)}
                placeholder="Supplier invoice number"
              />
            </div>

            <div className="form-group">
              <label>Purchase Date *</label>
              <input
                type="text"
                value={purchaseDate}
                onChange={(e) => {
                  let value = e.target.value.replace(/[^\d/]/g, "");
                  if (value.length === 2 || value.length === 5) {
                    value += "/";
                  }
                  setPurchaseDate(value);
                }}
                placeholder="DD/MM/YYYY"
                required
              />
              <small>Example: 15/01/2024</small>
            </div>

            <div className="form-group">
              <label>Payment Status</label>
              <div className="radio-group-inline">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="paymentStatus"
                    value="PAID"
                    checked={paymentStatus === "PAID"}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                  />
                  <span>✅ Paid</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="paymentStatus"
                    value="DUE"
                    checked={paymentStatus === "DUE"}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                  />
                  <span>⏳ Due</span>
                </label>
              </div>
            </div>
          </div>

          {paymentStatus === "PAID" && (
            <div className="payment-details">
              <div className="form-grid">
                <div className="form-group">
                  <label>Paid By *</label>
                  <input
                    type="text"
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value)}
                    placeholder="Who made the payment?"
                  />
                </div>
                <div className="form-group">
                  <label>Paid To (optional)</label>
                  <input
                    type="text"
                    value={paidTo}
                    onChange={(e) => setPaidTo(e.target.value)}
                    placeholder="Recipient name"
                  />
                </div>
                <div className="form-group">
                  <label>Payment Date</label>
                  <input
                    type="text"
                    value={paidDate}
                    onChange={(e) => {
                      let value = e.target.value.replace(/[^\d/]/g, "");
                      if (value.length === 2 || value.length === 5) {
                        value += "/";
                      }
                      setPaidDate(value);
                    }}
                    placeholder="DD/MM/YYYY"
                  />
                </div>
              </div>
            </div>
          )}

          {paymentStatus === "DUE" && (
            <div className="payment-details">
              <div className="form-group">
                <label>Purchased By *</label>
                <input
                  type="text"
                  value={purchasedBy}
                  onChange={(e) => setPurchasedBy(e.target.value)}
                  placeholder="Who purchased the items?"
                />
              </div>
            </div>
          )}
        </section>

        {/* Bill Charges Section */}
        <section className="form-section">
          <h3 className="section-title">💰 Bill Charges</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Discount %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                placeholder="0"
              />
              <small>Discount on total bill</small>
            </div>
            <div className="form-group">
              <label>GST %</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={gstPercent}
                onChange={(e) => setGstPercent(e.target.value)}
                placeholder="0"
              />
              <small>GST on bill after discount</small>
            </div>
            <div className="form-group">
              <label>Other Charges (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={otherCharges}
                onChange={(e) => setOtherCharges(e.target.value)}
                placeholder="0"
              />
              <small>Shipping, handling, etc.</small>
            </div>
          </div>
        </section>

        {/* Bill Attachment Section */}
        <section className="form-section">
          <h3 className="section-title">Bill Attachment</h3>
          <div className="attachment-area">
            <input
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={handleAttachmentChange}
              disabled={uploading}
              id="bill-attachment"
            />
            {uploading && <span className="attachment-status">Uploading...</span>}
            {billAttachment && (
              <div className="attachment-info">
                <a href={resolveUploadedFileUrl(billAttachment)} target="_blank" rel="noopener noreferrer">
                   View uploaded file
                </a>
                <button type="button" onClick={() => setBillAttachment("")}>
                  Remove
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Products Section */}
        <section className="form-section">
          <h3 className="section-title">🛍️ Products</h3>
          <div className="lines-list">
            {lines.map((row, index) => (
              <div key={index} className="product-card">
                <div className="product-header">
                  <span className="product-number">Item #{index + 1}</span>
                  {lines.length > 1 && (
                    <button type="button" className="remove-product-btn" onClick={() => removeLine(index)}>
                      ✕ Remove
                    </button>
                  )}
                </div>
                
                <div className="form-grid">
                  <div className="form-group">
                    <label>Brand *</label>
                    <input
                      type="text"
                      value={row.brand_name}
                      onChange={(e) => updateLine(index, "brand_name", e.target.value)}
                      placeholder="e.g., Nike, Adidas"
                    />
                  </div>
                  <div className="form-group">
                    <label>Article Number *</label>
                    <input
                      type="text"
                      value={row.article_number}
                      onChange={(e) => updateLine(index, "article_number", e.target.value)}
                      placeholder="Product code"
                    />
                  </div>
                  {/* <div className="form-group">
                    <label>Gender</label>
                    <select value={row.gender} onChange={(e) => updateLine(index, "gender", e.target.value)}>
                      <option value="boy">👦 Boy</option>
                      <option value="girl">👧 Girl</option>
                    </select>
                  </div> */}
                  <div className="form-group">
                    <label>Category</label>
                    <select value={row.category} onChange={(e) => updateLine(index, "category", e.target.value)}>
                      <option value="regular">Regular</option>
                      <option value="shorts">Shorts</option>
                      <option value="tshirt">T-Shirt</option>
                      <option value="jeans">Jeans</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Size *</label>
                    <select value={row.size} onChange={(e) => updateLine(index, "size", e.target.value)} required>
                      <option value="">Select size…</option>
                      {SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => updateLine(index, "quantity", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Cost Price (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.cost_price}
                      onChange={(e) => updateLine(index, "cost_price", e.target.value)}
                      placeholder="Purchase price per item"
                    />
                  </div>
                </div>

                <div className="sell-price-section">
                  <label className="section-subtitle">Selling Price</label>
                  <div className="radio-group-inline">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name={`pricing_mode_${index}`}
                        value="percentage"
                        checked={row.pricing_mode === "percentage"}
                        onChange={(e) => updateLine(index, "pricing_mode", e.target.value)}
                      />
                      <span>By Markup %</span>
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name={`pricing_mode_${index}`}
                        value="manual"
                        checked={row.pricing_mode === "manual"}
                        onChange={(e) => updateLine(index, "pricing_mode", e.target.value)}
                      />
                      <span>  Manual Price</span>
                    </label>
                  </div>

                  {row.pricing_mode === "percentage" ? (
                    <div className="form-group inline">
                      <label>Markup Percentage</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.markup_percentage}
                        onChange={(e) => updateLine(index, "markup_percentage", e.target.value)}
                        placeholder="e.g., 40"
                      />
                      <span className="preview-price">
                        → Selling Price: <strong>₹{lineSellPrice(row).toFixed(2)}</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="form-group inline">
                      <label>Selling Price (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.sell_price}
                        onChange={(e) => updateLine(index, "sell_price", e.target.value)}
                        placeholder="Final selling price"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="add-product-btn" onClick={addLine}>
            + Add Another Product
          </button>
        </section>

        {/* Bill Summary Section */}
        <section className="form-section summary-section">
          <h3 className="section-title">🧾 Bill Summary</h3>
          <div className="summary-card">
            <div className="summary-row">
              <span>Subtotal:</span>
              <span className="amount">₹{subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="summary-row discount">
                <span>Discount ({discountPercent}%):</span>
                <span className="amount">- ₹{discountAmount.toFixed(2)}</span>
              </div>
            )}
            {gstAmount > 0 && (
              <div className="summary-row gst">
                <span>GST ({gstPercent}%):</span>
                <span className="amount">+ ₹{gstAmount.toFixed(2)}</span>
              </div>
            )}
            {other > 0 && (
              <div className="summary-row other">
                <span>Other Charges:</span>
                <span className="amount">+ ₹{other.toFixed(2)}</span>
              </div>
            )}
            <div className="summary-row total">
              <span>Total Bill Amount:</span>
              <span className="amount">₹{total.toFixed(2)}</span>
            </div>
          </div>
        </section>

        <button type="submit" className="submit-bill-btn" disabled={submitting}>
          {submitting ? "Saving..." : "👁️ Preview & Save Bill"}
        </button>
      </form>

      {/* Confirmation Modal */}
      {showConfirmation && confirmationData && (
        <div className="confirmation-overlay" onClick={() => setShowConfirmation(false)}>
          <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirmation-header">
              <h3>✅ Confirm Purchase Bill</h3>
              <button className="close-btn" onClick={() => setShowConfirmation(false)}>×</button>
            </div>

            <div className="confirmation-content">
              <div className="bill-header">
                <div className="supplier-info">
                  <h4>{confirmationData.supplierName}</h4>
                  <p>Bill No: {confirmationData.supplierBillNo || "N/A"}</p>
                </div>
                <div className="bill-date">
                  <p>Date: {confirmationData.purchaseDate}</p>
                  <p className={`status ${confirmationData.paymentStatus === "PAID" ? "status-paid" : "status-due"}`}>
                    {confirmationData.paymentStatus === "PAID" ? "✅ PAID" : "⏳ DUE"}
                  </p>
                </div>
              </div>

              {confirmationData.paymentStatus === "PAID" && (
                <div className="payment-info-section">
                  <p><strong>Paid by:</strong> {confirmationData.paidBy}</p>
                  {confirmationData.paidTo && <p><strong>Paid to:</strong> {confirmationData.paidTo}</p>}
                  <p><strong>Paid date:</strong> {confirmationData.paidDate}</p>
                </div>
              )}

              {confirmationData.paymentStatus === "DUE" && (
                <div className="payment-info-section">
                  <p><strong>Purchased by:</strong> {confirmationData.purchasedBy}</p>
                </div>
              )}

              <div className="table-wrapper">
                <table className="confirmation-items-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Brand</th>
                      <th>Article</th>
                      <th>Size</th>
                      <th>Qty</th>
                      <th>Cost (₹)</th>
                      <th>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confirmationData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{item.brand_name}</td>
                        <td>{item.article_number}</td>
                        <td>{item.size}</td>
                        <td className="num">{item.quantity}</td>
                        <td className="num">₹{item.cost_price.toFixed(2)}</td>
                        <td className="num">₹{(item.cost_price * item.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="6" className="total-label">Subtotal:</td>
                      <td className="total-value num">₹{confirmationData.subtotal.toFixed(2)}</td>
                    </tr>
                    {confirmationData.discountPercent > 0 && (
                      <tr>
                        <td colSpan="6" className="total-label">Discount ({confirmationData.discountPercent}%):</td>
                        <td className="total-value discount-value num">-₹{confirmationData.discountAmount.toFixed(2)}</td>
                      </tr>
                    )}
                    {confirmationData.gstPercent > 0 && (
                      <tr>
                        <td colSpan="6" className="total-label">GST ({confirmationData.gstPercent}%):</td>
                        <td className="total-value gst-value num">+₹{confirmationData.gstAmount.toFixed(2)}</td>
                      </tr>
                    )}
                    {confirmationData.otherCharges > 0 && (
                      <tr>
                        <td colSpan="6" className="total-label">Other Charges:</td>
                        <td className="total-value num">+₹{confirmationData.otherCharges.toFixed(2)}</td>
                      </tr>
                    )}
                    <tr className="grand-total-row">
                      <td colSpan="6" className="total-label grand-total-label">GRAND TOTAL:</td>
                      <td className="grand-total-value num">₹{confirmationData.total.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="confirmation-actions">
              <button className="edit-btn" onClick={() => setShowConfirmation(false)}>
                ✏️ Edit Bill
              </button>
              <button className="confirm-btn" onClick={handleConfirmSubmit} disabled={submitting}>
                {submitting ? "Saving..." : "✅ Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordPurchaseBill;