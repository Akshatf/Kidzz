import React, { useState, useEffect, useCallback, useRef } from 'react';
import { reportService } from '../../services/reportService';
import toast from 'react-hot-toast';
import { SHOP } from '../../config/shop';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import './StockReport.css';

const StockReport = ({ currentUser }) => {
  const isAdmin = currentUser?.role === 'admin';
  const reportRef = useRef(null);
  const [report, setReport] = useState(null);
  const [filters, setFilters] = useState({
    gender: '',
    category: '',
    brand: '',
  });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const exportToExcel = () => {
    if (!report || !report.products || report.products.length === 0) {
      toast.error('No data to export');
      return;
    }

    setExporting(true);
    try {
      // Prepare data for Excel
      const exportData = report.products.map(product => ({
        'Product Code': product.product_code,
        'Brand': product.brand_name,
        'Gender': product.gender === 'boy' ? 'Boy' : 'Girl',
        'Category': product.category,
        'Stock Quantity': product.stock_qty,
        ...(isAdmin && { 'Cost Price (₹)': product.cost_price }),
        // 'Sell Price (₹)': product.sell_price,
      }));

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Adjust column widths
      const colWidths = [
        { wch: 20 }, // Product Code
        { wch: 15 }, // Brand
        { wch: 10 }, // Gender
        { wch: 12 }, // Category
        { wch: 12 }, // Stock Quantity
      ];
      if (isAdmin) colWidths.push({ wch: 15 });
      // colWidths.push({ wch: 15 });
      ws['!cols'] = colWidths;

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');

      // Generate filename with date
      const date = new Date().toISOString().split('T')[0];
      const filename = `stock_report_${date}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Error exporting to Excel');
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = () => {
    if (!report || !report.products || report.products.length === 0) {
      toast.error('No data to export');
      return;
    }

    setExporting(true);
    
    // Create a temporary element for PDF export
    const pdfContent = document.createElement('div');
    pdfContent.className = 'pdf-export-content';
    pdfContent.style.padding = '20px';
    pdfContent.style.fontFamily = 'Arial, sans-serif';
    
    // Add header
    pdfContent.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333;">
        <h1 style="margin: 0; font-size: 24px; color: #333;">${SHOP.name}</h1>
        <p style="margin: 5px 0; color: #666;">${SHOP.addressLines.join(' · ')}</p>
        <h2 style="margin: 15px 0 10px; font-size: 20px;">Stock Report</h2>
        <div style="display: flex; justify-content: center; gap: 20px; font-size: 12px; color: #666;">
          <span>Filters: ${getFilterSummary()}</span>
          <span>Generated: ${new Date().toLocaleString('en-IN')}</span>
        </div>
      </div>
    `;

    // Add summary stats
    const totalStockQty = report.products.reduce((sum, p) => sum + p.stock_qty, 0);
    pdfContent.innerHTML += `
      <div style="display: flex; justify-content: space-around; margin-bottom: 30px; gap: 20px;">
        <div style="flex: 1; background: #f0f0f0; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 12px; color: #666;">SKU Count</div>
          <div style="font-size: 24px; font-weight: bold; color: #3498db;">${report.total_products}</div>
        </div>
        <div style="flex: 1; background: #f0f0f0; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 12px; color: #666;">Total Stock Units</div>
          <div style="font-size: 24px; font-weight: bold; color: #27ae60;">${totalStockQty}</div>
        </div>
        ${isAdmin ? `
        <div style="flex: 1; background: #f0f0f0; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 12px; color: #666;">Stock Value (Cost)</div>
          <div style="font-size: 24px; font-weight: bold; color: #9b59b6;">₹${report.total_stock_value.toFixed(2)}</div>
        </div>
        ` : ''}
      </div>
    `;

    // Add table
    let tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background-color: #f5f5f5; border-bottom: 2px solid #ddd;">
            <th style="padding: 10px; text-align: left;">Product Code</th>
            <th style="padding: 10px; text-align: left;">Brand</th>
            <th style="padding: 10px; text-align: left;">Gender</th>
            <th style="padding: 10px; text-align: left;">Category</th>
            <th style="padding: 10px; text-align: right;">Stock</th>
            ${isAdmin ? '<th style="padding: 10px; text-align: right;">Cost (₹)</th>' : ''}
          </tr>
        </thead>
        <tbody>
    `;

    report.products.forEach(product => {
      tableHtml += `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px 10px;">${product.product_code}</td>
          <td style="padding: 8px 10px;">${product.brand_name}</td>
          <td style="padding: 8px 10px;">${product.gender === 'boy' ? 'Boy' : 'Girl'}</td>
          <td style="padding: 8px 10px;">${product.category}</td>
          <td style="padding: 8px 10px; text-align: right;">${product.stock_qty}</td>
          ${isAdmin ? `<td style="padding: 8px 10px; text-align: right;">₹${product.cost_price.toFixed(2)}</td>` : ''}
        </tr>
      `;
    });

    tableHtml += `
        </tbody>
      </table>
    `;

    pdfContent.innerHTML += tableHtml;

    // Add footer
    pdfContent.innerHTML += `
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 10px; color: #999;">
        <p>This is a system-generated report. For any queries, please contact the administrator.</p>
      </div>
    `;

    // Append to body temporarily
    document.body.appendChild(pdfContent);
    
    // Configure PDF options
    const opt = {
      margin: [0.5, 0.5, 0.5, 0.5],
      filename: `stock_report_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, letterRendering: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
    };

    // Generate PDF
    html2pdf().set(opt).from(pdfContent).save()
      .then(() => {
        toast.success('PDF generated successfully');
      })
      .catch((error) => {
        console.error('PDF generation error:', error);
        toast.error('Error generating PDF');
      })
      .finally(() => {
        document.body.removeChild(pdfContent);
        setExporting(false);
      });
  };

  const getFilterSummary = () => {
    const filtersList = [
      filters.gender && `Gender: ${filters.gender === 'boy' ? 'Boy' : 'Girl'}`,
      filters.category && `Category: ${filters.category}`,
      filters.brand && `Brand contains: ${filters.brand}`,
    ].filter(Boolean);
    
    return filtersList.length > 0 ? filtersList.join(' · ') : 'All products';
  };

  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const filterSummary = getFilterSummary();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="stock-report-container report-document" ref={reportRef}>
      <header className="report-screen-header no-print">
        <div className="header-actions">
          <h2>Stock report</h2>
          <div className="export-buttons">
            <button 
              type="button" 
              className="export-excel-btn" 
              onClick={exportToExcel}
              disabled={exporting || !report || report.products?.length === 0}
            >
              Export to Excel
            </button>
            <button 
              type="button" 
              className="export-pdf-btn" 
              onClick={exportToPDF}
              disabled={exporting || !report || report.products?.length === 0}
            >
              Export to PDF
            </button>
            <button 
              type="button" 
              className="print-btn" 
              onClick={handlePrint}
            >
              Print
            </button>
          </div>
        </div>
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

          {/* <div className="stats-cards">
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
          </div> */}

          <div className="report-table-wrap">
            <table className="stock-table report-data-table">
              <thead>
                <tr>
                  <th>Product code</th>
                  <th>Brand</th>
                  <th>Gender</th>
                  <th>Category</th>
                  <th className="num">Stock</th>
                  {isAdmin && <th className="num">Cost (₹)</th>}
                </tr>
              </thead>
              <tbody>
                {report.products.map((product, index) => (
                  <tr key={index}>
                    <td className="mono">{product.product_code}</td>
                    <td>{product.brand_name}</td>
                    <td>{product.gender === 'boy' ? 'Boy' : 'Girl'}</td>
                    <td>{product.category}</td>
                    <td className="num">{product.stock_qty}</td>
                    {isAdmin && <td className="num">₹{Number(product.cost_price).toFixed(2)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="report-footer no-print">
            <div className="total-summary">
              {/* {isAdmin && (
                <div className="total-row">
                  <strong>Total Stock Value:</strong>
                  <span>₹{report.total_stock_value.toFixed(2)}</span>
                </div>
              )} */}
              <div className="total-row">
                <strong>Total Items:</strong>
                <span>{report.products.reduce((sum, p) => sum + p.stock_qty, 0)} units</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StockReport;