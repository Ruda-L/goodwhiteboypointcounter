const express = require('express');
const { engine } = require('express-handlebars');
const Database = require('better-sqlite3');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();

// Supports persistent storage on cloud hosts (like Render) or locally
const dbPath = process.env.DATA_PATH ? path.join(process.env.DATA_PATH, 'counter.db') : 'counter.db';
const db = new Database(dbPath);

// Initialize SQLite table
db.prepare(`
  CREATE TABLE IF NOT EXISTS counter (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    value INTEGER NOT NULL
  )
`).run();

const row = db.prepare('SELECT value FROM counter WHERE id = 1').get();
if (!row) {
    db.prepare('INSERT INTO counter (id, value) VALUES (1, 0)').run();
}

// Setup Handlebars template engine
app.engine('handlebars', engine({ defaultLayout: false }));
app.set('view engine', 'handlebars');
app.set('views', './views');

app.use(express.json());
app.use(cookieParser());

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'iloveeunsung';

// Home route
app.get('/', (req, res) => {
    const data = db.prepare('SELECT value FROM counter WHERE id = 1').get();
    const isAdmin = req.cookies.admin_auth === 'true';
    res.render('main', { count: data.value, isAdmin });
});

// Public count endpoint for live polling
app.get('/api/count', (req, res) => {
    const data = db.prepare('SELECT value FROM counter WHERE id = 1').get();
    res.json({ value: data.value });
});

// Admin modify endpoint
app.post('/api/modify', (req, res) => {
    if (req.cookies.admin_auth !== 'true') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { action } = req.body; 
    const stmt = action === 'increment' 
        ? db.prepare('UPDATE counter SET value = value + 1 WHERE id = 1')
        : db.prepare('UPDATE counter SET value = value - 1 WHERE id = 1');
    
    stmt.run();
    const updated = db.prepare('SELECT value FROM counter WHERE id = 1').get();
    res.json({ value: updated.value });
});

// Admin login endpoint
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.cookie('admin_auth', 'true', { 
            httpOnly: true, 
            secure: true, 
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 
        });
        return res.json({ success: true });
    }
    res.status(401).json({ success: false, error: 'Unauthorized' });
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    res.clearCookie('admin_auth');
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✨ Silly purple counter running on port ${PORT}`));