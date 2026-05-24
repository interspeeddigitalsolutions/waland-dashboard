const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'waland.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initSchema();
  }
});

// Promisify helper for runs
function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// Promisify helper for gets
function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Promisify helper for alls
function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function initSchema() {
  db.serialize(() => {
    // Create Sessions table
    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE,
        status TEXT,
        phone TEXT,
        pushName TEXT,
        lastError TEXT,
        createdAt TEXT
      )
    `);

    // Create Messages table
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sessionId TEXT,
        chatId TEXT,
        text TEXT,
        mediaUrl TEXT,
        status TEXT,
        messageId TEXT,
        error TEXT,
        createdAt TEXT
      )
    `);
  });
}

module.exports = {
  // Session queries
  saveSession: async (session) => {
    const query = `
      INSERT INTO sessions (id, name, status, phone, pushName, lastError, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        status = excluded.status,
        phone = excluded.phone,
        pushName = excluded.pushName,
        lastError = excluded.lastError,
        createdAt = excluded.createdAt
    `;
    return dbRun(query, [
      session.id,
      session.name,
      session.status,
      session.phone,
      session.pushName,
      session.lastError,
      session.createdAt
    ]);
  },

  updateSessionStatus: async (id, status, phone = null, pushName = null, lastError = null) => {
    const query = `
      UPDATE sessions
      SET status = ?, phone = COALESCE(?, phone), pushName = COALESCE(?, pushName), lastError = ?
      WHERE id = ?
    `;
    return dbRun(query, [status, phone, pushName, lastError, id]);
  },

  getSession: async (id) => {
    return dbGet('SELECT * FROM sessions WHERE id = ?', [id]);
  },

  getSessionByName: async (name) => {
    return dbGet('SELECT * FROM sessions WHERE name = ?', [name]);
  },

  getAllSessions: async () => {
    return dbAll('SELECT * FROM sessions ORDER BY name ASC');
  },

  deleteSession: async (id) => {
    return dbRun('DELETE FROM sessions WHERE id = ?', [id]);
  },

  // Message queries
  saveMessage: async (msg) => {
    const query = `
      INSERT INTO messages (id, sessionId, chatId, text, mediaUrl, status, messageId, error, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        messageId = excluded.messageId,
        error = excluded.error
    `;
    return dbRun(query, [
      msg.id,
      msg.sessionId,
      msg.chatId,
      msg.text,
      msg.mediaUrl,
      msg.status,
      msg.messageId,
      msg.error,
      msg.createdAt
    ]);
  },

  getAllMessages: async () => {
    return dbAll('SELECT * FROM messages ORDER BY createdAt DESC');
  },

  getMessagesBySession: async (sessionId) => {
    return dbAll('SELECT * FROM messages WHERE sessionId = ? ORDER BY createdAt DESC', [sessionId]);
  }
};
