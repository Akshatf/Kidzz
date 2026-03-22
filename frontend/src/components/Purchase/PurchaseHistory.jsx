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
      const total = lines.reduce((s, l) => s + (l.total_amount || 0), 0);
      return {
        key,
        batch_id: first.batch_id,
        supplier_bill_no: first.supplier_bill_no,
        purchase_date: first.purchase_date,
        supplier_name: first.supplier_name,
        payment_status: first.payment_status,
        lines,
        total,
        isMulti: lines.length > 1,
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
  const [filters, setFilters] = useState({
    supplier: '',
    status: '',
    start_date: '',
    end_date: '',
  });
  const [loading, setLoading] = useState(true);

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
  };

  const clearFilters = () => {
    setFilters({ supplier: '', status: '', start_date: '', end_date: '' });
    setTimeout(() => fetchPurchases(), 100);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="purchase-history-container">
      <h2>Purchase history</h2>
      
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
            <strong className="purchase-summary-value">₹{Number(summary.grand_total).toFixed(2)}</strong>
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
                      <td className="num">₹{Number(row.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      )}
      
      <p className="purchase-history-hint">Each row is one supplier bill (multiple products appear as line items).</p>

      <div className="filters">
        <div className="filter-group">
          <label>Supplier</label>
          <input
            type="text"
            name="supplier"
            value={filters.supplier}
            onChange={handleFilterChange}
            placeholder="Filter by supplier..."
          />
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

      {bills.length === 0 ? (
        <div className="no-data">No purchases found</div>
      ) : (
        <div className="bills-list">
          {bills.map((bill) => (
            <article key={bill.key} className="purchase-bill-card">
              <header className="purchase-bill-card-head">
                <div>
                  <strong>{bill.supplier_name}</strong>
                  {bill.supplier_bill_no ? (
                    <span className="supplier-bill-no"> · Supplier bill: {bill.supplier_bill_no}</span>
                  ) : null}
                </div>
                <div className="purchase-bill-meta">
                  <span>{bill.purchase_date}</span>
                  <span
                    className={bill.payment_status === 'PAID' ? 'status-paid' : 'status-due'}
                  >
                    {bill.payment_status}
                  </span>
                  <span className="bill-total-pill">₹{bill.total.toFixed(2)}</span>
                  {bill.batch_id != null ? (
                    <Link className="purchase-edit-bill-link" to={`/record-purchase?editBatch=${bill.batch_id}`}>
                      Edit bill
                    </Link>
                  ) : null}
                  {bill.lines[0]?.bill_attachment ? (
                    <a
                      className="purchase-attachment-link"
                      href={resolveUploadedFileUrl(bill.lines[0].bill_attachment)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View attachment
                    </a>
                  ) : null}
                </div>
              </header>
              <table className="purchase-lines-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Cost</th>
                    <th>Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        {line.products
                          ? `${line.products.brand_name} (${line.product_code})`
                          : line.product_code}
                      </td>
                      <td>{line.quantity}</td>
                      <td>₹{Number(line.cost_price).toFixed(2)}</td>
                      <td>₹{Number(line.total_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default PurchaseHistory;