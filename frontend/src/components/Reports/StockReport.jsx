import React, { useState, useEffect, useCallback } from 'react';
import { reportService } from '../../services/reportService';
import toast from 'react-hot-toast';
import { SHOP } from '../../config/shop';
import './StockReport.css';

const StockReport = ({ currentUser }) => {
  const isAdmin = currentUser?.role === 'admin';
  const [report, setReport] = useState(null);
  const [filters, setFilters] = useState({
    gender: '',
    category: '',
    brand: '',
  });
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reportService.getStockReport(filters);
      setReport(response.data);
    } catch (error) {
      toast.error('Error fetching stock report');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const filterSummary = [
    filters.gender && `Gender: ${filters.gender}`,
    filters.category && `Category: ${filters.category}`,
    filters.brand && `Brand contains: ${filters.brand}`,
  ]
    .filter(Boolean)
    .join(' · ') || 'All products';

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="stock-report-container report-document">
      <header className="report-screen-header no-print">
        <h2>Stock report</h2>
      </header>

      <div className="report-print-header print-only-block">
        <div className="report-print-brand">{SHOP.name}</div>
        <div className="report-print-address">{SHOP.addressLines.join(' · ')}</div>
        <h1 className="report-print-title">Stock report</h1>
        <div className="report-print-meta">
          <span>Filters: {filterSummary}</span>
          <span>Generated: {generatedAt}</span>
        </div>
      </div>

      <div className="report-filters no-print">
        <div className="filter-field">
          <label>Gender</label>
          <select name="gender" value={filters.gender} onChange={handleFilterChange}>
            <option value="">All</option>
            <option value="boy">Boy</option>
            <option value="girl">Girl</option>
          </select>
        </div>
        <div className="filter-field">
          <label>Category</label>
          <select name="category" value={filters.category} onChange={handleFilterChange}>
            <option value="">All</option>
            <option value="regular">Regular</option>
            <option value="shorts">Shorts</option>
            <option value="tshirt">T-Shirt</option>
            <option value="jeans">Jeans</option>
          </select>
        </div>
        <div className="filter-field">
          <label>Brand</label>
          <input
            type="text"
            name="brand"
            value={filters.brand}
            onChange={handleFilterChange}
            placeholder="Search by brand..."
          />
        </div>
      </div>

      {report && (
        <>
          <div className="report-summary-inline print-only-block">
            <p>
              <strong>Filters:</strong> {filterSummary}
            </p>
          </div>

          <div className="stats-cards">
            <div className="stat-card blue">
              <div className="stat-label">SKU count</div>
              <div className="stat-value">{report.total_products}</div>
            </div>
            <div className="stat-card green">
              <div className="stat-label">{isAdmin ? 'Stock value (cost)' : 'Stock units'}</div>
              <div className="stat-value">
                {isAdmin
                  ? `₹${report.total_stock_value.toFixed(2)}`
                  : report.products.reduce((sum, p) => sum + p.stock_qty, 0)}
              </div>
            </div>
            {isAdmin ? (
              <div className="stat-card purple">
                <div className="stat-label">Stock value (MRP / SP)</div>
                <div className="stat-value">₹{report.total_sales_value.toFixed(2)}</div>
              </div>
            ) : null}
          </div>

          <div className="report-table-wrap">
            <table className="stock-table report-data-table">
              <thead>
                <tr>
                  <th>Product code</th>
                  <th>Brand</th>
                  <th>Gender</th>
                  <th>Category</th>
                  <th className="num">Stock</th>
                  {isAdmin && <th className="num">Cost</th>}
                  <th className="num">Sell price</th>
                </tr>
              </thead>
              <tbody>
                {report.products.map((product, index) => (
                  <tr key={index}>
                    <td className="mono">{product.product_code}</td>
                    <td>{product.brand_name}</td>
                    <td>{product.gender}</td>
                    <td>{product.category}</td>
                    <td className="num">{product.stock_qty}</td>
                    {isAdmin && <td className="num">₹{Number(product.cost_price).toFixed(2)}</td>}
                    <td className="num strong">₹{Number(product.sell_price).toFixed(2)}</td>
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
    </div>
  );
};

export default StockReport;
