const storage = require('../services/storageService');
const { processPurchaseLine } = require('../services/productPurchaseService');

function normalizePurchaseItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return { error: 'At least one item is required', normalized: null };
    }
    const normalizedItems = [];
    for (let i = 0; i < items.length; i++) {
        const raw = items[i] || {};
        const brand_name = String(raw.brand_name || '').trim();
        const article_number = String(raw.article_number || '').trim();
        const gender = String(raw.gender || '').trim();
        const category = String(raw.category || '').trim();
        const cost_price = parseFloat(raw.cost_price);
        const quantity = parseInt(raw.quantity, 10);
        const sell_price = parseFloat(raw.sell_price);

        if (!brand_name || !article_number) {
            return { error: `Item ${i + 1}: brand and article are required`, normalized: null };
        }
        if (!gender || !category) {
            return { error: `Item ${i + 1}: gender and category are required`, normalized: null };
        }
        if (!Number.isFinite(cost_price) || cost_price < 0) {
            return { error: `Item ${i + 1}: invalid cost price`, normalized: null };
        }
        if (!Number.isFinite(quantity) || quantity < 1) {
            return { error: `Item ${i + 1}: invalid quantity`, normalized: null };
        }
        if (!Number.isFinite(sell_price) || sell_price <= 0) {
            return { error: `Item ${i + 1}: invalid selling price`, normalized: null };
        }

        normalizedItems.push({
            brand_name,
            article_number,
            gender,
            category,
            cost_price,
            quantity,
            sell_price,
            pricing_mode: raw.pricing_mode || 'percentage',
            markup_percentage: raw.markup_percentage
        });
    }
    return { error: null, normalized: normalizedItems };
}

exports.getPurchaseSummary = (req, res) => {
    try {
        const purchases = storage.getPurchases();
        const grand_total = purchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
        const byMap = {};
        for (const p of purchases) {
            const name = p.supplier_name || '—';
            byMap[name] = (byMap[name] || 0) + Number(p.total_amount || 0);
        }
        const by_supplier = Object.entries(byMap)
            .map(([supplier_name, total]) => ({ supplier_name, total }))
            .sort((a, b) => b.total - a.total);
        res.json({ grand_total, by_supplier });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getPurchaseBatch = (req, res) => {
    try {
        const batchId = parseInt(req.params.batch_id, 10);
        if (!Number.isFinite(batchId)) {
            return res.status(400).json({ error: 'Invalid batch' });
        }
        const lines = storage.getPurchasesByBatchId(batchId);
        if (!lines.length) {
            return res.status(404).json({ error: 'Batch not found' });
        }
        const products = storage.getProducts();
        const result = lines.map((p) => ({
            ...p,
            products: products.find((pr) => pr.product_code === p.product_code)
        }));
        res.json({
            batch_id: batchId,
            supplier_name: lines[0].supplier_name,
            supplier_bill_no: lines[0].supplier_bill_no,
            purchase_date: lines[0].purchase_date,
            payment_status: lines[0].payment_status,
            bill_attachment: lines[0].bill_attachment || '',
            lines: result
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.uploadPurchaseAttachment = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const rel = `/uploads/purchase-bills/${req.file.filename}`;
        res.json({ path: rel });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all purchases with filters
exports.getPurchases = (req, res) => {
    try {
        const { supplier, status, start_date, end_date } = req.query;
        let purchases = storage.getPurchases();
        const products = storage.getProducts();
        
        // Join with products
        let result = purchases.map(purchase => ({
            ...purchase,
            products: products.find(p => p.product_code === purchase.product_code)
        }));
        
        if (supplier) {
            result = result.filter(p => p.supplier_name === supplier);
        }
        if (status) {
            result = result.filter(p => p.payment_status === status);
        }
        if (start_date) {
            result = result.filter(p => p.purchase_date >= start_date);
        }
        if (end_date) {
            result = result.filter(p => p.purchase_date <= end_date);
        }
        
        result.sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date));
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get due payments summary (grouped by supplier, then by purchase bill / batch)
exports.getDuePayments = (req, res) => {
    try {
        const purchases = storage.getPurchases();
        const products = storage.getProducts();
        const duePurchases = purchases.filter(p => p.payment_status === 'DUE');

        const withProducts = duePurchases.map((p) => ({
            ...p,
            products: products.find((pr) => pr.product_code === p.product_code)
        }));

        const bySupplier = {};

        for (const p of withProducts) {
            if (!bySupplier[p.supplier_name]) {
                bySupplier[p.supplier_name] = {
                    supplier: p.supplier_name,
                    total_due: 0,
                    bills: {}
                };
            }
            const billKey = p.batch_id != null ? `b-${p.batch_id}` : `i-${p.id}`;
            if (!bySupplier[p.supplier_name].bills[billKey]) {
                bySupplier[p.supplier_name].bills[billKey] = {
                    batch_id: p.batch_id != null ? p.batch_id : null,
                    supplier_bill_no: p.supplier_bill_no || '',
                    purchase_date: p.purchase_date,
                    total: 0,
                    lines: [],
                    pay_kind: p.batch_id != null ? 'batch' : 'single',
                    purchase_id: p.batch_id != null ? null : p.id
                };
            }
            const bill = bySupplier[p.supplier_name].bills[billKey];
            bill.total += p.total_amount;
            bill.lines.push(p);
            bySupplier[p.supplier_name].total_due += p.total_amount;
        }
        const summary = Object.values(bySupplier).map((s) => ({
            supplier: s.supplier,
            total_due: s.total_due,
            bills: Object.values(s.bills)
        }));

        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Pay due amount
exports.payDue = (req, res) => {
    try {
        const { purchase_id } = req.params;
        const paid_date = new Date().toISOString().split('T')[0];
        
        const purchase = storage.updatePurchase(parseInt(purchase_id), {
            payment_status: 'PAID',
            paid_date
        });
        
        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found' });
        }
        
        res.json({ message: 'Payment recorded successfully', purchase });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Record one supplier bill with multiple line items (single payment status for the whole bill)
exports.createPurchaseBatch = (req, res) => {
    try {
        const { supplier_name, supplier_bill_no, purchase_date, payment_status, items, bill_attachment } = req.body;

        const supplier = String(supplier_name || '').trim();
        if (!supplier) {
            return res.status(400).json({ error: 'Supplier name is required' });
        }

        const { error, normalized: normalizedItems } = normalizePurchaseItems(items);
        if (error) {
            return res.status(400).json({ error });
        }

        const date = purchase_date || new Date().toISOString().split('T')[0];
        const status = payment_status === 'DUE' ? 'DUE' : 'PAID';
        const batch_id = storage.getNextPurchaseBatchId();
        const billNo = supplier_bill_no != null ? String(supplier_bill_no).trim() : '';
        const attachment = bill_attachment != null ? String(bill_attachment).trim() : '';

        const results = [];

        for (const item of normalizedItems) {
            const { product, purchase } = processPurchaseLine(
                {
                    brand_name: item.brand_name,
                    article_number: item.article_number,
                    gender: item.gender,
                    category: item.category,
                    cost_price: item.cost_price,
                    sell_price: item.sell_price,
                    quantity: item.quantity,
                    pricing_mode: item.pricing_mode || 'percentage',
                    markup_percentage: item.markup_percentage
                },
                {
                    supplier_name: supplier,
                    supplier_bill_no: billNo,
                    purchase_date: date,
                    payment_status: status,
                    batch_id,
                    bill_attachment: attachment
                }
            );
            results.push({ product, purchase });
        }

        res.status(201).json({
            message: 'Purchase bill recorded',
            batch_id,
            supplier_bill_no: billNo,
            items: results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updatePurchaseBatch = (req, res) => {
    try {
        const batchId = parseInt(req.params.batch_id, 10);
        if (!Number.isFinite(batchId)) {
            return res.status(400).json({ error: 'Invalid batch' });
        }

        const oldLines = storage.getPurchasesByBatchId(batchId);
        if (!oldLines.length) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        const { supplier_name, supplier_bill_no, purchase_date, payment_status, items, bill_attachment } = req.body;
        const supplier = String(supplier_name || '').trim();
        if (!supplier) {
            return res.status(400).json({ error: 'Supplier name is required' });
        }

        const { error, normalized: normalizedItems } = normalizePurchaseItems(items);
        if (error) {
            return res.status(400).json({ error });
        }

        for (const line of oldLines) {
            const p = storage.getProductByCode(line.product_code);
            if (!p || p.stock_qty < line.quantity) {
                return res.status(400).json({
                    error: `Cannot update bill: insufficient current stock to remove line for ${line.product_code}`
                });
            }
        }

        for (const line of oldLines) {
            const p = storage.getProductByCode(line.product_code);
            storage.updateProduct(line.product_code, {
                stock_qty: p.stock_qty - line.quantity
            });
        }

        storage.deletePurchasesByBatchId(batchId);

        const date = purchase_date || new Date().toISOString().split('T')[0];
        const status = payment_status === 'DUE' ? 'DUE' : 'PAID';
        const billNo = supplier_bill_no != null ? String(supplier_bill_no).trim() : '';
        const attachment =
            bill_attachment != null && String(bill_attachment).trim() !== ''
                ? String(bill_attachment).trim()
                : (oldLines[0].bill_attachment || '');

        const results = [];
        for (const item of normalizedItems) {
            const { product, purchase } = processPurchaseLine(
                {
                    brand_name: item.brand_name,
                    article_number: item.article_number,
                    gender: item.gender,
                    category: item.category,
                    cost_price: item.cost_price,
                    sell_price: item.sell_price,
                    quantity: item.quantity,
                    pricing_mode: item.pricing_mode || 'percentage',
                    markup_percentage: item.markup_percentage
                },
                {
                    supplier_name: supplier,
                    supplier_bill_no: billNo,
                    purchase_date: date,
                    payment_status: status,
                    batch_id: batchId,
                    bill_attachment: attachment
                }
            );
            results.push({ product, purchase });
        }

        res.json({
            message: 'Purchase bill updated',
            batch_id: batchId,
            supplier_bill_no: billNo,
            items: results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Mark every DUE line in a batch as paid
exports.payBatch = (req, res) => {
    try {
        const batchId = parseInt(req.params.batch_id, 10);
        if (!Number.isFinite(batchId)) {
            return res.status(400).json({ error: 'Invalid batch' });
        }

        const paid_date = new Date().toISOString().split('T')[0];
        const all = storage.getPurchases();
        const toPay = all.filter((p) => p.batch_id === batchId && p.payment_status === 'DUE');

        if (!toPay.length) {
            return res.status(404).json({ error: 'No due lines found for this bill' });
        }

        for (const p of toPay) {
            storage.updatePurchase(p.id, { payment_status: 'PAID', paid_date });
        }

        res.json({ message: 'Bill marked as paid', updated: toPay.length, batch_id: batchId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};