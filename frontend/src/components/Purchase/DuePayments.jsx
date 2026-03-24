import React, { useState, useEffect } from 'react';
import { purchaseService } from '../../services/purchaseService';
import toast from 'react-hot-toast';
import './DuePayments.css';

const DuePayments = () => {
  const [dueSuppliers, setDueSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState(null);

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
    setPaymentModal({
      bill: bill,
      paidBy: '',
      paidTo: '',
      paidDate: new Date().toISOString().split('T')[0]
    });
  };

  const confirmPayment = async () => {
    const { bill, paidBy, paidTo, paidDate } = paymentModal;
    
    if (!paidBy.trim()) {
      toast.error('Please enter who made the payment');
      return;
    }

    try {
      if (bill.pay_kind === 'batch' && bill.batch_id != null) {
        await purchaseService.payBatch(bill.batch_id, {
          paid_by: paidBy,
          paid_to: paidTo || null,
          paid_date: paidDate
        });
      } else if (bill.purchase_id != null) {
        await purchaseService.payDue(bill.purchase_id, {
          paid_by: paidBy,
          paid_to: paidTo || null,
          paid_date: paidDate
        });
      } else {
        toast.error('Cannot record payment for this entry');
        return;
      }
      toast.success('Payment recorded successfully');
      setPaymentModal(null);
      fetchDuePayments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error recording payment');
    }
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
    <div className="due-payments-container">
      <h2>Due Payments</h2>
      <p className="due-intro">Pay by supplier bill: one button clears every line on that bill.</p>

      {dueSuppliers.length === 0 ? (
        <div className="success-alert">No pending dues. All payments are cleared.</div>
      ) : (
        dueSuppliers.map((supplierBlock) => (
          <div key={supplierBlock.supplier} className="supplier-card">
            <h3>{supplierBlock.supplier}</h3>
            <div className="total-due">Total due: {formatCurrency(supplierBlock.total_due)}</div>

            {supplierBlock.bills.map((bill, idx) => (
              <div key={`${bill.batch_id ?? 's'}-${bill.purchase_id ?? idx}`} className="purchase-item">
                <div className="purchase-info">
                  {bill.supplier_bill_no ? (
                    <div className="bill-no">Supplier bill: {bill.supplier_bill_no}</div>
                  ) : null}
                  <div className="purchase-date">Date: {formatDate(bill.purchase_date)}</div>
                  <div className="bill-amount">Bill amount: {formatCurrency(bill.total)}</div>
                  {bill.purchased_by && (
                    <div className="purchased-by">Purchased by: {bill.purchased_by}</div>
                  )}
                  <ul className="due-lines">
                    {bill.lines.map((line) => (
                      <li key={line.id}>
                        {line.product_code} × {line.quantity} — {formatCurrency(line.total_amount)}
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

      {paymentModal && (
        <div className="modal-overlay" onClick={() => setPaymentModal(null)}>
          <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Record Payment</h3>
            <div className="modal-content">
              <div className="modal-bill-info">
                <p><strong>Supplier:</strong> {paymentModal.bill.supplier_name}</p>
                <p><strong>Bill No:</strong> {paymentModal.bill.supplier_bill_no || 'N/A'}</p>
                <p><strong>Amount:</strong> {formatCurrency(paymentModal.bill.total)}</p>
              </div>
              
              <div className="form-group">
                <label>Paid by *</label>
                <input
                  type="text"
                  value={paymentModal.paidBy}
                  onChange={(e) => setPaymentModal({...paymentModal, paidBy: e.target.value})}
                  placeholder="Who made the payment?"
                  autoFocus
                />
              </div>
              
              <div className="form-group">
                <label>Paid to (optional)</label>
                <input
                  type="text"
                  value={paymentModal.paidTo}
                  onChange={(e) => setPaymentModal({...paymentModal, paidTo: e.target.value})}
                  placeholder="Recipient name"
                />
              </div>
              
              <div className="form-group">
                <label>Payment date</label>
                <input
                  type="text"
                  value={paymentModal.paidDate}
                  onChange={(e) => setPaymentModal({...paymentModal, paidDate: e.target.value})}
                  placeholder="YYYY-MM-DD"
                />
                <small>Format: YYYY-MM-DD (defaults to today)</small>
              </div>
              
              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => setPaymentModal(null)}>
                  Cancel
                </button>
                <button className="confirm-btn" onClick={confirmPayment}>
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DuePayments;