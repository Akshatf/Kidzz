import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { purchaseService } from '../../services/purchaseService';
import toast from 'react-hot-toast';
import { resolveUploadedFileUrl } from '../../utils/apiOrigin';
import './PurchaseHistory.css';

function groupPurchasesIntoBills(purchases) {
  const map = new Map();
  for (const p of purchases) {
    const key = p.batch_id != null ? `b-${p.batch_id}` : `i-${p.id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  return Array.from(map.entries())
    .map(([key, lines]) => {
      lines.sort((a, b) => a.id - b.id);
      const first = lines[0];
      
      // Calculate subtotal from line items
      const subtotal = lines.reduce((s, l) => s + (l.cost_price * l.quantity || 0), 0);
      
      // Get discount, GST, other charges from first line (they are same for all lines in a batch)
      const discountPercent = first.discount_percent || 0;
      const gstPercent = first.gst_percent || 0;
      const otherCharges = first.other_charges || 0;
      
      // Calculate discount amount
      const discountAmount = (subtotal * discountPercent) / 100;
      
      // Calculate GST amount (on amount after discount)
      const amountAfterDiscount = subtotal - discountAmount;
      const gstAmount = (amountAfterDiscount * gstPercent) / 100;
      
      // Calculate total
      const total = subtotal - discountAmount + gstAmount + otherCharges;
      
      return {
        key,
        batch_id: first.batch_id,
        supplier_bill_no: first.supplier_bill_no,
        purchase_date: first.purchase_date,
        supplier_name: first.supplier_name,
        payment_status: first.payment_status,
        payment_date: first.paid_date,
        paid_by: first.paid_by,
        paid_to: first.paid_to,
        purchased_by: first.purchased_by,
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        gst_percent: gstPercent,
        gst_amount: gstAmount,
        other_charges: otherCharges,
        subtotal: subtotal,
        lines,
        total: total,
        isMulti: lines.length > 1,
        bill_attachment: first.bill_attachment,
      };
    })
    .sort((a, b) => {
      const d = new Date(b.purchase_date) - new Date(a.purchase_date);
      return d !== 0 ? d : b.lines[0].id - a.lines[0].id;
    });
}

const PurchaseHistory = () => {
  const [purchases, setPurchases] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [expandedBill, setExpandedBill] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [filters, setFilters] = useState({
    supplier: '',
    status: '',
    start_date: '',
    end_date: '',
  });
  const [loading, setLoading] = useState(true);

  // Fetch unique suppliers for dropdown
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await purchaseService.getSuppliers();
        setSuppliers(response.data.suppliers || []);
      } catch (error) {
        console.error('Error fetching suppliers:', error);
      }
    };
    fetchSuppliers();
  }, []);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const response = await purchaseService.getAll(filters);
      setPurchases(response.data);
    } catch (error) {
      toast.error('Error fetching purchase history');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await purchaseService.getSummary();
      setSummary(res.data);
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const bills = useMemo(() => groupPurchasesIntoBills(purchases), [purchases]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    fetchPurchases();
    setExpandedBill(null);
  };

  const clearFilters = () => {
    setFilters({ supplier: '', status: '', start_date: '', end_date: '' });
    setTimeout(() => fetchPurchases(), 100);
    setExpandedBill(null);
  };

  const toggleBillExpand = (billKey) => {
    setExpandedBill(expandedBill === billKey ? null : billKey);
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount).toFixed(2)}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="purchase-history-container">
      <h2>Purchase History</h2>
      
      <div className="purchase-summary-toggle">
        <button 
          className="toggle-summary-btn" 
          onClick={() => setShowSummary(!showSummary)}
        >
          {showSummary ? 'Hide' : 'Show'} Purchase Summary
        </button>
      </div>

      {showSummary && summary && (
        <section className="purchase-summary-panel">
          <div className="purchase-summary-grand">
            <span className="purchase-summary-label">Total purchase value (all suppliers)</span>
            <strong className="purchase-summary-value">{formatCurrency(summary.grand_total)}</strong>
          </div>
          {Array.isArray(summary.by_supplier) && summary.by_supplier.length > 0 ? (
            <div className="purchase-summary-by">
              <h3 className="purchase-summary-by-title">By supplier</h3>
              <table className="purchase-summary-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th className="num">Total purchases</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.by_supplier.map((row) => (
                    <tr key={row.supplier_name}>
                      <td>{row.supplier_name}</td>
                      <td className="num">{formatCurrency(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      )}
      
      <div className="filters-section">
        <div className="filters">
          <div className="filter-group">
            <label>Supplier</label>
            <select 
              name="supplier" 
              value={filters.supplier} 
              onChange={handleFilterChange}
            >
              <option value="">All Suppliers</option>
              {suppliers.map(supplier => (
                <option key={supplier} value={supplier}>{supplier}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Status</label>
            <select name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All</option>
              <option value="PAID">Paid</option>
              <option value="DUE">Due</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Start date</label>
            <input type="date" name="start_date" value={filters.start_date} onChange={handleFilterChange} />
          </div>
          <div className="filter-group">
            <label>End date</label>
            <input type="date" name="end_date" value={filters.end_date} onChange={handleFilterChange} />
          </div>
          <div className="filter-actions">
            <button onClick={applyFilters} className="apply-filters-btn">Apply Filters</button>
            <button onClick={clearFilters} className="clear-filters-btn">Clear</button>
          </div>
        </div>
      </div>

      {bills.length === 0 ? (
        <div className="no-data">No purchases found</div>
      ) : (
        <div className="bills-list">
          {bills.map((bill) => (
            <div key={bill.key} className="purchase-bill-wrapper">
              <div 
                className={`purchase-bill-card ${expandedBill === bill.key ? 'expanded' : ''} ${bill.payment_status === 'DUE' ? 'due-bill' : 'paid-bill'}`}
                onClick={() => toggleBillExpand(bill.key)}
              >
                <div className="purchase-bill-card-head">
                  <div className="bill-info">
                    <strong className="supplier-name">{bill.supplier_name}</strong>
                    {bill.supplier_bill_no && (
                      <span className="supplier-bill-no"> · Bill: {bill.supplier_bill_no}</span>
                    )}
                  </div>
                  <div className="purchase-bill-meta">
                    <span className="purchase-date">{formatDate(bill.purchase_date)}</span>
                    <span className={`status-badge ${bill.payment_status === 'PAID' ? 'status-paid' : 'status-due'}`}>
                      {bill.payment_status || 'Pending'}
                    </span>
                    {bill.payment_status === 'PAID' && bill.payment_date && (
                      <span className="payment-date">Paid: {formatDate(bill.payment_date)}</span>
                    )}
                    <span className="bill-total">{formatCurrency(bill.total)}</span>
                    <span className="expand-icon">{expandedBill === bill.key ? '▼' : '▶'}</span>
                  </div>
                </div>
                
                <div className="bill-summary">
                  <div className="summary-row">
                    <span>{bill.lines.length} item{bill.lines.length !== 1 ? 's' : ''}</span>
                    {bill.discount_percent > 0 && (
                      <span className="discount-badge">Discount: {bill.discount_percent}% (-{formatCurrency(bill.discount_amount)})</span>
                    )}
                    {bill.gst_percent > 0 && (
                      <span className="gst-badge">GST: {bill.gst_percent}% (+{formatCurrency(bill.gst_amount)})</span>
                    )}
                    {bill.other_charges > 0 && (
                      <span className="other-badge">Other: +{formatCurrency(bill.other_charges)}</span>
                    )}
                  </div>
                  {bill.payment_status === 'PAID' && bill.paid_by && (
                    <div className="payment-info">Paid by: {bill.paid_by} {bill.paid_to ? `(to: ${bill.paid_to})` : ''}</div>
                  )}
                  {bill.payment_status === 'DUE' && bill.purchased_by && (
                    <div className="payment-info">Purchased by: {bill.purchased_by}</div>
                  )}
                </div>
              </div>
              
              {expandedBill === bill.key && (
                <div className="bill-details-expanded">
                  <div className="expanded-header">
                    <h4>Bill Details</h4>
                    <div className="expanded-actions">
                      {bill.batch_id != null && (
                        <Link 
                          className="edit-bill-link" 
                          to={`/record-purchase?editBatch=${bill.batch_id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Edit Bill
                        </Link>
                      )}
                      {bill.bill_attachment && (
                        <a
                          className="view-attachment-link"
                          href={resolveUploadedFileUrl(bill.bill_attachment)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Attachment
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="bill-info-section">
                    <div className="info-row">
                      <span className="info-label">Supplier Bill No:</span>
                      <span className="info-value">{bill.supplier_bill_no || 'N/A'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Purchase Date:</span>
                      <span className="info-value">{formatDate(bill.purchase_date)}</span>
                    </div>
                    {bill.payment_status === 'PAID' && (
                      <>
                        <div className="info-row">
                          <span className="info-label">Paid Date:</span>
                          <span className="info-value">{formatDate(bill.payment_date)}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Paid By:</span>
                          <span className="info-value">{bill.paid_by}</span>
                        </div>
                        {bill.paid_to && (
                          <div className="info-row">
                            <span className="info-label">Paid To:</span>
                            <span className="info-value">{bill.paid_to}</span>
                          </div>
                        )}
                      </>
                    )}
                    {bill.payment_status === 'DUE' && bill.purchased_by && (
                      <div className="info-row">
                        <span className="info-label">Purchased By:</span>
                        <span className="info-value">{bill.purchased_by}</span>
                      </div>
                    )}
                  </div>
                  
                  <table className="purchase-lines-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="num">Quantity</th>
                        <th className="num">Cost Price</th>
                        <th className="num">Selling Price</th>
                        <th className="num">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.lines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            {line.products
                              ? `${line.products.brand_name} - ${line.products.article_number || ''} (${line.product_code})`
                              : line.product_code}
                          </td>
                          <td className="num">{line.quantity}</td>
                          <td className="num">{formatCurrency(line.cost_price)}</td>
                          <td className="num">{line.sell_price ? formatCurrency(line.sell_price) : '-'}</td>
                          <td className="num line-total">{formatCurrency(line.cost_price * line.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="calculation-row">
                        <td colSpan="4" className="calculation-label">Subtotal:</td>
                        <td className="calculation-value num">{formatCurrency(bill.subtotal)}</td>
                      </tr>
                      {bill.discount_percent > 0 && (
                        <tr className="calculation-row discount">
                          <td colSpan="4" className="calculation-label">Discount ({bill.discount_percent}%):</td>
                          <td className="calculation-value num">-{formatCurrency(bill.discount_amount)}</td>
                        </tr>
                      )}
                      {bill.gst_percent > 0 && (
                        <tr className="calculation-row gst">
                          <td colSpan="4" className="calculation-label">GST ({bill.gst_percent}%):</td>
                          <td className="calculation-value num">+{formatCurrency(bill.gst_amount)}</td>
                        </tr>
                      )}
                      {bill.other_charges > 0 && (
                        <tr className="calculation-row other">
                          <td colSpan="4" className="calculation-label">Other Charges:</td>
                          <td className="calculation-value num">+{formatCurrency(bill.other_charges)}</td>
                        </tr>
                      )}
                      <tr className="total-row">
                        <td colSpan="4" className="total-label">GRAND TOTAL:</td>
                        <td className="bill-grand-total num">{formatCurrency(bill.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PurchaseHistory;