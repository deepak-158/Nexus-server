/**
 * Nexus Browser — Database Module
 * SQLite setup using sql.js (pure JavaScript).
 * Tables: users, messages, contacts, notes, tasks, saved_sites, saved_passwords
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'browser.db');

let db = null;

async function initDB() {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // Original tables
    db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
  )`);

    db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, contact_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (contact_id) REFERENCES users(id)
  )`);

    // ── New tables for productivity features ──────────────────

    db.run(`CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content TEXT NOT NULL DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

    db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

    db.run(`CREATE TABLE IF NOT EXISTS saved_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    visit_count INTEGER NOT NULL DEFAULT 1,
    pinned INTEGER NOT NULL DEFAULT 0,
    last_visited DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, url),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

    db.run(`CREATE TABLE IF NOT EXISTS saved_passwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    site_url TEXT NOT NULL,
    username TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, site_url, username),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

    // Password reset tokens
    db.run(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

    // Registration OTP tokens (for email verification before account creation)
    db.run(`CREATE TABLE IF NOT EXISTS registration_otp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

    // Browsing history (per user, synced from client)
    db.run(`CREATE TABLE IF NOT EXISTS browsing_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

    saveDB();
    console.log('[DB] Database initialized');
    return db;
}

function saveDB() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

function getDB() { return db; }

// ── User Queries ──────────────────────────────────────────

function createUser(email, name, passwordHash) {
    db.run('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)', [email, name, passwordHash]);
    saveDB();
    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0];
}

function findUserByEmail(email) {
    const result = db.exec('SELECT id, email, name, password_hash FROM users WHERE email = ?', [email]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    const row = result[0].values[0];
    return { id: row[0], email: row[1], name: row[2], password_hash: row[3] };
}

function findUserById(id) {
    const result = db.exec('SELECT id, email, name FROM users WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    const row = result[0].values[0];
    return { id: row[0], email: row[1], name: row[2] };
}

function searchUsers(query, excludeId) {
    const result = db.exec(
        "SELECT id, email, name FROM users WHERE email LIKE ? AND id != ? LIMIT 20",
        [`%${query}%`, excludeId]
    );
    if (result.length === 0) return [];
    return result[0].values.map(row => ({ id: row[0], email: row[1], name: row[2] }));
}

// ── Contact Queries ───────────────────────────────────────

function addContact(userId, contactId) {
    db.run('INSERT OR IGNORE INTO contacts (user_id, contact_id) VALUES (?, ?)', [userId, contactId]);
    saveDB();
}

function getContacts(userId) {
    const result = db.exec(
        `SELECT u.id, u.email, u.name FROM contacts c
     JOIN users u ON u.id = c.contact_id
     WHERE c.user_id = ? ORDER BY u.name`, [userId]
    );
    if (result.length === 0) return [];
    return result[0].values.map(row => ({ id: row[0], email: row[1], name: row[2] }));
}

// ── Message Queries ───────────────────────────────────────

function saveMessage(senderId, receiverId, content) {
    db.run('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [senderId, receiverId, content]);
    saveDB();
    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0];
}

function getMessages(userId1, userId2, limit = 50) {
    const result = db.exec(
        `SELECT id, sender_id, receiver_id, content, timestamp FROM messages
     WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
     ORDER BY timestamp DESC LIMIT ?`,
        [userId1, userId2, userId2, userId1, limit]
    );
    if (result.length === 0) return [];
    return result[0].values.map(row => ({
        id: row[0], sender_id: row[1], receiver_id: row[2], content: row[3], timestamp: row[4]
    })).reverse();
}

// ── Notes Queries ─────────────────────────────────────────

function getNotes(userId) {
    const result = db.exec(
        'SELECT id, title, content, updated_at FROM notes WHERE user_id = ? ORDER BY updated_at DESC', [userId]
    );
    if (result.length === 0) return [];
    return result[0].values.map(r => ({ id: r[0], title: r[1], content: r[2], updated_at: r[3] }));
}

function createNote(userId, title, content) {
    db.run('INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)', [userId, title, content]);
    saveDB();
    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0];
}

function updateNote(noteId, userId, title, content) {
    db.run('UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [title, content, noteId, userId]);
    saveDB();
}

function deleteNote(noteId, userId) {
    db.run('DELETE FROM notes WHERE id = ? AND user_id = ?', [noteId, userId]);
    saveDB();
}

// ── Tasks Queries ─────────────────────────────────────────

function getTasks(userId) {
    const result = db.exec(
        'SELECT id, title, completed, due_date, created_at FROM tasks WHERE user_id = ? ORDER BY completed ASC, created_at DESC', [userId]
    );
    if (result.length === 0) return [];
    return result[0].values.map(r => ({ id: r[0], title: r[1], completed: !!r[2], due_date: r[3], created_at: r[4] }));
}

function createTask(userId, title, dueDate) {
    db.run('INSERT INTO tasks (user_id, title, due_date) VALUES (?, ?, ?)', [userId, title, dueDate || null]);
    saveDB();
    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0];
}

function updateTask(taskId, userId, completed) {
    db.run('UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?', [completed ? 1 : 0, taskId, userId]);
    saveDB();
}

function deleteTask(taskId, userId) {
    db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
    saveDB();
}

// ── Saved Sites Queries ───────────────────────────────────

function trackSiteVisit(userId, url, title) {
    const existing = db.exec('SELECT id FROM saved_sites WHERE user_id = ? AND url = ?', [userId, url]);
    if (existing.length > 0 && existing[0].values.length > 0) {
        db.run('UPDATE saved_sites SET visit_count = visit_count + 1, title = ?, last_visited = CURRENT_TIMESTAMP WHERE user_id = ? AND url = ?',
            [title, userId, url]);
    } else {
        db.run('INSERT INTO saved_sites (user_id, url, title) VALUES (?, ?, ?)', [userId, url, title]);
    }
    saveDB();
}

function getFrequentSites(userId, limit = 8) {
    const result = db.exec(
        'SELECT id, url, title, visit_count, pinned FROM saved_sites WHERE user_id = ? ORDER BY pinned DESC, visit_count DESC LIMIT ?',
        [userId, limit]
    );
    if (result.length === 0) return [];
    return result[0].values.map(r => ({ id: r[0], url: r[1], title: r[2], visit_count: r[3], pinned: !!r[4] }));
}

function togglePinSite(siteId, userId, pinned) {
    db.run('UPDATE saved_sites SET pinned = ? WHERE id = ? AND user_id = ?', [pinned ? 1 : 0, siteId, userId]);
    saveDB();
}

function deleteSavedSite(siteId, userId) {
    db.run('DELETE FROM saved_sites WHERE id = ? AND user_id = ?', [siteId, userId]);
    saveDB();
}

// ── Saved Passwords Queries ───────────────────────────────

function savePassword(userId, siteUrl, username, encryptedPassword, iv, authTag) {
    // Upsert: replace if same user+site+username exists
    db.run('DELETE FROM saved_passwords WHERE user_id = ? AND site_url = ? AND username = ?', [userId, siteUrl, username]);
    db.run('INSERT INTO saved_passwords (user_id, site_url, username, encrypted_password, iv, auth_tag) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, siteUrl, username, encryptedPassword, iv, authTag]);
    saveDB();
}

function getPasswordsForSite(userId, siteUrl) {
    // Try exact match first
    let result = db.exec(
        'SELECT id, username, encrypted_password, iv, auth_tag FROM saved_passwords WHERE user_id = ? AND site_url = ?',
        [userId, siteUrl]
    );
    // Fallback: match by origin prefix (handles origin vs full-URL mismatch)
    if (result.length === 0) {
        result = db.exec(
            'SELECT id, username, encrypted_password, iv, auth_tag FROM saved_passwords WHERE user_id = ? AND (site_url LIKE ? OR ? LIKE site_url || \'%\')',
            [userId, siteUrl + '%', siteUrl]
        );
    }
    if (result.length === 0) return [];
    return result[0].values.map(r => ({ id: r[0], username: r[1], encrypted_password: r[2], iv: r[3], auth_tag: r[4] }));
}

function getAllPasswords(userId) {
    const result = db.exec(
        'SELECT id, site_url, username, created_at FROM saved_passwords WHERE user_id = ? ORDER BY site_url', [userId]
    );
    if (result.length === 0) return [];
    return result[0].values.map(r => ({ id: r[0], site_url: r[1], username: r[2], created_at: r[3] }));
}

function deletePassword(passwordId, userId) {
    db.run('DELETE FROM saved_passwords WHERE id = ? AND user_id = ?', [passwordId, userId]);
    saveDB();
}

// ── Registration OTP Queries ──────────────────────────────

function createRegistrationOTP(email, name, passwordHash, code, expiresAt) {
    // Invalidate any existing OTPs for this email
    db.run('UPDATE registration_otp SET used = 1 WHERE email = ? AND used = 0', [email]);
    db.run('INSERT INTO registration_otp (email, name, password_hash, code, expires_at) VALUES (?, ?, ?, ?, ?)',
        [email, name, passwordHash, code, expiresAt]);
    saveDB();
}

function verifyRegistrationOTP(email, code) {
    const result = db.exec(
        `SELECT id, email, name, password_hash FROM registration_otp
         WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now')
         ORDER BY created_at DESC LIMIT 1`,
        [email, code]
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    const row = result[0].values[0];
    return { id: row[0], email: row[1], name: row[2], passwordHash: row[3] };
}

function markRegistrationOTPUsed(otpId) {
    db.run('UPDATE registration_otp SET used = 1 WHERE id = ?', [otpId]);
    saveDB();
}

// ── Password Reset Queries ────────────────────────────────

function createResetToken(userId, code, expiresAt) {
    // Invalidate any existing tokens for this user
    db.run('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0', [userId]);
    db.run('INSERT INTO password_reset_tokens (user_id, code, expires_at) VALUES (?, ?, ?)',
        [userId, code, expiresAt]);
    saveDB();
}

function verifyResetToken(email, code) {
    const user = findUserByEmail(email);
    if (!user) return null;
    const result = db.exec(
        `SELECT id, user_id FROM password_reset_tokens
         WHERE user_id = ? AND code = ? AND used = 0 AND expires_at > datetime('now')
         ORDER BY created_at DESC LIMIT 1`,
        [user.id, code]
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    return { tokenId: result[0].values[0][0], userId: result[0].values[0][1] };
}

function markResetTokenUsed(tokenId) {
    db.run('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [tokenId]);
    saveDB();
}

function updateUserPassword(userId, newPasswordHash) {
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, userId]);
    saveDB();
}

// ── Browsing History Queries ──────────────────────────────

function addHistoryEntry(userId, url, title) {
    db.run('INSERT INTO browsing_history (user_id, url, title) VALUES (?, ?, ?)',
        [userId, url, title || '']);
    saveDB();
}

function getHistory(userId, limit = 200) {
    const result = db.exec(
        'SELECT id, url, title, visited_at FROM browsing_history WHERE user_id = ? ORDER BY visited_at DESC LIMIT ?',
        [userId, limit]
    );
    if (result.length === 0) return [];
    return result[0].values.map(r => ({ id: r[0], url: r[1], title: r[2], visited_at: r[3] }));
}

function clearHistory(userId) {
    db.run('DELETE FROM browsing_history WHERE user_id = ?', [userId]);
    saveDB();
}

function deleteHistoryEntry(entryId, userId) {
    db.run('DELETE FROM browsing_history WHERE id = ? AND user_id = ?', [entryId, userId]);
    saveDB();
}

module.exports = {
    initDB, getDB, saveDB,
    createUser, findUserByEmail, findUserById, searchUsers,
    addContact, getContacts,
    saveMessage, getMessages,
    getNotes, createNote, updateNote, deleteNote,
    getTasks, createTask, updateTask, deleteTask,
    trackSiteVisit, getFrequentSites, togglePinSite, deleteSavedSite,
    savePassword, getPasswordsForSite, getAllPasswords, deletePassword,
    createResetToken, verifyResetToken, markResetTokenUsed, updateUserPassword,
    createRegistrationOTP, verifyRegistrationOTP, markRegistrationOTPUsed,
    addHistoryEntry, getHistory, clearHistory, deleteHistoryEntry
};
