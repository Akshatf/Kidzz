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
        bill_attachment: first.bill_attachment,
      };
    })
    .sort((a, b) => {
      const d = new Date(b.purchase_date) - new Date(a.purchase_date);
      return d !== 0 ? d : b.lines[0].id - a.lines[0].id;
    });
}

function groupBillsByTimePeriod(bills, period) {
  const groups = new Map();
  
  bills.forEach(bill => {
    const date = new Date(bill.purchase_date);
    let key;
    let displayKey;
    
    switch(period) {
      case 'day':
        key = date.toISOString().split('T')[0];
        displayKey = new Date(key).toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        displayKey = `Week of ${weekStart.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })}`;
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        displayKey = date.toLocaleDateString('en-IN', {
          month: 'long',
          year: 'numeric'
        });
        break;
      case 'year':
        key = `${date.getFullYear()}`;
        displayKey = `Year ${date.getFullYear()}`;
        break;
      default:
        key = 'all';
        displayKey = 'All Purchases';
    }
    
    if (!groups.has(key)) {
      groups.set(key, {
        periodKey: key,
        displayKey: displayKey,
        bills: [],
        totalAmount: 0,
        billCount: 0
      });
    }
    
    const group = groups.get(key);
    group.bills.push(bill);
    group.totalAmount += bill.total;
    group.billCount += 1;
  });
  
  return Array.from(groups.values()).sort((a, b) => {
    if (period === 'day') return b.periodKey.localeCompare(a.periodKey);
    if (period === 'month') return b.periodKey.localeCompare(a.periodKey);
    if (period === 'year') return b.periodKey.localeCompare(a.periodKey);
    if (period === 'week') return b.periodKey.localeCompare(a.periodKey);
    return 0;
  });
}

const PurchaseHistory = () => {
  const [purchases, setPurchases] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [expandedBill, setExpandedBill] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [timeGrouping, setTimeGrouping] = useState('month');
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
  const groupedBills = useMemo(() => groupBillsByTimePeriod(bills, timeGrouping), [bills, timeGrouping]);

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

        <div className="time-grouping-tabs">
          <button 
            className={timeGrouping === 'day' ? 'active' : ''} 
            onClick={() => setTimeGrouping('day')}
          >
            By Day
          </button>
          <button 
            className={timeGrouping === 'week' ? 'active' : ''} 
            onClick={() => setTimeGrouping('week')}
          >
            By Week
          </button>
          <button 
            className={timeGrouping === 'month' ? 'active' : ''} 
            onClick={() => setTimeGrouping('month')}
          >
            By Month
          </button>
          <button 
            className={timeGrouping === 'year' ? 'active' : ''} 
            onClick={() => setTimeGrouping('year')}
          >
            By Year
          </button>
        </div>
      </div>

      {groupedBills.length === 0 ? (
        <div className="no-data">No purchases found</div>
      ) : (
        <div className="grouped-bills-container">
          {groupedBills.map((group) => (
            <div key={group.periodKey} className="time-period-group">
              <div className="time-period-header">
                <h3>{group.displayKey}</h3>
                <div className="time-period-stats">
                  <span className="bill-count">{group.billCount} bill{group.billCount !== 1 ? 's' : ''}</span>
                  <span className="period-total">{formatCurrency(group.totalAmount)}</span>
                </div>
              </div>
              
              <div className="bills-list">
                {group.bills.map((bill) => (
                  <div key={bill.key} className="purchase-bill-wrapper">
                    <div 
                      className={`purchase-bill-card ${expandedBill === bill.key ? 'expanded' : ''}`}
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
                          <span className="purchase-date">{bill.purchase_date}</span>
                          <span className={`status-badge ${bill.payment_status === 'PAID' ? 'status-paid' : 'status-due'}`}>
                            {bill.payment_status}
                          </span>
                          <span className="bill-total">{formatCurrency(bill.total)}</span>
                          <span className="expand-icon">{expandedBill === bill.key ? '▼' : '▶'}</span>
                        </div>
                      </div>
                      
                      <div className="bill-summary">
                        {bill.lines.slice(0, 2).map((line, idx) => (
                          <div key={idx} className="summary-line">
                            <span>{line.products ? `${line.products.brand_name} (${line.product_code})` : line.product_code}</span>
                            <span>{line.quantity} × {formatCurrency(line.cost_price)}</span>
                          </div>
                        ))}
                        {bill.lines.length > 2 && (
                          <div className="more-items">+ {bill.lines.length - 2} more item(s)</div>
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
                        
                        <table className="purchase-lines-table">
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Quantity</th>
                              <th>Cost Price</th>
                              <th>Selling Price</th>
                              <th>Line Total</th>
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
                                <td>{line.quantity}</td>
                                <td>{formatCurrency(line.cost_price)}</td>
                                <td>{line.sell_price ? formatCurrency(line.sell_price) : '-'}</td>
                                <td className="line-total">{formatCurrency(line.total_amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan="4" className="total-label">Bill Total:</td>
                              <td className="bill-grand-total">{formatCurrency(bill.total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PurchaseHistory;