const storage = require('../services/storageService');
const { getUserById } = require('../config/users');

// Create new sale with payment mode
exports.createSale = (req, res) => {
    try {
        const { items, customer_name, phone, discount, discount_percentage, salesperson_id, salesperson_name, payment_mode } = req.body;
        const sale_date = new Date().toISOString().split('T')[0];
        const salesperson = getUserById(salesperson_id);
        if (!salesperson) {
            return res.status(400).json({ error: 'Invalid salesperson' });
        }
        
        // Check stock availability
        for (const item of items) {
            const product = storage.getProductByCode(item.product_code);
            if (!product || product.stock_qty < item.quantity) {
                return res.status(400).json({ 
                    error: `Insufficient stock for product ${item.product_code}` 
                });
            }
        }
        
        // Calculate totals
        let total_amount = 0;
        const saleItems = items.map(item => {
            const product = storage.getProductByCode(item.product_code);
            const total = item.sell_price * item.quantity;
            total_amount += total;
            return {
                product_code: item.product_code,
                quantity: item.quantity,
                sell_price: item.sell_price,
                total
            };
        });
        
        const percentage = Number(discount_percentage || 0);
        const discountAmount = Number.isFinite(percentage) && percentage > 0
            ? (total_amount * percentage) / 100
            : Number(discount || 0);
        const final_amount = total_amount - discountAmount;
        
        // Create sale record with payment mode
        const sale = storage.saveSale({
            customer_name,
            phone,
            salesperson_id,
            salesperson_name: salesperson_name || salesperson.name,
            total_amount,
            discount: discountAmount,
            discount_percentage: percentage || 0,
            final_amount,
            sale_date,
            payment_mode: payment_mode || 'cash',
            created_at: new Date().toISOString()
        });
        
        // Create sale items and update stock
        for (const item of saleItems) {
            storage.saveSalesItem({
                sale_id: sale.id,
                product_code: item.product_code,
                quantity: item.quantity,
                sell_price: item.sell_price,
                total: item.total
            });
            
            // Update stock
            const product = storage.getProductByCode(item.product_code);
            storage.updateProduct(item.product_code, {
                stock_qty: product.stock_qty - item.quantity
            });
        }
        
        res.status(201).json({ 
            sale, 
            items: saleItems,
            message: 'Bill generated successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get one sale with line items (for bill preview)
exports.getSaleById = (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'Invalid sale id' });
        }

        const sales = storage.getSales();
        const sale = sales.find((s) => s.id === id);
        if (!sale) {
            return res.status(404).json({ error: 'Sale not found' });
        }

        const salesItems = storage.getSalesItems().filter((i) => i.sale_id === id);
        const products = storage.getProducts();
        const sales_items = salesItems.map((item) => ({
            ...item,
            products: products.find((p) => p.product_code === item.product_code) || null
        }));

        res.json({ ...sale, sales_items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get sales history
exports.getSales = (req, res) => {
    try {
        const { start_date, end_date, salesperson_id } = req.query;
        let sales = storage.getSales();
        const salesItems = storage.getSalesItems();
        
        if (salesperson_id) {
            sales = sales.filter((s) => s.salesperson_id === salesperson_id);
        }

        // Join sales with items
        let result = sales.map(sale => ({
            ...sale,
            sales_items: salesItems.filter(item => item.sale_id === sale.id)
        }));
        
        if (start_date) {
            result = result.filter(s => s.sale_date >= start_date);
        }
        if (end_date) {
            result = result.filter(s => s.sale_date <= end_date);
        }
        
        result.sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date));
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update sale with payment mode
exports.updateSale = (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'Invalid sale id' });
        }

        const sales = storage.getSales();
        const existing = sales.find((s) => s.id === id);
        if (!existing) {
            return res.status(404).json({ error: 'Sale not found' });
        }

        const { items, customer_name, phone, discount, discount_percentage, salesperson_id, salesperson_name, payment_mode } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'At least one line item is required' });
        }

        const salesperson = getUserById(salesperson_id || existing.salesperson_id);
        if (!salesperson) {
            return res.status(400).json({ error: 'Invalid salesperson' });
        }

        const oldItems = storage.getSalesItems().filter((i) => i.sale_id === id);
        const oldByCode = {};
        for (const item of oldItems) {
            oldByCode[item.product_code] = (oldByCode[item.product_code] || 0) + item.quantity;
        }
        const newByCode = {};
        for (const item of items) {
            const code = item.product_code;
            newByCode[code] = (newByCode[code] || 0) + Number(item.quantity);
        }
        const allCodes = new Set([...Object.keys(oldByCode), ...Object.keys(newByCode)]);
        for (const code of allCodes) {
            const product = storage.getProductByCode(code);
            const oldQ = oldByCode[code] || 0;
            const newQ = newByCode[code] || 0;
            if (newQ > 0 && !product) {
                return res.status(400).json({ error: `Unknown product ${code}` });
            }
            const stock = product ? product.stock_qty : 0;
            if (stock + oldQ < newQ) {
                return res.status(400).json({
                    error: `Insufficient stock for product ${code} (need ${newQ}, have ${stock} after releasing ${oldQ} from this bill)`
                });
            }
        }

        for (const item of oldItems) {
            const product = storage.getProductByCode(item.product_code);
            if (product) {
                storage.updateProduct(item.product_code, {
                    stock_qty: product.stock_qty + item.quantity
                });
            }
        }

        let total_amount = 0;
        const saleItems = items.map((item) => {
            const product = storage.getProductByCode(item.product_code);
            const total = item.sell_price * item.quantity;
            total_amount += total;
            return {
                product_code: item.product_code,
                quantity: item.quantity,
                sell_price: item.sell_price,
                total
            };
        });

        const percentage = Number(discount_percentage ?? existing.discount_percentage ?? 0);
        const discountAmount = Number.isFinite(percentage) && percentage > 0
            ? (total_amount * percentage) / 100
            : Number(discount ?? 0);
        const final_amount = total_amount - discountAmount;

        storage.deleteSalesItemsBySaleId(id);
        storage.updateSaleRecord(id, {
            customer_name: customer_name != null ? customer_name : existing.customer_name,
            phone: phone != null ? phone : existing.phone,
            salesperson_id: salesperson.id,
            salesperson_name: salesperson_name || salesperson.name,
            total_amount,
            discount: discountAmount,
            discount_percentage: percentage || 0,
            final_amount,
            payment_mode: payment_mode || existing.payment_mode || 'cash'
        });

        for (const item of saleItems) {
            storage.saveSalesItem({
                sale_id: id,
                product_code: item.product_code,
                quantity: item.quantity,
                sell_price: item.sell_price,
                total: item.total
            });
            const product = storage.getProductByCode(item.product_code);
            storage.updateProduct(item.product_code, {
                stock_qty: product.stock_qty - item.quantity
            });
        }

        const updated = storage.getSales().find((s) => s.id === id);
        const salesItems = storage.getSalesItems().filter((i) => i.sale_id === id);
        const products = storage.getProducts();
        const sales_items = salesItems.map((item) => ({
            ...item,
            products: products.find((p) => p.product_code === item.product_code) || null
        }));

        res.json({ ...updated, sales_items, message: 'Bill updated' });
    } catch (error) {
        const msg = error.message || String(error);
        if (msg.includes('Insufficient stock')) {
            return res.status(400).json({ error: msg });
        }
        res.status(500).json({ error: msg });
    }
};

// Delete sale
exports.deleteSale = (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'Invalid sale id' });
        }

        const sales = storage.getSales();
        const existing = sales.find((s) => s.id === id);
        if (!existing) {
            return res.status(404).json({ error: 'Sale not found' });
        }

        const oldItems = storage.getSalesItems().filter((i) => i.sale_id === id);
        for (const item of oldItems) {
            const product = storage.getProductByCode(item.product_code);
            if (product) {
                storage.updateProduct(item.product_code, {
                    stock_qty: product.stock_qty + item.quantity
                });
            }
        }

        storage.deleteSalesItemsBySaleId(id);
        storage.deleteSaleRecord(id);

        res.json({ message: 'Bill deleted', id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};