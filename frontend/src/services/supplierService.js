import api from './api';

export const supplierService = {
  list: () => api.get('/suppliers'),
  create: (name) => api.post('/suppliers', { name }),
};
