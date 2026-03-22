import api from './api';

export const purchaseService = {
    getAll: (filters) => api.get('/purchases', { params: filters }),
    getSummary: () => api.get('/purchases/summary'),
    getBatch: (batchId) => api.get(`/purchases/batch/${batchId}`),
    getDue: () => api.get('/purchases/due'),
    payDue: (purchaseId) => api.put(`/purchases/pay/${purchaseId}`),
    createBatch: (payload) => api.post('/purchases/batch', payload),
    updateBatch: (batchId, payload) => api.put(`/purchases/batch/${batchId}`, payload),
    payBatch: (batchId) => api.put(`/purchases/pay-batch/${batchId}`),
    uploadAttachment: (file) => {
        const form = new FormData();
        form.append('file', file);
        return api.post('/purchases/attachment', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
};