const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/storage.json');

// Initialize storage file if it doesn't exist
const initStorage = () => {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = {
            products: [],
            purchases: [],
            sales: [],
            sales_items: [],
            suppliers: []
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    }
};

// Read data from storage
const readData = () => {
    initStorage();
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    let changed = false;
    if (!Array.isArray(data.suppliers)) {
        data.suppliers = [];
        changed = true;
    }
    // Add payment_mode to existing sales if missing
    if (Array.isArray(data.sales)) {
        for (const sale of data.sales) {
            if (!sale.payment_mode) {
                sale.payment_mode = 'cash';
                changed = true;
            }
        }
    }
    if (changed) {
        writeData(data);
    }
    return data;
};

// Write data to storage
const writeData = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// Product operations
const getProducts = () => {
    const data = readData();
    return data.products;
};

const getProductByCode = (productCode) => {
    const data = readData();
    return data.products.find(p => p.product_code === productCode);
};

const saveProduct = (product) => {
    const data = readData();
    data.products.push(product);
    writeData(data);
    return product;
};

const updateProduct = (productCode, updates) => {
    const data = readData();
    const index = data.products.findIndex(p => p.product_code === productCode);
    if (index !== -1) {
        data.products[index] = { ...data.products[index], ...updates };
        writeData(data);
        return data.products[index];
    }
    return null;
};

const deleteProduct = (productCode) => {
    const data = readData();
    data.products = data.products.filter(p => p.product_code !== productCode);
    writeData(data);
};

// Purchase operations
const getPurchases = () => {
    const data = readData();
    return data.purchases;
};

const savePurchase = (purchase) => {
    const data = readData();
    const id = data.purchases.length > 0 ? Math.max(...data.purchases.map(p => p.id)) + 1 : 1;
    const newPurchase = { id, ...purchase };
    data.purchases.push(newPurchase);
    writeData(data);
    return newPurchase;
};

const getNextPurchaseBatchId = () => {
    const data = readData();
    const maxExisting = data.purchases.reduce((m, p) => {
        const b = p.batch_id != null ? Number(p.batch_id) : 0;
        return Math.max(m, Number.isFinite(b) ? b : 0);
    }, 0);
    return Math.max(Date.now(), maxExisting + 1);
};

const updatePurchase = (id, updates) => {
    const data = readData();
    const index = data.purchases.findIndex(p => p.id === id);
    if (index !== -1) {
        data.purchases[index] = { ...data.purchases[index], ...updates };
        writeData(data);
        return data.purchases[index];
    }
    return null;
};

const getPurchasesByBatchId = (batchId) => {
    const b = Number(batchId);
    if (!Number.isFinite(b)) return [];
    const data = readData();
    return data.purchases.filter((p) => p.batch_id === b);
};

const deletePurchasesByBatchId = (batchId) => {
    const b = Number(batchId);
    if (!Number.isFinite(b)) return 0;
    const data = readData();
    const before = data.purchases.length;
    data.purchases = data.purchases.filter((p) => p.batch_id !== b);
    writeData(data);
    return before - data.purchases.length;
};

// Sale operations
const getSales = () => {
    const data = readData();
    return data.sales;
};

const saveSale = (sale) => {
    const data = readData();
    const id = data.sales.length > 0 ? Math.max(...data.sales.map(s => s.id)) + 1 : 1;
    const newSale = { id, ...sale };
    data.sales.push(newSale);
    writeData(data);
    return newSale;
};

const updateSaleRecord = (id, updates) => {
    const data = readData();
    const index = data.sales.findIndex((s) => s.id === id);
    if (index === -1) return null;
    data.sales[index] = { ...data.sales[index], ...updates };
    writeData(data);
    return data.sales[index];
};

const deleteSaleRecord = (id) => {
    const data = readData();
    data.sales = data.sales.filter((s) => s.id !== id);
    writeData(data);
};

// Sales Items operations
const getSalesItems = () => {
    const data = readData();
    return data.sales_items;
};

const saveSalesItem = (item) => {
    const data = readData();
    const id = data.sales_items.length > 0 ? Math.max(...data.sales_items.map(i => i.id)) + 1 : 1;
    const newItem = { id, ...item };
    data.sales_items.push(newItem);
    writeData(data);
    return newItem;
};

const deleteSalesItemsBySaleId = (saleId) => {
    const data = readData();
    data.sales_items = data.sales_items.filter((i) => i.sale_id !== saleId);
    writeData(data);
};

// Suppliers
const getSuppliers = () => readData().suppliers;

const saveSupplier = (supplier) => {
    const data = readData();
    const id = data.suppliers.length > 0 ? Math.max(...data.suppliers.map((s) => s.id)) + 1 : 1;
    const row = { id, ...supplier };
    data.suppliers.push(row);
    writeData(data);
    return row;
};

module.exports = {
    getProducts,
    getProductByCode,
    saveProduct,
    updateProduct,
    deleteProduct,
    getPurchases,
    savePurchase,
    getNextPurchaseBatchId,
    updatePurchase,
    getPurchasesByBatchId,
    deletePurchasesByBatchId,
    getSales,
    saveSale,
    updateSaleRecord,
    deleteSaleRecord,
    getSalesItems,
    saveSalesItem,
    deleteSalesItemsBySaleId,
    getSuppliers,
    saveSupplier
};