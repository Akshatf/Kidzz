import React from "react";
import { SHOP } from "../../config/shop";
import { formatBillRef } from "../../utils/billRef";
import "./Bill.css";

const Bill = ({ billData, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const billRef = formatBillRef(billData.sale_date, billData.id);
  const [year, month, day] = billData.sale_date.split("-");

  const dateStr = new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const discountAmt = Number(
    billData.discount_amount ?? billData.discount ?? 0,
  );
  const discountPct = Number(billData.discount_percentage ?? 0);
  const showDiscount = discountAmt > 0.0001 || discountPct > 0.0001;

  return (
    <div className="bill-container">
      <div className="bill-receipt">
        <header className="bill-shop">
          <h1 className="bill-shop-name">{SHOP.name}</h1>
          {SHOP.addressLines.map((line) => (
            <p key={line} className="bill-shop-address">
              {line}
            </p>
          ))}
          <p className="bill-divider">——————————————</p>
          <p className="bill-meta">
            <span>Date: {dateStr}</span>
          </p>
          <p className="bill-meta bill-ref-line">
            <span>Bill ref: {billRef}</span>
          </p>
          <p className="bill-subtitle">Retail bill</p>
        </header>

        <section className="customer-details">
          <p>
            <span className="label">Customer</span>
            <span>{billData.customer_name}</span>
          </p>
          {billData.phone ? (
            <p>
              <span className="label">Phone</span>
              <span>{billData.phone}</span>
            </p>
          ) : null}
          {billData.salesperson_name ? (
            <p>
              <span className="label">Staff</span>
              <span>{billData.salesperson_name}</span>
            </p>
          ) : null}
          <p>
            <span className="label">Payment Mode</span>
            <span
              className={
                billData.payment_mode === "cash" ? "cash-mode" : "online-mode"
              }
            >
              {billData.payment_mode === "cash" ? "Cash" : "Online"}
            </span>
          </p>
        </section>

        <table className="bill-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Rate</th>
              <th className="num">Amt</th>
            </tr>
          </thead>
          <tbody>
            {billData.items.map((item, index) => (
              <tr key={index}>
                <td>{item.product_name}</td>
                <td className="num">{item.quantity}</td>
                <td className="num">₹{Number(item.sell_price).toFixed(2)}</td>
                <td className="num">₹{Number(item.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="bill-total">
          <div className="total-row">
            <span>Subtotal</span>
            <span>₹{Number(billData.subtotal).toFixed(2)}</span>
          </div>
          {showDiscount ? (
            <div className="total-row bill-discount-print">
              <span>Discount ({billData.discount_percentage || 0}%)</span>
              <span>
                −₹
                {Number(
                  billData.discount_amount ?? billData.discount ?? 0,
                ).toFixed(2)}
              </span>
            </div>
          ) : null}
          <div className="total-row final">
            <span>Total</span>
            <span>₹{Number(billData.final_amount).toFixed(2)}</span>
          </div>
        </div>

        <footer className="bill-footer">
          <p>{SHOP.billFooter}</p>
        </footer>
      </div>

      <div className="bill-actions no-print">
        <button type="button" className="print-btn" onClick={handlePrint}>
          Print bill
        </button>
        <button type="button" className="close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default Bill;
