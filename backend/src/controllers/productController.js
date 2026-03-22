const storage = require('../services/storageService');

const { processPurchaseLine } = require('../services/productPurchaseService');

// Get all products with filters

exports.getProducts = (req, res) => {

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

        res.json(products);

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

};

// Get product suggestions by search term

exports.getProductsByBrand = (req, res) => {

    try {

        const { brand } = req.params;

        const query = String(brand || '').toLowerCase();

        let products = storage.getProducts();

        const filtered = products

            .filter(p =>

                p.brand_name.toLowerCase().includes(query) ||

                p.article_number.toLowerCase().includes(query) ||

                p.product_code.toLowerCase().includes(query)

            )

            .slice(0, 10);

        res.json(filtered);

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

};

// Create new product (single line — one purchase batch per submit)

exports.createProduct = (req, res) => {

    try {

        const {

            brand_name,

            article_number,

            gender,

            category,

            cost_price,

            sell_price,

            supplier_name,

            quantity,

            purchase_date,

            payment_status,

            supplier_bill_no,

            pricing_mode,

            markup_percentage

        } = req.body;

        const batch_id = storage.getNextPurchaseBatchId();

        const { product, purchase } = processPurchaseLine(
            {
                brand_name,

                article_number,

                gender,

                category,

                cost_price,

                sell_price,

                quantity,

                pricing_mode: pricing_mode || 'percentage',

                markup_percentage
            },

            {

                supplier_name,

                supplier_bill_no: supplier_bill_no || '',

                purchase_date,

                payment_status,

                batch_id

            }

        );

        res.status(201).json({ product, purchase });

    } catch (error) {

        res.status(500).json({ error: error.message });
    }

};

