import api from './api';

export const userService = {
  getSalespersons: () => api.get('/users/salespersons')
};
