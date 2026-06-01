const axios = require('axios');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');

// Helper to read configuration dynamically
function readConfig() {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading config file, using defaults', err);
    return {
      baseUrl: 'https://api.waland.dev',
      port: 3000,
      token: '',
      organizationId: '',
      apiKey: '',
      activeSessionId: ''
    };
  }
}

// Helper to get axios instance with correct base URL
function getClient(useAuthToken = false) {
  const config = readConfig();
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  if (useAuthToken) {
    if (config.token) {
      headers['Authorization'] = `Bearer ${config.token}`;
    }
    // Origin header is required for /auth/* endpoints on api.waland.dev due to CSRF checks
    headers['Origin'] = config.baseUrl;
  } else {
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
  }

  return axios.create({
    baseURL: config.baseUrl,
    headers,
    validateStatus: () => true // Allow handling status codes in logic
  });
}

// Helper to perform auth requests with auto-refresh on 401 Unauthorized
async function performAuthRequest(requestFn) {
  let res = await requestFn(getClient(true));
  if (res.status === 401) {
    const config = readConfig();
    if (config.email && config.password) {
      try {
        console.log('User Session Token expired. Attempting automatic re-authentication...');
        const loginClient = axios.create({
          baseURL: config.baseUrl,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Origin': config.baseUrl
          },
          validateStatus: () => true
        });
        const loginRes = await loginClient.post('/auth/sign-in/email', {
          email: config.email,
          password: config.password
        });
        if (loginRes.status === 200 && loginRes.data?.token) {
          const newToken = loginRes.data.token;
          console.log('Successfully re-authenticated. Saving new User Session Token.');
          
          const updated = { ...config, token: newToken };
          fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8');
          
          res = await requestFn(getClient(true));
        }
      } catch (err) {
        console.error('Automatic re-authentication failed:', err.message);
      }
    }
  }
  return res;
}

module.exports = {
  readConfig,
  
  // ── Auth Endpoints (Using Session Token) ──

  setActiveOrg: async (organizationId) => {
    const res = await performAuthRequest(client => client.post('/auth/organization/set-active', { organizationId }));
    if (res.status >= 400) {
      throw new Error(res.data?.message || `Failed to set active organization: ${res.status}`);
    }
    return res.data;
  },

  signUp: async (name, email, password) => {
    const client = getClient(true);
    const res = await client.post('/auth/sign-up/email', { name, email, password });
    if (res.status >= 400) {
      throw new Error(res.data?.message || `Sign up failed with status ${res.status}`);
    }
    return res.data; // { token, user }
  },

  signIn: async (email, password) => {
    const client = getClient(true);
    const res = await client.post('/auth/sign-in/email', { email, password });
    if (res.status >= 400) {
      throw new Error(res.data?.message || `Sign in failed with status ${res.status}`);
    }
    return res.data; // { token, user, redirect }
  },

  listOrganizations: async () => {
    const res = await performAuthRequest(client => client.get('/auth/organization/list'));
    if (res.status >= 400) {
      throw new Error(res.data?.message || `Failed to fetch organization list: ${res.status}`);
    }
    return res.data; // array of orgs
  },

  createApiKey: async (name, organizationId) => {
    const res = await performAuthRequest(client => client.post('/auth/api-key/create', { name, organizationId }));
    if (res.status >= 400) {
      throw new Error(res.data?.message || `Failed to create API key: ${res.status}`);
    }
    return res.data; // { id, name, key, ... }
  },

  // ── M2M WhatsApp Endpoints ──

  createSession: async (name) => {
    const client = getClient(false);
    const res = await client.post('/v1/sessions', { name });
    if (res.status === 409) {
      throw new Error('Conflict: A session with this name already exists.');
    }
    if (res.status >= 400) {
      throw new Error(res.data?.message || `Failed to create session: ${res.status}`);
    }
    return res.data; // { id, name, status, ... }
  },

  startSession: async (sessionId) => {
    const client = getClient(false);
    const res = await client.post(`/v1/sessions/${sessionId}/start`);
    if (res.status >= 400) {
      throw new Error(res.data?.message || `Failed to start session: ${res.status}`);
    }
    return res.data;
  },

  stopSession: async (sessionId) => {
    const client = getClient(false);
    const res = await client.post(`/v1/sessions/${sessionId}/stop`);
    if (res.status >= 400) {
      throw new Error(res.data?.message || `Failed to stop session: ${res.status}`);
    }
    return res.data;
  },

  deleteSession: async (sessionId) => {
    const client = getClient(false);
    const res = await client.delete(`/v1/sessions/${sessionId}`);
    if (res.status >= 400) {
      throw new Error(res.data?.message || `Failed to delete session: ${res.status}`);
    }
    return res.data;
  },

  getSessionStatus: async (sessionId) => {
    const client = getClient(false);
    const res = await client.get(`/v1/sessions/${sessionId}`);
    if (res.status >= 400) {
      throw new Error(res.data?.message || `Failed to get session status: ${res.status}`);
    }
    return res.data; // { id, name, status, phone, pushName, lastError, createdAt }
  },

  getQrCode: async (sessionId) => {
    const client = getClient(false);
    const res = await client.get(`/v1/sessions/${sessionId}/qr`);
    if (res.status >= 400) {
      throw new Error(res.data?.message || `Failed to fetch QR code: ${res.status}`);
    }
    return res.data; // { qrCode: "data:...", status }
  },

  sendMessage: async (sessionId, chatId, text, mediaUrl = null) => {
    const client = getClient(false);
    const body = { chatId, text };
    if (mediaUrl) {
      body.mediaUrl = mediaUrl;
    }
    const res = await client.post(`/v1/sessions/${sessionId}/send`, body);
    if (res.status >= 400) {
      throw new Error(res.data?.message || res.data?.error || `Failed to send message: ${res.status}`);
    }
    return res.data; // { id, status, messageId, ... }
  },

  listSessions: async () => {
    const client = getClient(false);
    const res = await client.get('/v1/sessions');
    if (res.status >= 400) {
      throw new Error(res.data?.message || `Failed to list sessions from Waland: ${res.status}`);
    }
    return res.data; // array of sessions
  }
};
