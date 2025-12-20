const axios = require('axios');

const BASE_URL = process.env.EXPENSE_API_URL || 'http://localhost:5000/api';
const TOKEN = process.env.EXPENSE_CLI_TOKEN;

const client = axios.create({
  baseURL: BASE_URL,
  headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}
});

const handleError = (err) => {
  if (err.response?.data?.error) {
    throw new Error(err.response.data.error);
  }
  throw err;
};

module.exports = {
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

  async createGroup(name, members) {
    try {
      const { data } = await client.post('/groups', { name, members });
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async getGroups() {
    try {
      const { data } = await client.get('/groups');
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

  async getGroupExpenses(groupId) {
    try {
      const { data } = await client.get(`/groups/${groupId}/expenses`);
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

  async addExpense({ groupId, amount, description, splitType, participants }) {
    try {
      const payload = { groupId, amount, description, splitType };
      if (participants) payload.participants = participants;
      const { data } = await client.post('/expenses', payload);
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async getBalances() {
    try {
      const { data } = await client.get('/balances');
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

  async getActivities(limit = 20) {
    try {
      const { data } = await client.get(`/activities?limit=${limit}`);
      return data;
    } catch (err) {
      handleError(err);
    }
  }
};
