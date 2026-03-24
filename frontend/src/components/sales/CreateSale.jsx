import React, { useState, useEffect, useCallback, useRef } from "react";
import { productService } from "../../services/productService";
import { saleService } from "../../services/saleService";
import toast from "react-hot-toast";
import Bill from "./Bill";
import "./CreateSale.css";

const draftKey = (userId) => `inventory_create_sale_draft_${userId || "anon"}`;

const CreateSale = ({ currentUser }) => {
  const [brandSearch, setBrandSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [pricingMode, setPricingMode] = useState("product");
  const [manualPrice, setManualPrice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [showBill, setShowBill] = useState(false);
  const [billData, setBillData] = useState(null);
  const [loading, setLoading] = useState(false);
  const draftRestored = useRef(false);
  const cartContainerRef = useRef(null);

  const searchProducts = useCallback(async () => {
    if (brandSearch.length <= 1) {
      setProducts([]);
      return;
    }
    setLoading(true);
    try {
      const response = await productService.getByBrand(brandSearch);
      setProducts(response.data);
    } catch (error) {
      console.error("Error searching products:", error);
    } finally {
      setLoading(false);
    }
  }, [brandSearch]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchProducts();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchProducts]);

  useEffect(() => {
    if (!currentUser?.id || draftRestored.current) return;
    try {
      const raw = sessionStorage.getItem(draftKey(currentUser.id));
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d.cart)) setCart(d.cart);
        if (typeof d.customerName === "string") setCustomerName(d.customerName);
        if (typeof d.phone === "string") setPhone(d.phone);
        if (d.discountPercent != null)
          setDiscountPercent(Number(d.discountPercent) || 0);
        if (d.paymentMode) setPaymentMode(d.paymentMode);
      }
    } catch {
      /* ignore */
    }
    draftRestored.current = true;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.id || !draftRestored.current) return;
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(
          draftKey(currentUser.id),
          JSON.stringify({
            cart,
            customerName,
            phone,
            discountPercent,
            paymentMode,
          }),
        );
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [cart, customerName, phone, discountPercent, paymentMode, currentUser]);

  // Auto-scroll after adding to cart
  useEffect(() => {
    if (cartContainerRef.current && cart.length > 0) {
      cartContainerRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [cart]);

  const clearDraft = () => {
    if (currentUser?.id) {
      try {
        sessionStorage.removeItem(draftKey(currentUser.id));
      } catch {
        /* ignore */
      }
    }
  };

  const discardDraft = () => {
    setCart([]);
    setCustomerName("");
    setPhone("");
    setDiscountPercent(0);
    setPaymentMode("cash");
    clearDraft();
    toast.success("Draft cleared");
  };

  const getUnitPrice = () => {
    if (!selectedProduct) return 0;
    if (pricingMode === "manual") return Number(manualPrice || 0);
    return Number(selectedProduct.sell_price || 0);
  };

  const addToCart = () => {
    if (!selectedProduct) {
      toast.error("Please select a product");
      return;
    }

    if (quantity > selectedProduct.stock_qty) {
      toast.error(`Insufficient stock! Only ${selectedProduct.stock_qty} left`);
      return;
    }

    const unitPrice = getUnitPrice();
    if (!unitPrice || unitPrice <= 0) {
      toast.error("Please enter a valid selling price");
      return;
    }

    const existingItem = cart.find(
      (item) => item.product_code === selectedProduct.product_code,
    );

    if (existingItem) {
      if (existingItem.quantity + quantity > selectedProduct.stock_qty) {
        toast.error("Insufficient stock");
        return;
      }
      setCart(
        cart.map((item) =>
          item.product_code === selectedProduct.product_code
            ? {
                ...item,
                quantity: item.quantity + quantity,
                sell_price: unitPrice,
                total: (item.quantity + quantity) * unitPrice,
              }
            : item,
        ),
      );
      toast.success("Item quantity updated");
    } else {
      setCart([
        ...cart,
        {
          product_code: selectedProduct.product_code,
          product_name: `${selectedProduct.brand_name}_${selectedProduct.article_number}`,
          quantity: quantity,
          sell_price: unitPrice,
          total: quantity * unitPrice,
        },
      ]);
      toast.success("Item added to cart");
    }

    setSelectedProduct(null);
    setQuantity(1);
    setBrandSearch("");
    setProducts([]);
    setManualPrice("");
  };

  const removeFromCart = (index) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
    toast.success("Item removed from cart");
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    const discountAmount = subtotal * (Number(discountPercent || 0) / 100);
    return {
      subtotal,
      discountAmount,
      final: subtotal - discountAmount,
    };
  };

  const updateCartItem = (index, field, value) => {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, [field]: value };
        const safeQty = Number(next.quantity || 0);
        const safePrice = Number(next.sell_price || 0);
        next.total = safeQty * safePrice;
        return next;
      }),
    );
  };

  const handleGenerateBill = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (!customerName) {
      toast.error("Please enter customer name");
      return;
    }

    const items = cart.map((item) => ({
      product_code: item.product_code,
      quantity: item.quantity,
      sell_price: item.sell_price,
    }));

    const totals = calculateTotal();

    try {
      const response = await saleService.create({
        items,
        customer_name: customerName,
        phone,
        discount_percentage: Number(discountPercent || 0),
        salesperson_id: currentUser?.id,
        salesperson_name: currentUser?.name,
        payment_mode: paymentMode,
      });

      setBillData({
        ...response.data.sale,
        items: cart,
        subtotal: totals.subtotal,
        discount_percentage: Number(discountPercent || 0),
        discount_amount: totals.discountAmount,
      });
      setShowBill(true);

      // Reset form
      setCart([]);
      setCustomerName("");
      setPhone("");
      setDiscountPercent(0);
      setPaymentMode("cash");
      clearDraft();

      toast.success("Bill generated successfully!");
    } catch (error) {
      toast.error(error.response?.data?.error || "Error generating bill");
    }
  };

  const totals = calculateTotal();

  if (showBill && billData) {
    return <Bill billData={billData} onClose={() => setShowBill(false)} />;
  }

  return (
    <div className="create-sale-container">
      <div className="sale-section">
        <h2>👤 Customer & Payment</h2>

        <div className="form-group">
          <label>Customer Name *</label>
          <input
            type="text"
            placeholder="Enter customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Phone Number</label>
          <input
            type="tel"
            placeholder="Optional"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Discount (%)</label>
          <input
            type="number"
            value={discountPercent}
            onChange={(e) =>
              setDiscountPercent(parseFloat(e.target.value) || 0)
            }
            min="0"
            max="100"
            step="0.01"
            placeholder="0"
          />
        </div>

        <div className="form-group">
          <label>Payment Mode *</label>
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            required
          >
            <option value="cash">Cash</option>
            <option value="online">Online</option>
          </select>
        </div>

        <div className="bill-summary">
          <div className="summary-row">
            <span>Subtotal:</span>
            <span>₹{totals.subtotal.toFixed(2)}</span>
          </div>
          {(Number(discountPercent) || 0) > 0 ? (
            <div className="summary-row">
              <span>Discount ({discountPercent || 0}%):</span>
              <span className="discount-amount">
                -₹{totals.discountAmount.toFixed(2)}
              </span>
            </div>
          ) : null}
          <div className="summary-row total">
            <span>Total Amount:</span>
            <span className="total-amount">₹{totals.final.toFixed(2)}</span>
          </div>
        </div>

        <button className="generate-bill-btn" onClick={handleGenerateBill}>
          🧾 Generate Bill & Print
        </button>
      </div>
      <div className="sale-section">
        <div className="sale-draft-bar no-print">
          <span className="sale-draft-hint">
            Your cart and customer details are saved until you generate a bill
            or clear them.
          </span>
          <button
            type="button"
            className="sale-discard-draft-btn"
            onClick={discardDraft}
          >
            Clear saved data
          </button>
        </div>
        <h2>🛍️ Add Items to Cart</h2>

        <input
          type="text"
          className="search-input"
          placeholder="🔍 Search by brand, product code, or article number..."
          value={brandSearch}
          onChange={(e) => setBrandSearch(e.target.value)}
        />

        {loading && <div className="loading">Searching...</div>}

        {products.length > 0 && (
          <div className="search-results">
            {products.map((product) => (
              <button
                key={product.product_code}
                type="button"
                className={`search-result-item ${selectedProduct?.product_code === product.product_code ? "selected" : ""}`}
                onClick={() => {
                  setSelectedProduct(product);
                  setPricingMode("product");
                  setManualPrice(String(product.sell_price));
                }}
              >
                <span className="product-code">{product.product_code}</span>
                <span className="product-price">₹{product.sell_price}</span>
                <span className="product-stock">
                  Stock: {product.stock_qty}
                </span>
              </button>
            ))}
          </div>
        )}

        {selectedProduct && (
          <>
            <div className="price-box">
              <div className="price-row">
                <span>Product:</span>
                <strong>{selectedProduct.product_code}</strong>
              </div>
              <div className="price-row">
                <span>Default Price:</span>
                <strong>₹{selectedProduct.sell_price}</strong>
              </div>
              <div className="price-row">
                <span>Available Stock:</span>
                <strong
                  className={selectedProduct.stock_qty < 10 ? "low-stock" : ""}
                >
                  {selectedProduct.stock_qty} units
                </strong>
              </div>
            </div>

            <div className="pricing-mode">
              <label>
                <input
                  type="radio"
                  name="pricingMode"
                  value="product"
                  checked={pricingMode === "product"}
                  onChange={(e) => setPricingMode(e.target.value)}
                />
                Use product selling price
              </label>
              <label>
                <input
                  type="radio"
                  name="pricingMode"
                  value="manual"
                  checked={pricingMode === "manual"}
                  onChange={(e) => setPricingMode(e.target.value)}
                />
                Set custom price
              </label>
            </div>

            {pricingMode === "manual" && (
              <input
                type="number"
                className="quantity-input"
                placeholder="Enter custom selling price"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                min="0"
                step="0.01"
              />
            )}

            <input
              type="number"
              className="quantity-input"
              placeholder="Quantity"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              min="1"
              max={selectedProduct.stock_qty}
            />

            <div className="effective-price">
              Effective Price: <strong>₹{getUnitPrice().toFixed(2)}</strong> ×{" "}
              {quantity} ={" "}
              <strong>₹{(getUnitPrice() * quantity).toFixed(2)}</strong>
            </div>

            <button className="add-to-cart-btn" onClick={addToCart}>
              ➕ Add to Cart
            </button>
          </>
        )}

        <h3>🛒 Cart Items ({cart.length})</h3>
        <div className="cart-items" ref={cartContainerRef}>
          {cart.length === 0 ? (
            <div className="empty-cart">
              <p>Your cart is empty</p>
              <small>Search and add products to start billing</small>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={index} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.product_name}</div>
                  <div className="cart-item-details">
                    <span>Qty:</span>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateCartItem(
                          index,
                          "quantity",
                          Number(e.target.value),
                        )
                      }
                    />
                    <span>Price:</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.sell_price}
                      onChange={(e) =>
                        updateCartItem(
                          index,
                          "sell_price",
                          Number(e.target.value),
                        )
                      }
                    />
                    <span>= ₹{item.total.toFixed(2)}</span>
                  </div>
                </div>
                <button
                  className="cart-item-remove"
                  onClick={() => removeFromCart(index)}
                >
                  ✕ Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateSale;
