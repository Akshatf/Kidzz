import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { reportService } from '../../services/reportService';
import { saleService } from '../../services/saleService';
import { formatBillRef } from '../../utils/billRef';
import { mapSaleToBillData } from '../../utils/saleBillData';
import Bill from '../sales/Bill';
import EditSaleBill from '../sales/EditSaleBill';
import './AdminDashboard.css';

function formatINR(n) {
  return `₹${Number(n || 0).toFixed(2)}`;
}

function periodRange(period) {
  const end = new Date();
  const endStr = end.toISOString().split('T')[0];
  if (period === 'all') {
    return { start_date: '', end_date: '' };
  }
  const start = new Date(end);
  if (period === '7d') {
    start.setDate(start.getDate() - 6);
  } else if (period === '30d') {
    start.setDate(start.getDate() - 29);
  } else if (period === '1y') {
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
  }
  const startStr = start.toISOString().split('T')[0];
  return { start_date: startStr, end_date: endStr };
}

const AdminDashboard = ({ currentUser }) => {
  const [salesReport, setSalesReport] = useState(null);
  const [stockReport, setStockReport] = useState(null);
  const [currentDaySales, setCurrentDaySales] = useState(null);
  const [openSalespersonId, setOpenSalespersonId] = useState(null);
  const [billData, setBillData] = useState(null);
  const [rawSale, setRawSale] = useState(null);
  const [billModalMode, setBillModalMode] = useState(null);
  const [loadingBillId, setLoadingBillId] = useState(null);
  const [salesPeriod, setSalesPeriod] = useState('all');
  const amountsVisible = true;

  const reportParams = useMemo(() => periodRange(salesPeriod), [salesPeriod]);

  const load = useCallback(async () => {
    try {
      const [sales, stock] = await Promise.all([
        reportService.getSalesReport(reportParams),
        reportService.getStockReport({}),
      ]);
      setSalesReport(sales.data);
      setStockReport(stock.data);
    } catch (error) {
      toast.error('Error loading admin dashboard');
    }
  }, [reportParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const loadCurrentDaySales = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await reportService.getSalesReport({ 
          start_date: today, 
          end_date: today 
        });
        setCurrentDaySales(response.data);
      } catch (error) {
        console.error('Error loading current day sales:', error);
      }
    };
    loadCurrentDaySales();
  }, []);

  const openBill = async (saleId) => {
    setLoadingBillId(saleId);
    try {
      const res = await saleService.getById(saleId);
      setRawSale(res.data);
      setBillData(mapSaleToBillData(res.data));
      setBillModalMode('view');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not load bill');
    } finally {
      setLoadingBillId(null);
    }
  };

  const closeBillModal = () => {
    setBillData(null);
    setRawSale(null);
    setBillModalMode(null);
  };

  const handleBillSaved = (updated) => {
    setRawSale(updated);
    setBillData(mapSaleToBillData(updated));
    setBillModalMode('view');
    load();
  };

  const handleBillDeleted = () => {
    closeBillModal();
    load();
  };

  if (!salesReport || !stockReport) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const salespersons = Array.isArray(salesReport.salespersons) ? salesReport.salespersons : [];
  const sales = Array.isArray(salesReport.sales) ? salesReport.sales : [];
  const products = Array.isArray(stockReport.products) ? stockReport.products : [];

  const money = (v) => formatINR(v);

  return (
    <div className="admin-dashboard">
      <h2>Admin dashboard</h2>

      <div className="admin-period-row no-print">
        <span className="admin-period-label">Sales period</span>
        <div className="admin-period-chips">
          {[
            { id: '7d', label: 'Last 7 days' },
            { id: '30d', label: 'Last month' },
            { id: '1y', label: 'Last year' },
            { id: 'all', label: 'All time' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              className={`admin-period-chip ${salesPeriod === p.id ? 'active' : ''}`}
              onClick={() => setSalesPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-cards">
        <div className="admin-card">
          <span>Today's Sales</span>
          <strong>{money(currentDaySales?.total_revenue || 0)}</strong>
          <small>{currentDaySales?.total_sales || 0} bills</small>
        </div>
        {/* <div className="admin-card">
          <span>Total sales amount</span>
          <strong>{money(salesReport.total_revenue)}</strong>
        </div> */}
        {/* <div className="admin-card">
          <span>Total bills</span>
          <strong>{salesReport.total_sales}</strong>
        </div> */}
        {/* <div className="admin-card">
          <span>Total stock qty</span>
          <strong>{products.reduce((sum, p) => sum + p.stock_qty, 0)}</strong>
        </div> */}
      </div>

      <h3>Sales by salesman</h3>
      <p className="admin-sales-hint">Click a salesman to see their bills, then open a bill to view the full receipt.</p>

      <table className="admin-sales-table">
        <thead>
          <tr>
            <th>Salesman</th>
            <th>Bills</th>
            <th>Total amount</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {salespersons.map((sp) => {
            const spSales = sales
              .filter((s) => s.salesperson_id === sp.id)
              .sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date) || b.id - a.id);
            const total = spSales.reduce((sum, s) => sum + Number(s.final_amount || 0), 0);
            const expanded = openSalespersonId === sp.id;

            return (
              <React.Fragment key={sp.id}>
                <tr
                  className={`admin-sp-row ${expanded ? 'admin-sp-row-open' : ''}`}
                  onClick={() => setOpenSalespersonId(expanded ? null : sp.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenSalespersonId(expanded ? null : sp.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-expanded={expanded}
                >
                  <td>
                    <strong>{sp.name}</strong>
                    <span className="admin-sp-username"> ({sp.username})</span>
                  </td>
                  <td>{spSales.length}</td>
                  <td>{money(total)}</td>
                  <td className="admin-sp-chevron">{expanded ? '▼' : '▶'}</td>
                </tr>
                {expanded && (
                  <tr className="admin-bills-row">
                    <td colSpan={4}>
                      {spSales.length === 0 ? (
                        <div className="admin-no-bills">No bills for this salesman yet.</div>
                      ) : (
                        <table className="admin-bills-nested">
                          <thead>
                            <tr>
                              <th>Bill ref</th>
                              <th>Date</th>
                              <th>Customer</th>
                              <th className="num">Final</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {spSales.map((sale) => (
                              <tr key={sale.id}>
                                <td className="mono">{formatBillRef(sale.sale_date, sale.id)}</td>
                                <td>{sale.sale_date}</td>
                                <td>{sale.customer_name}</td>
                                <td className="num">{money(sale.final_amount)}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="admin-view-bill-btn"
                                    disabled={loadingBillId === sale.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openBill(sale.id);
                                    }}
                                  >
                                    {loadingBillId === sale.id ? 'Loading…' : 'View bill'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {billModalMode && rawSale && (
        <div
          className="admin-bill-overlay no-print"
          role="presentation"
          onClick={() => {
            if (billModalMode === 'view') closeBillModal();
          }}
          onKeyDown={(e) => e.key === 'Escape' && closeBillModal()}
        >
          <div
            className={`admin-bill-modal ${billModalMode === 'edit' ? 'admin-bill-modal-wide' : ''}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {billModalMode === 'view' && billData ? (
              <>
                <div className="admin-bill-toolbar">
                  <button type="button" className="admin-bill-tool-btn" onClick={() => setBillModalMode('edit')}>
                    Edit bill
                  </button>
                  <button type="button" className="admin-bill-tool-btn ghost" onClick={closeBillModal}>
                    Close
                  </button>
                </div>
                <Bill billData={billData} onClose={closeBillModal} />
              </>
            ) : billModalMode === 'edit' ? (
              <>
                <div className="admin-bill-toolbar">
                  <button type="button" className="admin-bill-tool-btn ghost" onClick={() => setBillModalMode('view')}>
                    Back to bill
                  </button>
                  <button type="button" className="admin-bill-tool-btn ghost" onClick={closeBillModal}>
                    Close
                  </button>
                </div>
                <EditSaleBill
                  sale={rawSale}
                  onCancel={() => setBillModalMode('view')}
                  onSaved={handleBillSaved}
                  onDeleted={handleBillDeleted}
                />
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;