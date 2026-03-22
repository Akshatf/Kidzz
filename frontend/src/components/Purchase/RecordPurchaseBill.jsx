import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { purchaseService } from '../../services/purchaseService';
import { supplierService } from '../../services/supplierService';
import toast from 'react-hot-toast';
import { resolveUploadedFileUrl } from '../../utils/apiOrigin';
import './RecordPurchaseBill.css';

const CREATE_SUPPLIER = '__CREATE__';
const DRAFT_KEY = 'inventory_record_purchase_draft_v2';

const emptyLine = () => ({
  brand_name: '',
  article_number: '',
  gender: 'boy',
  category: 'regular',
  cost_price: '',
  quantity: '1',
  pricing_mode: 'percentage',
  markup_percentage: '40',
  sell_price: '',
});

function lineFromBatchRow(row) {
  const p = row.products;
  const sp = p ? Number(p.sell_price) : 0;
  return {
    brand_name: p?.brand_name || '',
    article_number: p?.article_number || '',
    gender: p?.gender || 'boy',
    category: p?.category || 'regular',
    cost_price: String(row.cost_price ?? ''),
    quantity: String(row.quantity ?? '1'),
    pricing_mode: 'manual',
    markup_percentage: '40',
    sell_price: sp > 0 ? String(sp) : '',
  };
}

const RecordPurchaseBill = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const editBatchId = searchParams.get('editBatch');

  const [suppliers, setSuppliers] = useState([]);
  const [supplierName, setSupplierName] = useState('');
  const [supplierBillNo, setSupplierBillNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentStatus, setPaymentStatus] = useState('PAID');
  const [lines, setLines] = useState([emptyLine()]);
  const [billAttachment, setBillAttachment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
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
    (n) => n.toLowerCase() === supplierName.toLowerCase()
  )
    ? supplierNames.find((n) => n.toLowerCase() === supplierName.toLowerCase())
    : '';

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

  const loadBatchForEdit = useCallback(async () => {
    if (!editBatchId) return;
    setLoadingBatch(true);
    try {
      const res = await purchaseService.getBatch(editBatchId);
      const d = res.data;
      setSupplierName(d.supplier_name || '');
      setSupplierBillNo(d.supplier_bill_no || '');
      setPurchaseDate(d.purchase_date || new Date().toISOString().split('T')[0]);
      setPaymentStatus(d.payment_status || 'PAID');
      setBillAttachment(d.bill_attachment || '');
      const mapped = (d.lines || []).map(lineFromBatchRow);
      setLines(mapped.length ? mapped : [emptyLine()]);
      draftLoaded.current = true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load bill');
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
        if (typeof d.supplierName === 'string') setSupplierName(d.supplierName);
        if (typeof d.supplierBillNo === 'string') setSupplierBillNo(d.supplierBillNo);
        if (d.purchaseDate) setPurchaseDate(d.purchaseDate);
        if (d.paymentStatus) setPaymentStatus(d.paymentStatus);
        if (typeof d.billAttachment === 'string') setBillAttachment(d.billAttachment);
        if (Array.isArray(d.lines) && d.lines.length) setLines(d.lines);
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
          })
        );
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [supplierName, supplierBillNo, purchaseDate, paymentStatus, lines, billAttachment, editBatchId]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  };

  const discardDraft = () => {
    setSupplierName('');
    setSupplierBillNo('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPaymentStatus('PAID');
    setLines([emptyLine()]);
    setBillAttachment('');
    clearDraft();
    toast.success('Draft cleared');
  };

  const updateLine = (index, field, value) => {
    setLines((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const lineSellPrice = (row) => {
    const cost = parseFloat(row.cost_price || 0);
    if (row.pricing_mode === 'manual') {
      return parseFloat(row.sell_price || 0);
    }
    return cost + (cost * parseFloat(row.markup_percentage || 0)) / 100;
  };

  const handleSupplierSelect = (e) => {
    const v = e.target.value;
    if (v === CREATE_SUPPLIER) {
      setNewSupplierOpen(true);
      setNewSupplierName('');
      return;
    }
    setSupplierName(v);
  };

  const saveNewSupplier = async () => {
    const name = newSupplierName.trim();
    if (!name) {
      toast.error('Enter supplier name');
      return;
    }
    try {
      const res = await supplierService.create(name);
      await loadSuppliers();
      setSupplierName(res.data.name || name);
      setNewSupplierOpen(false);
      toast.success('Supplier added');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create supplier');
    }
  };

  const handleAttachmentChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const res = await purchaseService.uploadAttachment(file);
      setBillAttachment(res.data.path || '');
      toast.success('Attachment uploaded');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
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
        gender: row.gender,
        category: row.category,
        cost_price: cost,
        quantity: qty,
        sell_price: sp,
        pricing_mode: row.pricing_mode,
        markup_percentage: row.markup_percentage,
      });
    }
    return items;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLock.current) return;
    if (!supplierName.trim()) {
      toast.error('Select or create a supplier');
      return;
    }

    let items;
    try {
      items = buildPayloadItems();
    } catch (err) {
      toast.error(err.message);
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    const body = {
      supplier_name: supplierName.trim(),
      supplier_bill_no: supplierBillNo.trim(),
      purchase_date: purchaseDate,
      payment_status: paymentStatus,
      items,
      bill_attachment: billAttachment.trim() || undefined,
    };

    try {
      if (editBatchId) {
        await purchaseService.updateBatch(editBatchId, body);
        toast.success('Purchase bill updated');
      } else {
        await purchaseService.createBatch(body);
        toast.success('Purchase bill saved — stock updated');
      }
      clearDraft();
      setSupplierName('');
      setSupplierBillNo('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setPaymentStatus('PAID');
      setLines([emptyLine()]);
      setBillAttachment('');
      if (editBatchId) {
        setSearchParams({});
        navigate('/purchases');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not save purchase bill');
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  if (loadingBatch) {
    return <div className="loading">Loading bill…</div>;
  }

  return (
    <div className="record-purchase-container">
      <h2>{editBatchId ? 'Edit purchase bill' : 'Record purchase bill'}</h2>
      <p className="record-purchase-intro">
        {editBatchId
          ? 'Update this supplier bill. Stock is adjusted when you save (old lines are removed, then new lines applied).'
          : 'Enter supplier and their bill number once, add all products on that bill, then mark the whole bill as paid or due.'}
      </p>

      {!editBatchId && (
        <div className="purchase-draft-bar no-print">
          <span className="purchase-draft-hint">
            This form is saved in your browser until you save the bill or clear it.
          </span>
          <button type="button" className="purchase-discard-draft-btn" onClick={discardDraft}>
            Clear saved data
          </button>
        </div>
      )}

      {newSupplierOpen && (
        <div
          className="new-supplier-overlay"
          role="presentation"
          onClick={() => setNewSupplierOpen(false)}
          onKeyDown={(ev) => ev.key === 'Escape' && setNewSupplierOpen(false)}
        >
          <div
            className="new-supplier-modal"
            role="dialog"
            aria-modal="true"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3>New supplier</h3>
            <input
              type="text"
              value={newSupplierName}
              onChange={(ev) => setNewSupplierName(ev.target.value)}
              placeholder="Supplier name"
              autoFocus
            />
            <div className="new-supplier-actions">
              <button type="button" className="submit-bill-btn" onClick={saveNewSupplier}>
                Save supplier
              </button>
              <button type="button" className="remove-line-btn" onClick={() => setNewSupplierOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="record-purchase-form"
        onKeyDown={(ev) => {
          if (ev.key !== 'Enter') return;
          const t = ev.target;
          if (t instanceof HTMLInputElement && t.closest('.line-card')) {
            ev.preventDefault();
          }
        }}
      >
        <section className="bill-header-fields">
          <div className="form-row">
            <div className="form-group">
              <label>Supplier *</label>
              <select value={selectSupplierValue} onChange={handleSupplierSelect}>
                <option value="">Select supplier…</option>
                {supplierNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value={CREATE_SUPPLIER}>+ Create new supplier</option>
              </select>
            </div>
            <div className="form-group">
              <label>Supplier bill no.</label>
              <input
                type="text"
                value={supplierBillNo}
                onChange={(e) => setSupplierBillNo(e.target.value)}
                placeholder="Invoice / challan number"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Purchase date *</label>
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Payment for whole bill *</label>
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                <option value="PAID">Paid</option>
                <option value="DUE">Due</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group bill-attachment-group">
              <label>Bill scan (optional)</label>
              <input type="file" accept="image/*,.pdf,application/pdf" onChange={handleAttachmentChange} disabled={uploading} />
              {uploading && <span className="attachment-status">Uploading…</span>}
              {billAttachment ? (
                <div className="attachment-actions">
                  <a href={resolveUploadedFileUrl(billAttachment)} target="_blank" rel="noopener noreferrer">
                    View current file
                  </a>
                  <button type="button" className="remove-line-btn" onClick={() => setBillAttachment('')}>
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <h3 className="lines-heading">Products on this bill</h3>
        <div className="lines-list">
          {lines.map((row, index) => (
            <div key={index} className="line-card">
              <div className="line-card-head">
                <span>Item {index + 1}</span>
                {lines.length > 1 && (
                  <button type="button" className="remove-line-btn" onClick={() => removeLine(index)}>
                    Remove
                  </button>
                )}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Brand *</label>
                  <input
                    type="text"
                    value={row.brand_name}
                    onChange={(e) => updateLine(index, 'brand_name', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Article *</label>
                  <input
                    type="text"
                    value={row.article_number}
                    onChange={(e) => updateLine(index, 'article_number', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Gender</label>
                  <select value={row.gender} onChange={(e) => updateLine(index, 'gender', e.target.value)}>
                    <option value="boy">Boy</option>
                    <option value="girl">Girl</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={row.category} onChange={(e) => updateLine(index, 'category', e.target.value)}>
                    <option value="regular">Regular</option>
                    <option value="shorts">Shorts</option>
                    <option value="tshirt">T-Shirt</option>
                    <option value="jeans">Jeans</option>
                    <option value="all">All</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Cost (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.cost_price}
                    onChange={(e) => updateLine(index, 'cost_price', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Qty *</label>
                  <input
                    type="number"
                    min="1"
                    value={row.quantity}
                    onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Sell price</label>
                  <select
                    value={row.pricing_mode}
                    onChange={(e) => updateLine(index, 'pricing_mode', e.target.value)}
                  >
                    <option value="percentage">Markup % on cost</option>
                    <option value="manual">Manual SP</option>
                  </select>
                </div>
                {row.pricing_mode === 'percentage' ? (
                  <div className="form-group">
                    <label>Markup %</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.markup_percentage}
                      onChange={(e) => updateLine(index, 'markup_percentage', e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Sell price (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.sell_price}
                      onChange={(e) => updateLine(index, 'sell_price', e.target.value)}
                      required={row.pricing_mode === 'manual'}
                    />
                  </div>
                )}
              </div>
              <p className="line-preview">
                Selling price (preview):{' '}
                <strong>₹{Number.isFinite(lineSellPrice(row)) ? lineSellPrice(row).toFixed(2) : '0.00'}</strong>
              </p>
            </div>
          ))}
        </div>

        <button type="button" className="add-line-btn" onClick={addLine}>
          + Add another product
        </button>

        <button type="submit" className="submit-bill-btn" disabled={submitting}>
          {submitting ? 'Saving…' : editBatchId ? 'Update purchase bill' : 'Save purchase bill'}
        </button>
      </form>
    </div>
  );
};

export default RecordPurchaseBill;
