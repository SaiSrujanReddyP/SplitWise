import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  signup: (name, email, password) => api.post('/auth/signup', { name, email, password }),
};

export const groups = {
  getAll: () => api.get('/groups'),
  getById: (id) => api.get(`/groups/${id}`),
  create: (name, members) => api.post('/groups', { name, members }),
  addMember: (id, email) => api.post(`/groups/${id}/members`, { email }),
  getExpenses: (id) => api.get(`/groups/${id}/expenses`),
  getBalances: (id) => api.get(`/groups/${id}/balances`),
  getSettlements: (id) => api.get(`/groups/${id}/settlements`),
};

export const expenses = {
  create: (data) => api.post('/expenses', data),
  getById: (id) => api.get(`/expenses/${id}`),
  getMine: (limit = 20) => api.get(`/expenses/mine?limit=${limit}`),
  searchUsers: (query) => api.get(`/expenses/search-users?q=${query}`),
};

export const balances = {
  get: () => api.get('/balances'),
  settle: (data) => api.post('/balances/settle', data),
  getSettlements: () => api.get('/balances/settlements'),
  getDetails: (userId) => api.get(`/balances/details/${userId}`),
};

export const activities = {
  get: (limit = 20) => api.get(`/activities?limit=${limit}`),
};

export default api;
