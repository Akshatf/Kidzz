import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { reportService } from '../../services/reportService';
import { userService } from '../../services/userService';
import { saleService } from '../../services/saleService';
import toast from 'react-hot-toast';
import { SHOP } from '../../config/shop';
import { formatBillRef } from '../../utils/billRef';
import { mapSaleToBillData } from '../../utils/saleBillData';
import Bill from '../sales/Bill';
import EditSaleBill from '../sales/EditSaleBill';
import './SalesReport.css';

function presetRange(preset) {
  const end = new Date();
  const endStr = end.toISOString().split('T')[0];
  if (preset === '7d') {
    const s = new Date(end);
    s.setDate(s.getDate() - 6);
    return { start_date: s.toISOString().split('T')[0], end_date: endStr };
  }
  if (preset === '30d') {
    const s = new Date(end);
    s.setDate(s.getDate() - 29);
    return { start_date: s.toISOString().split('T')[0], end_date: endStr };
  }
  if (preset === '1y') {
    const s = new Date(end);
    s.setFullYear(s.getFullYear() - 1);
    s.setDate(s.getDate() + 1);
    return { start_date: s.toISOString().split('T')[0], end_date: endStr };
  }
  return { start_date: '', end_date: '' };
}

const SalesReport = ({ currentUser }) => {
  const isAdmin = currentUser?.role === 'admin';
  const [report, setReport] = useState(null);
  const [salespersons, setSalespersons] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState({ cash: 0, online: 0 });
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    salesperson_id: isAdmin ? '' : currentUser?.id || '',
  });
  const [loading, setLoading] = useState(false);
  const [billData, setBillData] = useState(null);
  const [editBillData, setEditBillData] = useState(null);
  const [loadingBillId, setLoadingBillId] = useState(null);

  const fetchReport = useCallback(async () => {
    if (!isAdmin && !currentUser?.id) {
      setReport({ total_sales: 0, total_revenue: 0, total_discount: 0, sales: [] });
      return;
    }

    setLoading(true);
    try {
      const effectiveFilters = {
        ...filters,
        requester_id: currentUser?.id || '',
        salesperson_id: isAdmin ? filters.salesperson_id : currentUser?.id,
      };
      const response = await reportService.getSalesReport(effectiveFilters);
      setReport(response.data);
    } catch (error) {
      toast.error('Error fetching sales report');
    } finally {
      setLoading(false);
    }
  }, [currentUser, filters, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const loadSalespersons = async () => {
      try {
        const response = await userService.getSalespersons();
        setSalespersons(response.data);
      } catch (error) {
        toast.error('Error fetching salespersons');
      }
    };
    loadSalespersons();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin && currentUser?.id) {
      setFilters((prev) => ({ ...prev, salesperson_id: currentUser.id }));
    }
  }, [isAdmin, currentUser]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    if (report?.sales) {
      const breakdown = report.sales.reduce((acc, sale) => {
        const mode = sale.payment_mode || 'cash';
        acc[mode] = (acc[mode] || 0) + (sale.final_amount || 0);
        return acc;
      }, { cash: 0, online: 0 });
      setPaymentBreakdown(breakdown);
    }
  }, [report]);

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value,
    });
  };

  const applyPreset = (preset) => {
    const r = presetRange(preset);
    setFilters((prev) => ({
      ...prev,
      start_date: r.start_date,
      end_date: r.end_date,
    }));
  };

  const openBill = async (saleId) => {
    setLoadingBillId(saleId);
    try {
      const res = await saleService.getById(saleId);
      setBillData(mapSaleToBillData(res.data));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not load bill');
    } finally {
      setLoadingBillId(null);
    }
  };

  const openEditBill = (sale) => {
    setEditBillData(sale);
  };

  const handleBillSaved = (updated) => {
    setEditBillData(null);
    fetchReport();
    toast.success('Bill updated');
  };

  const handleBillDeleted = () => {
    setEditBillData(null);
    fetchReport();
    toast.success('Bill deleted');
  };

  const handleDeleteBill = async (saleId) => {
    if (!window.confirm('Delete this bill permanently? Stock will be restored.')) return;
    try {
      await saleService.remove(saleId);
      fetchReport();
      toast.success('Bill deleted');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not delete bill');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const salespersonLabel =
    !isAdmin || !filters.salesperson_id
      ? isAdmin
        ? 'All salesmen'
        : currentUser?.name || '—'
      : salespersons.find((s) => s.id === filters.salesperson_id)?.name || '—';

  const periodLabel =
    filters.start_date && filters.end_date
      ? `${filters.start_date} to ${filters.end_date}`
      : filters.start_date
        ? `From ${filters.start_date}`
        : filters.end_date
          ? `Until ${filters.end_date}`
          : 'All dates';

  const presetActive = useMemo(() => {
    const p7 = presetRange('7d');
    const p30 = presetRange('30d');
    const p1y = presetRange('1y');
    const match = (a, b) => a.start_date === b.start_date && a.end_date === b.end_date;
    const cur = { start_date: filters.start_date || '', end_date: filters.end_date || '' };
    if (!cur.start_date && !cur.end_date) return 'all';
    if (match(cur, p7)) return '7d';
    if (match(cur, p30)) return '30d';
    if (match(cur, p1y)) return '1y';
    return null;
  }, [filters.start_date, filters.end_date]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="sales-report-container report-document">
      <header className="report-screen-header no-print">
        <h2>Sales report</h2>
      </header>

      <div className="report-print-header print-only-block">
        <div className="report-print-brand">{SHOP.name}</div>
        <div className="report-print-address">{SHOP.addressLines.join(' · ')}</div>
        <h1 className="report-print-title">Sales report</h1>
        <div className="report-print-meta">
          <span>Period: {periodLabel}</span>
          <span>Salesman: {salespersonLabel}</span>
          <span>Generated: {generatedAt}</span>
        </div>
      </div>

      <div className="date-filters no-print">
        <div className="sales-preset-row">
          <span className="sales-preset-label">Quick range</span>
          <div className="sales-preset-chips">
            {[
              { id: '7d', label: 'Last 7 days' },
              { id: '30d', label: 'Last month' },
              { id: '1y', label: 'Last year' },
              { id: 'all', label: 'All time' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                className={`sales-preset-chip ${presetActive === p.id ? 'active' : ''}`}
                onClick={() => applyPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-field">
          <label>Start date</label>
          <input type="date" name="start_date" value={filters.start_date} onChange={handleFilterChange} />
        </div>
        <div className="filter-field">
          <label>End date</label>
          <input type="date" name="end_date" value={filters.end_date} onChange={handleFilterChange} />
        </div>
        {isAdmin && (
          <div className="filter-field">
            <label>Salesman</label>
            <select name="salesperson_id" value={filters.salesperson_id} onChange={handleFilterChange}>
              <option value="">All</option>
              {salespersons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {report && (
        <>
          <div className="report-summary-inline print-only-block">
            <p>
              <strong>Period:</strong> {periodLabel} · <strong>Salesman:</strong> {salespersonLabel}
            </p>
          </div>

          <div className="sales-stats">
            <div className="stat-card blue">
              <div className="stat-label">Bills (count)</div>
              <div className="stat-value">{report.total_sales}</div>
            </div>
            <div className="stat-card green">
              <div className="stat-label">Total revenue</div>
              <div className="stat-value">₹{report.total_revenue.toFixed(2)}</div>
            </div>
            <div className="stat-card orange">
              <div className="stat-label">Cash Collection</div>
              <div className="stat-value">₹{paymentBreakdown.cash.toFixed(2)}</div>
            </div>
            <div className="stat-card purple">
              <div className="stat-label">Online Collection</div>
              <div className="stat-value">₹{paymentBreakdown.online.toFixed(2)}</div>
            </div>
          </div>

          <div className="report-table-wrap">
            <table className="sales-table report-data-table">
              <thead>
                <tr>
                  <th>Bill ref</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Salesman</th>
                  <th>Phone</th>
                  <th>Items</th>
                  <th className="num">Total</th>
                  <th className="num">Discount</th>
                  <th className="num">Final</th>
                  <th className="num">Payment</th>
                  <th className="no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {report.sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="mono">{formatBillRef(sale.sale_date, sale.id)}</td>
                    <td>{sale.sale_date}</td>
                    <td>{sale.customer_name}</td>
                    <td>{sale.salesperson_name || '—'}</td>
                    <td>{sale.phone || '—'}</td>
                    <td>
                      <span className="item-count">{sale.sales_items.length} items</span>
                      <div className="sale-items">
                        {sale.sales_items.map((item, idx) => (
                          <div key={idx}>
                            {item.products?.product_code ?? item.product_code} × {item.quantity}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="num">₹{Number(sale.total_amount).toFixed(2)}</td>
                    <td className="num">₹{Number(sale.discount).toFixed(2)}</td>
                    <td className="num strong">₹{Number(sale.final_amount).toFixed(2)}</td>
                    <td className="num">
                      <span className={sale.payment_mode === 'cash' ? 'cash-mode' : 'online-mode'}>
                        {sale.payment_mode === 'cash' ? 'Cash' : 'Online'}
                      </span>
                    </td>
                    <td className="no-print">
                      <div className="bill-actions">
                        <button
                          type="button"
                          className="sales-report-view-bill-btn"
                          disabled={loadingBillId === sale.id}
                          onClick={() => openBill(sale.id)}
                        >
                          {loadingBillId === sale.id ? '…' : 'View'}
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              className="sales-report-edit-btn"
                              onClick={() => openEditBill(sale)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="sales-report-delete-btn"
                              onClick={() => handleDeleteBill(sale.id)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="print-btn no-print" onClick={handlePrint}>
            Print / PDF
          </button>
        </>
      )}

      {billData && (
        <div
          className="sales-report-bill-overlay no-print"
          role="presentation"
          onClick={() => setBillData(null)}
          onKeyDown={(e) => e.key === 'Escape' && setBillData(null)}
        >
          <div className="sales-report-bill-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <Bill billData={billData} onClose={() => setBillData(null)} />
          </div>
        </div>
      )}

      {editBillData && (
        <div
          className="sales-report-bill-overlay no-print"
          role="presentation"
          onClick={() => setEditBillData(null)}
          onKeyDown={(e) => e.key === 'Escape' && setEditBillData(null)}
        >
          <div className="sales-report-edit-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <EditSaleBill
              sale={editBillData}
              onCancel={() => setEditBillData(null)}
              onSaved={handleBillSaved}
              onDeleted={handleBillDeleted}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReport;