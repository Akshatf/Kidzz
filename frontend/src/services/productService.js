import api from './api';

export const productService = {
    getAll: (filters) => api.get('/products', { params: filters }),
    getByBrand: (brand) => api.get(`/products/brand/${brand}`),
    create: (productData) => api.post('/products', productData),
};