import React, { useState } from 'react';
import { productService } from '../../services/productService';
import toast from 'react-hot-toast';
import './AddProduct.css';

const AddProduct = () => {
  const [formData, setFormData] = useState({
    brand_name: '',
    article_number: '',
    gender: 'boy',
    category: 'regular',
    cost_price: '',
    pricing_mode: 'percentage',
    markup_percentage: '40',
    sell_price: '',
    supplier_name: '',
    quantity: '',
    purchase_date: new Date().toISOString().split('T')[0],
    payment_status: 'PAID'
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const cost = parseFloat(formData.cost_price || 0);
      const sellPrice =
        formData.pricing_mode === 'manual'
          ? parseFloat(formData.sell_price || 0)
          : cost + (cost * parseFloat(formData.markup_percentage || 0)) / 100;

      await productService.create({
        ...formData,
        sell_price: sellPrice
      });
      toast.success('Product added successfully!');
      setFormData({
        brand_name: '',
        article_number: '',
        gender: 'boy',
        category: 'regular',
        cost_price: '',
        pricing_mode: 'percentage',
        markup_percentage: '40',
        sell_price: '',
        supplier_name: '',
        quantity: '',
        purchase_date: new Date().toISOString().split('T')[0],
        payment_status: 'PAID'
      });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error adding product');
    }
  };

  const cost = parseFloat(formData.cost_price || 0);
  const previewSellPrice =
    formData.pricing_mode === 'manual'
      ? parseFloat(formData.sell_price || 0)
      : cost + (cost * parseFloat(formData.markup_percentage || 0)) / 100;

  return (
    <div className="add-product-container">
      <h2>Add New Product</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Brand Name *</label>
            <input
              type="text"
              name="brand_name"
              value={formData.brand_name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Article Number *</label>
            <input
              type="text"
              name="article_number"
              value={formData.article_number}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Gender *</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              required
            >
              <option value="boy">Boy</option>
              <option value="girl">Girl</option>
            </select>
          </div>
          <div className="form-group">
            <label>Category *</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="regular">Regular</option>
              <option value="shorts">Shorts</option>
              <option value="tshirt">T-Shirt</option>
              <option value="jeans">Jeans</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Cost Price (₹) *</label>
            <input
              type="number"
              name="cost_price"
              value={formData.cost_price}
              onChange={handleChange}
              required
              step="0.01"
            />
          </div>
          <div className="form-group">
            <label>Selling Price Type</label>
            <select
              name="pricing_mode"
              value={formData.pricing_mode}
              onChange={handleChange}
            >
              <option value="percentage">Add by % on CP</option>
              <option value="manual">Manual SP</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          {formData.pricing_mode === 'percentage' ? (
            <div className="form-group">
              <label>Profit / Markup (%)</label>
              <input
                type="number"
                name="markup_percentage"
                value={formData.markup_percentage}
                onChange={handleChange}
                min="0"
                step="0.01"
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Selling Price (₹) *</label>
              <input
                type="number"
                name="sell_price"
                value={formData.sell_price}
                onChange={handleChange}
                required={formData.pricing_mode === 'manual'}
                min="0"
                step="0.01"
              />
            </div>
          )}
          <div className="form-group">
            <label>Quantity *</label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              required
              min="1"
            />
          </div>
        </div>

        <div className="price-preview">
          Final Selling Price: <strong>₹{Number.isFinite(previewSellPrice) ? previewSellPrice.toFixed(2) : '0.00'}</strong>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Supplier Name *</label>
            <input
              type="text"
              name="supplier_name"
              value={formData.supplier_name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Purchase Date *</label>
            <input
              type="date"
              name="purchase_date"
              value={formData.purchase_date}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Payment Status *</label>
          <select
            name="payment_status"
            value={formData.payment_status}
            onChange={handleChange}
            required
          >
            <option value="PAID">Paid</option>
            <option value="DUE">Due</option>
          </select>
        </div>

        <button type="submit" className="submit-btn">
          Add Product
        </button>
      </form>
    </div>
  );
};

export default AddProduct;