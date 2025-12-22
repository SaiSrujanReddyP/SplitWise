const axios = require('axios');

const BASE_URL = process.env.EXPENSE_API_URL || 'http://localhost:5000/api';
const TOKEN = process.env.EXPENSE_CLI_TOKEN;

const client = axios.create({
  baseURL: BASE_URL,
  headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}
});

const handleError = (err) => {
  if (err.response?.status === 429) {
    throw new Error('Rate limited - please wait a moment and try again');
  }
  if (err.response?.data?.error) {
    throw new Error(err.response.data.error);
  }
  if (err.code === 'ECONNREFUSED') {
    throw new Error('Cannot connect to server. Is it running?');
  }
  throw err;
};

module.exports = {
  // Auth
  async login(email, password) {
    try {
      const { data } = await client.post('/auth/login', { email, password });
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async signup(name, email, password) {
    try {
      const { data } = await client.post('/auth/signup', { name, email, password });
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  // Groups
  async createGroup(name, members) {
    try {
      const { data } = await client.post('/groups', { name, members });
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async getGroups(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.cursor) params.append('cursor', options.cursor);
      const { data } = await client.get(`/groups?${params}`);
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async getGroup(groupId) {
    try {
      const { data } = await client.get(`/groups/${groupId}`);
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async addMember(groupId, email) {
    try {
      const { data } = await client.post(`/groups/${groupId}/members`, { email });
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async deleteGroup(groupId) {
    try {
      const { data } = await client.delete(`/groups/${groupId}`);
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async getGroupExpenses(groupId, options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.cursor) params.append('cursor', options.cursor);
      const { data } = await client.get(`/groups/${groupId}/expenses?${params}`);
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async getGroupBalances(groupId) {
    try {
      const { data } = await client.get(`/groups/${groupId}/balances`);
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  // Expenses
  async addExpense({ groupId, amount, description, splitType, participants, date }) {
    try {
      const payload = { amount, description, splitType };
      if (groupId) payload.groupId = groupId;
      if (participants) payload.participants = participants;
      if (date) payload.date = date;
      const { data } = await client.post('/expenses', payload);
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async getMyExpenses(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.cursor) params.append('cursor', options.cursor);
      const { data } = await client.get(`/expenses/mine?${params}`);
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async searchUsers(query) {
    try {
      const { data } = await client.get(`/expenses/search-users?q=${encodeURIComponent(query)}`);
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  // Balances
  async getBalances() {
    try {
      const { data } = await client.get('/balances');
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async getBalanceDetails(userId) {
    try {
      const { data } = await client.get(`/balances/details/${userId}`);
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async getSettlements() {
    try {
      const { data } = await client.get('/balances/settlements');
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async getGroupSettlements(groupId) {
    try {
      const { data } = await client.get(`/groups/${groupId}/settlements`);
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async settle({ groupId, creditorId, amount }) {
    try {
      const { data } = await client.post('/balances/settle', { groupId, creditorId, amount });
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  // Activities
  async getActivities(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.cursor) params.append('cursor', options.cursor);
      const { data } = await client.get(`/activities?${params}`);
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  // Health check
  async getHealth() {
    try {
      const { data } = await axios.get(`${BASE_URL.replace('/api', '')}/health`);
      return data;
    } catch (err) {
      handleError(err);
    }
  }
};
