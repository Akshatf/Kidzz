import React, { useState, useEffect } from 'react';
import { purchaseService } from '../../services/purchaseService';
import toast from 'react-hot-toast';
import './DuePayments.css';

const DuePayments = () => {
  const [dueSuppliers, setDueSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDuePayments();
  }, []);

  const fetchDuePayments = async () => {
    try {
      const response = await purchaseService.getDue();
      setDueSuppliers(response.data);
    } catch (error) {
      toast.error('Error fetching due payments');
    } finally {
      setLoading(false);
    }
  };

  const handlePayBill = async (bill) => {
    try {
      if (bill.pay_kind === 'batch' && bill.batch_id != null) {
        await purchaseService.payBatch(bill.batch_id);
      } else if (bill.purchase_id != null) {
        await purchaseService.payDue(bill.purchase_id);
      } else {
        toast.error('Cannot record payment for this entry');
        return;
      }
      toast.success('Payment recorded');
      fetchDuePayments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error recording payment');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="due-payments-container">
      <h2>Due payments</h2>
      <p className="due-intro">Pay by supplier bill: one button clears every line on that bill.</p>

      {dueSuppliers.length === 0 ? (
        <div className="success-alert">No pending dues. All payments are cleared.</div>
      ) : (
        dueSuppliers.map((supplierBlock) => (
          <div key={supplierBlock.supplier} className="supplier-card">
            <h3>{supplierBlock.supplier}</h3>
            <div className="total-due">Total due: ₹{Number(supplierBlock.total_due).toFixed(2)}</div>

            {supplierBlock.bills.map((bill, idx) => (
              <div key={`${bill.batch_id ?? 's'}-${bill.purchase_id ?? idx}`} className="purchase-item">
                <div className="purchase-info">
                  {bill.supplier_bill_no ? (
                    <div className="bill-no">Supplier bill: {bill.supplier_bill_no}</div>
                  ) : null}
                  <div className="purchase-date">Date: {bill.purchase_date}</div>
                  <div className="bill-amount">Bill amount: ₹{Number(bill.total).toFixed(2)}</div>
                  <ul className="due-lines">
                    {bill.lines.map((line) => (
                      <li key={line.id}>
                        {line.product_code} × {line.quantity} — ₹{Number(line.total_amount).toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </div>
                <button type="button" className="pay-btn" onClick={() => handlePayBill(bill)}>
                  Mark bill paid
                </button>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
};

export default DuePayments;
