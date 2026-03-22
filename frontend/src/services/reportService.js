import api from './api';

export const reportService = {
    getStockReport: (filters) => api.get('/reports/stock', { params: filters }),
    getSalesReport: (filters) => api.get('/reports/sales', { params: filters }),
};
