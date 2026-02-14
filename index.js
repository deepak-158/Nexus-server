/**
 * Nexus Browser — Server Entry Point
 * Express HTTP API + WebSocket server for real-time communication.
 */

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { initDB } = require('./db');
const { router: authRouter } = require('./auth');
const { setupChat } = require('./chat');

const PORT = process.env.PORT || 3002;

async function start() {
    // Initialize database
    await initDB();

    const app = express();

    // Middleware — allow all origins for deployed usage
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }));
    app.use(express.json());

    // REST API routes
    app.use('/api', authRouter);

    // Health check
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Root endpoint
    app.get('/', (req, res) => {
        res.json({ name: 'Nexus Browser Server', version: '1.0.0', status: 'running' });
    });

    // Create HTTP server
    const server = http.createServer(app);

    // WebSocket server (shares the HTTP server)
    const wss = new WebSocketServer({ server, path: '/ws' });
    setupChat(wss);

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`[Server] Nexus Backend running on port ${PORT}`);
        console.log(`[Server] WebSocket available at ws://0.0.0.0:${PORT}/ws`);
    });
}

// Global error handlers for cloud deployment reliability
process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
    console.error('[Server] Unhandled rejection:', err);
});

start().catch(err => {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
});
