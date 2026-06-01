const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('./database');
const waland = require('./waland');

const app = express();
const configPath = path.join(__dirname, 'config.json');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session-level organization active state flag
let activeOrgSet = false;

// Middleware to ensure the active organization is set on the user session token in the Waland API
async function ensureActiveOrg(req, res, next) {
  const config = waland.readConfig();
  if (config.token && config.organizationId && !activeOrgSet) {
    try {
      console.log(`Auto-setting active organization to ${config.organizationId} on Waland API`);
      await waland.setActiveOrg(config.organizationId);
      activeOrgSet = true;
    } catch (err) {
      console.warn('Failed to auto-set active organization on request:', err.message);
      // Prevent repeating failed attempts on every request
      activeOrgSet = true;
    }
  }
  next();
}

app.use(ensureActiveOrg);

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Helper to save configuration changes
function saveConfig(updates) {
  try {
    const current = waland.readConfig();
    const updated = { ...current, ...updates };
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (err) {
    console.error('Error writing config file', err);
    throw new Error('Failed to persist configuration');
  }
}

// ── Views ──

// Main dashboard route
app.get('/', async (req, res) => {
  try {
    const config = waland.readConfig();
    
    // Sync local DB with Waland sessions if API Key is configured
    let syncError = null;
    if (config.apiKey) {
      try {
        const walandSessions = await waland.listSessions();
        for (const ws of walandSessions) {
          await db.saveSession({
            id: ws.id,
            name: ws.name,
            status: ws.status,
            phone: ws.phone,
            pushName: ws.pushName,
            lastError: ws.lastError,
            createdAt: ws.createdAt
          });
        }
      } catch (err) {
        console.warn('Could not sync sessions from Waland on load:', err.message);
        syncError = err.message;
      }
    }

    const localSessions = await db.getAllSessions();
    const localMessages = await db.getAllMessages();

    res.render('dashboard', {
      config,
      sessions: localSessions,
      messages: localMessages,
      syncError
    });
  } catch (err) {
    res.status(500).send(`Internal Server Error: ${err.message}`);
  }
});

// ── AJAX Configuration Routes ──

app.post('/api/config/save', async (req, res) => {
  try {
    const { baseUrl, port, token, organizationId, apiKey, activeSessionId } = req.body;
    const updated = saveConfig({
      baseUrl,
      port: parseInt(port, 10) || 3000,
      token,
      organizationId,
      apiKey,
      activeSessionId
    });
    activeOrgSet = false;

    // Auto-set active organization if credentials exist
    if (token && organizationId) {
      try {
        await waland.setActiveOrg(organizationId);
        activeOrgSet = true;
      } catch (err) {
        console.warn('Failed to set active organization on config save:', err.message);
      }
    }

    res.json({ success: true, config: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/config/reset', async (req, res) => {
  try {
    const updated = saveConfig({
      baseUrl: 'https://api.waland.dev',
      port: 3000,
      token: '',
      organizationId: '',
      apiKey: '',
      activeSessionId: ''
    });
    activeOrgSet = false;

    // Clear SQLite tables
    await db.clearAllData();

    res.json({ success: true, config: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── AJAX Auth Routes (Waland session-token based) ──

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }
    const data = await waland.signUp(name, email, password);
    // Auto-save token and credentials
    saveConfig({ token: data.token, email, password });
    activeOrgSet = false;
    res.json({ success: true, token: data.token, user: data.user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    const data = await waland.signIn(email, password);
    // Auto-save token and credentials
    saveConfig({ token: data.token, email, password });
    activeOrgSet = false;
    res.json({ success: true, token: data.token, user: data.user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/organizations', async (req, res) => {
  try {
    const orgs = await waland.listOrganizations();
    res.json({ success: true, organizations: orgs });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/create-key', async (req, res) => {
  try {
    const { name, organizationId } = req.body;
    if (!name || !organizationId) {
      return res.status(400).json({ success: false, error: 'Name and organization ID are required' });
    }
    const data = await waland.createApiKey(name, organizationId);
    // Auto-save API Key
    saveConfig({ apiKey: data.key, organizationId });
    activeOrgSet = false;

    // Auto-set active organization if credentials exist
    const config = waland.readConfig();
    if (config.token && organizationId) {
      try {
        await waland.setActiveOrg(organizationId);
        activeOrgSet = true;
      } catch (err) {
        console.warn('Failed to set active organization on create key:', err.message);
      }
    }

    res.json({ success: true, apiKey: data.key });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── AJAX WhatsApp Session Routes ──

app.get('/api/sessions', async (req, res) => {
  try {
    const config = waland.readConfig();
    if (config.apiKey) {
      try {
        const walandSessions = await waland.listSessions();
        for (const ws of walandSessions) {
          await db.saveSession(ws);
        }
      } catch (err) {
        console.warn('Could not sync sessions in /api/sessions:', err.message);
      }
    }
    const list = await db.getAllSessions();
    res.json({ success: true, sessions: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Session name is required' });
    }
    const ws = await waland.createSession(name);
    await db.saveSession(ws);
    // Set active session ID if not set
    const config = waland.readConfig();
    if (!config.activeSessionId) {
      saveConfig({ activeSessionId: ws.id });
    }
    res.json({ success: true, session: ws });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/sessions/:id/start', async (req, res) => {
  try {
    const sessionId = req.params.id;
    await waland.startSession(sessionId);
    await db.updateSessionStatus(sessionId, 'initializing');
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/sessions/:id/stop', async (req, res) => {
  try {
    const sessionId = req.params.id;
    await waland.stopSession(sessionId);
    await db.updateSessionStatus(sessionId, 'disconnected');
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    await waland.deleteSession(sessionId);
    await db.deleteSession(sessionId);
    // Clear active session ID if it was deleted
    const config = waland.readConfig();
    if (config.activeSessionId === sessionId) {
      saveConfig({ activeSessionId: '' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/sessions/:id/qr', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const qrData = await waland.getQrCode(sessionId);
    // qrData is { qrCode, status }
    await db.updateSessionStatus(sessionId, qrData.status);
    res.json({ success: true, qrCode: qrData.qrCode, status: qrData.status });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/sessions/:id/status', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const statusData = await waland.getSessionStatus(sessionId);
    await db.saveSession(statusData);
    res.json({ success: true, session: statusData });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── AJAX Messaging Routes ──

app.post('/api/messages/send', async (req, res) => {
  try {
    const { sessionId, chatId, text, mediaUrl } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'Recipient Chat ID is required' });
    }
    if (!text) {
      return res.status(400).json({ success: false, error: 'Message text is required' });
    }

    // Format chat ID if only a raw number was provided
    let formattedChatId = chatId.trim();
    if (!formattedChatId.includes('@')) {
      // Remove any leading +, spaces, hyphens
      formattedChatId = formattedChatId.replace(/[\s\+\-]/g, '');
      if (formattedChatId.length > 5) {
        formattedChatId = `${formattedChatId}@c.us`;
      } else {
        return res.status(400).json({ success: false, error: 'Invalid Chat ID / Phone number format' });
      }
    }

    let response;
    try {
      response = await waland.sendMessage(sessionId, formattedChatId, text, mediaUrl || null);
      // Save successful message
      const msgLog = {
        id: response.id || `local_${Date.now()}`,
        sessionId: response.sessionId || sessionId,
        chatId: response.chatId || formattedChatId,
        text: response.text || text,
        mediaUrl: response.mediaUrl || mediaUrl || null,
        status: response.status || 'sent',
        messageId: response.messageId || null,
        error: response.error || null,
        createdAt: response.createdAt || new Date().toISOString()
      };
      await db.saveMessage(msgLog);
      res.json({ success: true, message: msgLog });
    } catch (sendErr) {
      // Log failed message in SQLite for history
      const failLog = {
        id: `fail_${Date.now()}`,
        sessionId,
        chatId: formattedChatId,
        text,
        mediaUrl: mediaUrl || null,
        status: 'failed',
        messageId: null,
        error: sendErr.message,
        createdAt: new Date().toISOString()
      };
      await db.saveMessage(failLog);
      throw sendErr; // bubble up
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const logs = await db.getAllMessages();
    res.json({ success: true, messages: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start the server
const initialConfig = waland.readConfig();
const port = initialConfig.port || 3000;
app.listen(port, () => {
  console.log(`===============================================`);
  console.log(`Waland Wrapper Server running on port ${port}`);
  console.log(`URL: http://localhost:${port}`);
  console.log(`===============================================`);
  
  // Periodic background WhatsApp session synchronization (every 30 seconds)
  setInterval(async () => {
    const config = waland.readConfig();
    if (config.apiKey) {
      try {
        const walandSessions = await waland.listSessions();
        for (const ws of walandSessions) {
          await db.saveSession({
            id: ws.id,
            name: ws.name,
            status: ws.status,
            phone: ws.phone,
            pushName: ws.pushName,
            lastError: ws.lastError,
            createdAt: ws.createdAt
          });
        }
      } catch (err) {
        console.warn('Background WhatsApp session sync failed:', err.message);
      }
    }
  }, 30 * 1000);
});
