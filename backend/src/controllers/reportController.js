const storage = require('../services/storageService');
const { getSalespersons, getUserById } = require('../config/users');

// Generate stock report
exports.getStockReport = (req, res) => {
    try {
        const { gender, category, brand } = req.query;
        let products = storage.getProducts();
        
        if (gender) {
            products = products.filter(p => p.gender === gender);
        }
        if (category) {
            products = products.filter(p => p.category === category);
        }
        if (brand) {
            products = products.filter(p => p.brand_name.toLowerCase().includes(brand.toLowerCase()));
        }
        
        const summary = {
            total_products: products.length,
            total_stock_value: products.reduce((sum, p) => sum + (p.cost_price * p.stock_qty), 0),
            total_sales_value: products.reduce((sum, p) => sum + (p.sell_price * p.stock_qty), 0),
            products: products
        };
        
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Generate sales report
exports.getSalesReport = (req, res) => {
    try {
        const { start_date, end_date, salesperson_id, requester_id } = req.query;
        let sales = storage.getSales();
        const salesItems = storage.getSalesItems();
        const products = storage.getProducts();
        const requester = requester_id ? getUserById(requester_id) : null;
        const effectiveSalespersonId = requester && requester.role === 'salesman'
            ? requester.id
            : salesperson_id;
        
        if (effectiveSalespersonId) {
            sales = sales.filter((s) => s.salesperson_id === effectiveSalespersonId);
        }

        let result = sales.map(sale => ({
            ...sale,
            sales_items: salesItems.filter(item => item.sale_id === sale.id).map(item => ({
                ...item,
                products: products.find(p => p.product_code === item.product_code)
            }))
        }));
        
        if (start_date) {
            result = result.filter(s => s.sale_date >= start_date);
        }
        if (end_date) {
            result = result.filter(s => s.sale_date <= end_date);
        }
        
        const summary = {
            total_sales: result.length,
            total_revenue: result.reduce((sum, s) => sum + s.final_amount, 0),
            total_discount: result.reduce((sum, s) => sum + (s.discount || 0), 0),
            salespersons: getSalespersons().map((s) => ({ id: s.id, name: s.name, username: s.username })),
            sales: result
        };
        
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};