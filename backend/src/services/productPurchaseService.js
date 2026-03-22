const storage = require('./storageService');

function computeSellPrice(costPrice, body) {
    const parsedCost = parseFloat(costPrice);
    const parsedSell = parseFloat(body.sell_price);
    if (Number.isFinite(parsedSell) && parsedSell > 0) {
        return parsedSell;
    }
    const markup = parseFloat(body.markup_percentage || 0);
    const fromMarkup = parsedCost + (parsedCost * markup) / 100;
    if (Number.isFinite(fromMarkup) && fromMarkup > 0) {
        return fromMarkup;
    }
    return parsedCost * 1.4;
}

/**
 * Add stock from one purchase line (new or existing product) and record purchase row.
 * @param {object} body - same shape as product create (brand_name, article_number, gender, category, cost_price, quantity, pricing_mode, markup_percentage, sell_price)
 * @param {object} meta - supplier_name, purchase_date, payment_status, batch_id, supplier_bill_no
 */
function processPurchaseLine(body, meta) {
    const brand_name = String(body.brand_name || '').trim();
    const article_number = String(body.article_number || '').trim();
    const gender = String(body.gender || '').trim();
    const category = String(body.category || '').trim();
    const { cost_price, quantity, pricing_mode, markup_percentage, sell_price } = body;
    const { supplier_name, purchase_date, payment_status, batch_id, supplier_bill_no, bill_attachment } = meta;

    const product_code = `${brand_name}_${article_number}`;
    const parsedCostPrice = parseFloat(cost_price);
    const qty = parseInt(quantity, 10);
    const finalSellPrice = computeSellPrice(cost_price, {
        pricing_mode,
        markup_percentage,
        sell_price
    });

    let existingProduct = storage.getProductByCode(product_code);
    let product;

    if (existingProduct) {
        const updatedStock = existingProduct.stock_qty + qty;
        const updatedCost = (existingProduct.cost_price + parsedCostPrice) / 2;
        product = storage.updateProduct(product_code, {
            stock_qty: updatedStock,
            cost_price: updatedCost,
            sell_price: finalSellPrice
        });
    } else {
        product = storage.saveProduct({
            product_code,
            brand_name,
            article_number,
            gender,
            category,
            cost_price: parsedCostPrice,
            sell_price: finalSellPrice,
            stock_qty: qty,
            created_at: new Date().toISOString()
        });
    }

    const total_amount = parsedCostPrice * qty;
    const purchase = storage.savePurchase({
        product_code,
        supplier_name,
        supplier_bill_no: supplier_bill_no != null ? String(supplier_bill_no) : '',
        batch_id,
        quantity: qty,
        cost_price: parsedCostPrice,
        total_amount,
        purchase_date,
        payment_status,
        paid_date: payment_status === 'PAID' ? new Date().toISOString().split('T')[0] : null,
        created_at: new Date().toISOString(),
        bill_attachment: bill_attachment != null && String(bill_attachment).trim() !== '' ? String(bill_attachment).trim() : ''
    });

    return { product, purchase };
}

module.exports = {
    processPurchaseLine,
    computeSellPrice
};
