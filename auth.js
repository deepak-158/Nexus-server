/**
 * Nexus Browser — Authentication & API Module
 * Handles user auth, JWT, and REST endpoints for notes, tasks, sites, passwords.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');
const { sendWelcomeEmail, sendPasswordResetEmail, sendRegistrationOTP } = require('./email');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-browser-secret-key-change-in-production';
const JWT_EXPIRY = '7d';
// AES-256-GCM key for password encryption (32 bytes)
const ENCRYPTION_KEY = crypto.scryptSync(JWT_SECRET, 'nexus-salt', 32);

// ── Middleware: Verify JWT ─────────────────────────────────

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

// ── Encryption helpers ────────────────────────────────────

function encryptPassword(plaintext) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return { encrypted, iv: iv.toString('hex'), authTag };
}

function decryptPassword(encrypted, ivHex, authTagHex) {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// ══════════════════════════════════════════════════════════
//  AUTH ENDPOINTS
// ══════════════════════════════════════════════════════════

// Step 1: Send OTP to verify email before account creation
router.post('/register/send-otp', async (req, res) => {
    try {
        const { email, name, password } = req.body;
        if (!email || !name || !password) return res.status(400).json({ error: 'Email, name, and password are required' });
        if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

        const existing = db.findUserByEmail(email.toLowerCase());
        if (existing) return res.status(409).json({ error: 'Email already registered' });

        // Hash password now, store with OTP
        const passwordHash = await bcrypt.hash(password, 12);
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        db.createRegistrationOTP(email.toLowerCase(), name.trim(), passwordHash, code, expiresAt);

        const sent = await sendRegistrationOTP(email.toLowerCase(), name.trim(), code);
        if (!sent) {
            return res.status(500).json({ error: 'Failed to send verification email. Try again later.' });
        }

        res.json({ success: true, message: 'Verification code sent to your email.' });
    } catch (err) {
        console.error('[Auth] Registration OTP error:', err.message);
        res.status(500).json({ error: 'Failed to send verification code' });
    }
});

// Step 2: Verify OTP and create account
router.post('/register/verify-otp', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

        const otpData = db.verifyRegistrationOTP(email.toLowerCase(), code);
        if (!otpData) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }

        // Check if user was created between OTP send and verify
        const existing = db.findUserByEmail(email.toLowerCase());
        if (existing) {
            db.markRegistrationOTPUsed(otpData.id);
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Create the user
        const userId = db.createUser(otpData.email, otpData.name, otpData.passwordHash);
        db.markRegistrationOTPUsed(otpData.id);

        const token = jwt.sign({ id: userId, email: otpData.email, name: otpData.name }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

        // Send welcome email (non-blocking)
        sendWelcomeEmail(otpData.email, otpData.name);

        res.status(201).json({ user: { id: userId, email: otpData.email, name: otpData.name }, token });
    } catch (err) {
        console.error('[Auth] Registration verify error:', err.message);
        res.status(500).json({ error: 'Registration failed' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        const user = db.findUserByEmail(email.toLowerCase());
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

        const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
    } catch (err) {
        console.error('[Auth] Login error:', err.message);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ── User search & contacts (unchanged) ────────────────────

router.get('/users/search', authenticateToken, (req, res) => {
    const q = req.query.q;
    if (!q || q.length < 2) return res.json([]);
    res.json(db.searchUsers(q, req.user.id));
});

router.get('/contacts', authenticateToken, (req, res) => {
    res.json(db.getContacts(req.user.id));
});

router.post('/contacts', authenticateToken, (req, res) => {
    const { contactId } = req.body;
    if (!contactId) return res.status(400).json({ error: 'Contact ID required' });
    const contact = db.findUserById(contactId);
    if (!contact) return res.status(404).json({ error: 'User not found' });
    db.addContact(req.user.id, contactId);
    db.addContact(contactId, req.user.id);
    res.json({ success: true, contact });
});

router.get('/messages/:peerId', authenticateToken, (req, res) => {
    const peerId = parseInt(req.params.peerId);
    if (isNaN(peerId)) return res.status(400).json({ error: 'Invalid peer ID' });
    res.json(db.getMessages(req.user.id, peerId));
});

// ══════════════════════════════════════════════════════════
//  NOTES ENDPOINTS
// ══════════════════════════════════════════════════════════

router.get('/notes', authenticateToken, (req, res) => {
    res.json(db.getNotes(req.user.id));
});

router.post('/notes', authenticateToken, (req, res) => {
    const { title, content } = req.body;
    const id = db.createNote(req.user.id, title || 'Untitled', content || '');
    res.status(201).json({ id, title: title || 'Untitled', content: content || '' });
});

router.put('/notes/:id', authenticateToken, (req, res) => {
    const { title, content } = req.body;
    db.updateNote(parseInt(req.params.id), req.user.id, title, content);
    res.json({ success: true });
});

router.delete('/notes/:id', authenticateToken, (req, res) => {
    db.deleteNote(parseInt(req.params.id), req.user.id);
    res.json({ success: true });
});

// ══════════════════════════════════════════════════════════
//  TASKS ENDPOINTS
// ══════════════════════════════════════════════════════════

router.get('/tasks', authenticateToken, (req, res) => {
    res.json(db.getTasks(req.user.id));
});

router.post('/tasks', authenticateToken, (req, res) => {
    const { title, due_date } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const id = db.createTask(req.user.id, title, due_date);
    res.status(201).json({ id, title, completed: false, due_date: due_date || null });
});

router.put('/tasks/:id', authenticateToken, (req, res) => {
    const { completed } = req.body;
    db.updateTask(parseInt(req.params.id), req.user.id, completed);
    res.json({ success: true });
});

router.delete('/tasks/:id', authenticateToken, (req, res) => {
    db.deleteTask(parseInt(req.params.id), req.user.id);
    res.json({ success: true });
});

// ══════════════════════════════════════════════════════════
//  SAVED SITES ENDPOINTS
// ══════════════════════════════════════════════════════════

router.get('/sites', authenticateToken, (req, res) => {
    res.json(db.getFrequentSites(req.user.id));
});

router.post('/sites/visit', authenticateToken, (req, res) => {
    const { url, title } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    db.trackSiteVisit(req.user.id, url, title || '');
    res.json({ success: true });
});

router.put('/sites/:id/pin', authenticateToken, (req, res) => {
    const { pinned } = req.body;
    db.togglePinSite(parseInt(req.params.id), req.user.id, pinned);
    res.json({ success: true });
});

router.delete('/sites/:id', authenticateToken, (req, res) => {
    db.deleteSavedSite(parseInt(req.params.id), req.user.id);
    res.json({ success: true });
});

// ══════════════════════════════════════════════════════════
//  SAVED PASSWORDS ENDPOINTS
// ══════════════════════════════════════════════════════════

router.post('/passwords', authenticateToken, (req, res) => {
    const { site_url, username, password } = req.body;
    if (!site_url || !username || !password) return res.status(400).json({ error: 'site_url, username, password required' });
    const { encrypted, iv, authTag } = encryptPassword(password);
    db.savePassword(req.user.id, site_url, username, encrypted, iv, authTag);
    res.status(201).json({ success: true });
});

router.get('/passwords', authenticateToken, (req, res) => {
    res.json(db.getAllPasswords(req.user.id));
});

router.get('/passwords/lookup', authenticateToken, (req, res) => {
    const siteUrl = req.query.site_url;
    if (!siteUrl) return res.json([]);
    const creds = db.getPasswordsForSite(req.user.id, siteUrl);
    // Decrypt passwords before sending
    const decrypted = creds.map(c => ({
        id: c.id,
        username: c.username,
        password: decryptPassword(c.encrypted_password, c.iv, c.auth_tag)
    }));
    res.json(decrypted);
});

router.delete('/passwords/:id', authenticateToken, (req, res) => {
    db.deletePassword(parseInt(req.params.id), req.user.id);
    res.json({ success: true });
});

// ══════════════════════════════════════════════════════════
//  FORGOT / RESET PASSWORD ENDPOINTS
// ══════════════════════════════════════════════════════════

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = db.findUserByEmail(email.toLowerCase());
        if (!user) {
            return res.status(404).json({ error: 'No account found with this email address. Please create an account first.' });
        }

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        // Expires in 15 minutes
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        db.createResetToken(user.id, code, expiresAt);

        const sent = await sendPasswordResetEmail(user.email, user.name, code);
        if (!sent) {
            return res.status(500).json({ error: 'Failed to send reset email. Try again later.' });
        }

        res.json({ success: true, message: 'Reset code sent to your email.' });
    } catch (err) {
        console.error('[Auth] Forgot password error:', err.message);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

router.post('/verify-reset-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

        const tokenData = db.verifyResetToken(email.toLowerCase(), code);
        if (!tokenData) {
            return res.status(400).json({ error: 'Invalid or expired code' });
        }

        res.json({ success: true, valid: true });
    } catch (err) {
        console.error('[Auth] Verify reset code error:', err.message);
        res.status(500).json({ error: 'Verification failed' });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        if (!email || !code || !newPassword) return res.status(400).json({ error: 'All fields are required' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

        const tokenData = db.verifyResetToken(email.toLowerCase(), code);
        if (!tokenData) {
            return res.status(400).json({ error: 'Invalid or expired code' });
        }

        const newHash = await bcrypt.hash(newPassword, 12);
        db.updateUserPassword(tokenData.userId, newHash);
        db.markResetTokenUsed(tokenData.tokenId);

        res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
    } catch (err) {
        console.error('[Auth] Reset password error:', err.message);
        res.status(500).json({ error: 'Password reset failed' });
    }
});

// ══════════════════════════════════════════════════════════
//  BROWSING HISTORY ENDPOINTS (per-user)
// ══════════════════════════════════════════════════════════

router.get('/history', authenticateToken, (req, res) => {
    const limit = parseInt(req.query.limit) || 200;
    res.json(db.getHistory(req.user.id, limit));
});

router.post('/history', authenticateToken, (req, res) => {
    const { url, title } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    db.addHistoryEntry(req.user.id, url, title || '');
    res.json({ success: true });
});

router.delete('/history', authenticateToken, (req, res) => {
    db.clearHistory(req.user.id);
    res.json({ success: true });
});

router.delete('/history/:id', authenticateToken, (req, res) => {
    db.deleteHistoryEntry(parseInt(req.params.id), req.user.id);
    res.json({ success: true });
});

module.exports = { router, authenticateToken, JWT_SECRET };
