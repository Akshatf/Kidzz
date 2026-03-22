import api from './api';

export const saleService = {
    getAll: (filters) => api.get('/sales', { params: filters }),
    getById: (id) => api.get(`/sales/${id}`),
    create: (saleData) => api.post('/sales', saleData),
    update: (id, payload) => api.put(`/sales/${id}`, payload),
    remove: (id) => api.delete(`/sales/${id}`),
};