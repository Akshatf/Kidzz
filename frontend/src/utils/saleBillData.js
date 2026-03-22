export function mapSaleToBillData(sale) {
  const items = (sale.sales_items || []).map((si) => {
    const p = si.products;
    const product_name = p ? `${p.brand_name} (${si.product_code})` : si.product_code;
    return {
      product_name,
      product_code: si.product_code,
      quantity: si.quantity,
      sell_price: si.sell_price,
      total: si.total,
    };
  });
  return {
    ...sale,
    items,
    subtotal: sale.total_amount,
    discount_amount: sale.discount,
    discount_percentage: sale.discount_percentage,
    final_amount: sale.final_amount,
    payment_mode: sale.payment_mode || 'cash',
  };
}