/**
 * Nexus Browser — Chat Module
 * WebSocket-based real-time messaging with online/offline tracking.
 */

const jwt = require('jsonwebtoken');
const db = require('./db');
const { JWT_SECRET } = require('./auth');

// Connected clients: Map<userId, WebSocket>
const onlineUsers = new Map();

function setupChat(wss) {
    wss.on('connection', (ws, req) => {
        let userId = null;

        ws.on('message', (raw) => {
            let msg;
            try {
                msg = JSON.parse(raw);
            } catch {
                return;
            }

            switch (msg.type) {
                case 'auth':
                    handleAuth(ws, msg);
                    break;
                case 'chat':
                    handleChatMessage(ws, userId, msg);
                    break;
                case 'typing':
                    handleTyping(userId, msg);
                    break;
                // WebRTC signaling messages
                case 'call-offer':
                case 'call-answer':
                case 'ice-candidate':
                case 'call-end':
                case 'call-reject':
                    handleSignaling(userId, msg);
                    break;
                default:
                    break;
            }
        });

        ws.on('close', () => {
            if (userId) {
                onlineUsers.delete(userId);
                broadcastStatus(userId, false);
                console.log(`[Chat] User ${userId} disconnected`);
            }
        });

        ws.on('error', (err) => {
            console.error('[Chat] WebSocket error:', err.message);
        });

        // ── Auth Handler ────────────────────────────────────────
        function handleAuth(ws, msg) {
            try {
                const decoded = jwt.verify(msg.token, JWT_SECRET);
                userId = decoded.id;
                onlineUsers.set(userId, ws);
                broadcastStatus(userId, true);

                // Send current online users list
                const onlineList = Array.from(onlineUsers.keys());
                ws.send(JSON.stringify({ type: 'online-users', users: onlineList }));

                console.log(`[Chat] User ${decoded.name} (${userId}) connected`);
            } catch {
                ws.send(JSON.stringify({ type: 'auth-error', error: 'Invalid token' }));
            }
        }
    });
}

// ── Chat Message Handler ────────────────────────────────────

function handleChatMessage(ws, senderId, msg) {
    if (!senderId) return;

    const { to, content } = msg;
    if (!to || !content) return;

    // Persist message
    const msgId = db.saveMessage(senderId, to, content);
    const timestamp = new Date().toISOString();

    // Send to recipient if online
    const recipientWs = onlineUsers.get(to);
    if (recipientWs && recipientWs.readyState === 1) {
        recipientWs.send(JSON.stringify({
            type: 'chat',
            id: msgId,
            from: senderId,
            content,
            timestamp
        }));
    }

    // Acknowledge to sender
    ws.send(JSON.stringify({
        type: 'chat-ack',
        id: msgId,
        to,
        content,
        timestamp
    }));
}

// ── Typing Indicator ────────────────────────────────────────

function handleTyping(senderId, msg) {
    if (!senderId) return;
    const recipientWs = onlineUsers.get(msg.to);
    if (recipientWs && recipientWs.readyState === 1) {
        recipientWs.send(JSON.stringify({
            type: 'typing',
            from: senderId
        }));
    }
}

// ── WebRTC Signaling Relay ──────────────────────────────────

function handleSignaling(senderId, msg) {
    if (!senderId) return;
    const recipientWs = onlineUsers.get(msg.to);
    if (recipientWs && recipientWs.readyState === 1) {
        recipientWs.send(JSON.stringify({
            ...msg,
            from: senderId
        }));
    }
}

// ── Status Broadcasting ─────────────────────────────────────

function broadcastStatus(userId, isOnline) {
    const statusMsg = JSON.stringify({
        type: 'user-status',
        userId,
        online: isOnline
    });

    for (const [id, ws] of onlineUsers) {
        if (id !== userId && ws.readyState === 1) {
            ws.send(statusMsg);
        }
    }
}

function isUserOnline(userId) {
    return onlineUsers.has(userId);
}

module.exports = { setupChat, isUserOnline, onlineUsers };
