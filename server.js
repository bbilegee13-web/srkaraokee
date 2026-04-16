const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'data.json');
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret';

const USERS = {
  [process.env.ADMIN_USER || 'admin']: { password: process.env.ADMIN_PASS || 'admin123', role: 'admin' },
  [process.env.WORKER_USER || 'worker']: { password: process.env.WORKER_PASS || '1234', role: 'worker' },
};

function ensureDataFile() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ sessions: {}, history: [], customMenu: [] }, null, 2));
  }
}

function readData() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return { sessions: {}, history: [], customMenu: [] };
  }
}

function writeData(data) {
  ensureDataFile();
  fs.writeFileSync(DATA_PATH, JSON.stringify({
    sessions: data.sessions || {},
    history: data.history || [],
    customMenu: data.customMenu || []
  }, null, 2));
}

app.use(express.json({ limit: '2mb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.post('/api/login', (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = USERS[username];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  req.session.user = { username, role: user.role };
  res.json(req.session.user);
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  res.json(req.session.user);
});

app.get('/api/state', requireAuth, (req, res) => {
  res.json(readData());
});

app.post('/api/state', requireAuth, (req, res) => {
  writeData(req.body || {});
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
