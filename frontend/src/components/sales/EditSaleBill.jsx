import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { productService } from '../../services/productService';
import { saleService } from '../../services/saleService';
import './CreateSale.css';

const EditSaleBill = ({ sale, onCancel, onSaved, onDeleted }) => {
  const [brandSearch, setBrandSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [pricingMode, setPricingMode] = useState('product');
  const [manualPrice, setManualPrice] = useState('');
  const [customerName, setCustomerName] = useState(sale.customer_name || '');
  const [phone, setPhone] = useState(sale.phone || '');
  const [discountPercent, setDiscountPercent] = useState(Number(sale.discount_percentage || 0));
  const [lines, setLines] = useState(() =>
    (sale.sales_items || []).map((si) => ({
      product_code: si.product_code,
      product_name: si.products
        ? `${si.products.brand_name}_${si.products.article_number}`
        : si.product_code,
      quantity: si.quantity,
      sell_price: Number(si.sell_price),
      total: Number(si.total),
    }))
  );
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const searchProducts = useCallback(async () => {
    if (brandSearch.length <= 1) {
      setProducts([]);
      return;
    }
    setLoadingSearch(true);
    try {
      const response = await productService.getByBrand(brandSearch);
      setProducts(response.data);
    } catch {
      setProducts([]);
    } finally {
      setLoadingSearch(false);
    }
  }, [brandSearch]);

  useEffect(() => {
    const t = setTimeout(() => searchProducts(), 300);
    return () => clearTimeout(t);
  }, [searchProducts]);

  const getUnitPrice = () => {
    if (!selectedProduct) return 0;
    if (pricingMode === 'manual') return Number(manualPrice || 0);
    return Number(selectedProduct.sell_price || 0);
  };

  const addLine = () => {
    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }
    const unitPrice = getUnitPrice();
    if (!unitPrice || unitPrice <= 0) {
      toast.error('Please enter a valid selling price');
      return;
    }
    if (quantity < 1) {
      toast.error('Invalid quantity');
      return;
    }
    const existing = lines.find((l) => l.product_code === selectedProduct.product_code);
    if (existing) {
      setLines((prev) =>
        prev.map((l) =>
          l.product_code === selectedProduct.product_code
            ? {
                ...l,
                quantity: l.quantity + quantity,
                sell_price: unitPrice,
                total: (l.quantity + quantity) * unitPrice,
              }
            : l
        )
      );
      toast.success('Item quantity updated');
    } else {
      setLines((prev) => [
        ...prev,
        {
          product_code: selectedProduct.product_code,
          product_name: `${selectedProduct.brand_name}_${selectedProduct.article_number}`,
          quantity,
          sell_price: unitPrice,
          total: quantity * unitPrice,
        },
      ]);
      toast.success('Item added');
    }
    setSelectedProduct(null);
    setQuantity(1);
    setBrandSearch('');
    setProducts([]);
    setManualPrice('');
  };

  const removeLine = (index) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index, field, value) => {
    setLines((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, [field]: value };
        const q = Number(next.quantity || 0);
        const sp = Number(next.sell_price || 0);
        next.total = q * sp;
        return next;
      })
    );
  };

  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const discountAmount = subtotal * (Number(discountPercent || 0) / 100);
  const finalPreview = subtotal - discountAmount;

  const handleSave = async () => {
    if (lines.length === 0) {
      toast.error('Add at least one line item');
      return;
    }
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        items: lines.map((l) => ({
          product_code: l.product_code,
          quantity: l.quantity,
          sell_price: l.sell_price,
        })),
        customer_name: customerName.trim(),
        phone,
        discount_percentage: Number(discountPercent || 0),
        salesperson_id: sale.salesperson_id,
        salesperson_name: sale.salesperson_name,
      };
      const res = await saleService.update(sale.id, payload);
      toast.success('Bill updated');
      onSaved(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update bill');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this bill permanently? Stock will be restored.')) return;
    setDeleting(true);
    try {
      await saleService.remove(sale.id);
      toast.success('Bill deleted');
      onDeleted();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete bill');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="create-sale-container edit-sale-bill">
      <div className="sale-section">
        <h2>Edit bill</h2>
        <p className="edit-sale-hint">Change lines, customer, or discount. Stock is adjusted when you save.</p>

        <input
          type="text"
          className="search-input"
          placeholder="Search to add a product…"
          value={brandSearch}
          onChange={(e) => setBrandSearch(e.target.value)}
        />
        {loadingSearch && <div className="loading">Searching…</div>}
        {products.length > 0 && (
          <div className="search-results">
            {products.map((product) => (
              <button
                key={product.product_code}
                type="button"
                className={`search-result-item ${selectedProduct?.product_code === product.product_code ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedProduct(product);
                  setPricingMode('product');
                  setManualPrice(String(product.sell_price));
                }}
              >
                <span className="product-code">{product.product_code}</span>
                <span className="product-price">₹{product.sell_price}</span>
                <span className="product-stock">Stock: {product.stock_qty}</span>
              </button>
            ))}
          </div>
        )}

        {selectedProduct && (
          <>
            <div className="pricing-mode">
              <label>
                <input
                  type="radio"
                  name="editPricingMode"
                  checked={pricingMode === 'product'}
                  onChange={() => setPricingMode('product')}
                />
                Use product price
              </label>
              <label>
                <input
                  type="radio"
                  name="editPricingMode"
                  checked={pricingMode === 'manual'}
                  onChange={() => setPricingMode('manual')}
                />
                Custom price
              </label>
            </div>
            {pricingMode === 'manual' && (
              <input
                type="number"
                className="quantity-input"
                min="0"
                step="0.01"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
              />
            )}
            <input
              type="number"
              className="quantity-input"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
            />
            <button type="button" className="add-to-cart-btn" onClick={addLine}>
              Add line
            </button>
          </>
        )}

        <h3>Line items ({lines.length})</h3>
        <div className="cart-items">
          {lines.length === 0 ? (
            <div className="empty-cart">
              <p>No items</p>
            </div>
          ) : (
            lines.map((item, index) => (
              <div key={`${item.product_code}-${index}`} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.product_name}</div>
                  <div className="cart-item-details">
                    <span>Qty:</span>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateLine(index, 'quantity', Number(e.target.value))}
                    />
                    <span>Price:</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.sell_price}
                      onChange={(e) => updateLine(index, 'sell_price', Number(e.target.value))}
                    />
                    <span>= ₹{item.total.toFixed(2)}</span>
                  </div>
                </div>
                <button type="button" className="cart-item-remove" onClick={() => removeLine(index)}>
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sale-section">
        <h2>Customer & totals</h2>
        <div className="form-group">
          <label>Customer name *</label>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Discount (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="bill-summary">
          <div className="summary-row">
            <span>Subtotal:</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {(discountPercent || 0) > 0 ? (
            <div className="summary-row">
              <span>Discount ({discountPercent}%):</span>
              <span className="discount-amount">−₹{discountAmount.toFixed(2)}</span>
            </div>
          ) : null}
          <div className="summary-row total">
            <span>Total:</span>
            <span className="total-amount">₹{finalPreview.toFixed(2)}</span>
          </div>
        </div>

        <div className="edit-sale-actions">
          <button type="button" className="generate-bill-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" className="close-btn" onClick={onCancel} disabled={saving || deleting}>
            Cancel
          </button>
          <button
            type="button"
            className="edit-sale-delete-btn"
            onClick={handleDelete}
            disabled={saving || deleting}
          >
            {deleting ? 'Deleting…' : 'Delete bill'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditSaleBill;
