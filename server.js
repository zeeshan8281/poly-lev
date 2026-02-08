const express = require('express');
const fetch = require('node-fetch');
const WebSocket = require('ws');
const path = require('path');
const http = require('http');

const app = express();
const PORT = 3000;

// Polymarket API endpoints
const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_WS = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API proxy for Polymarket Gamma API
app.get('/api/events', async (req, res) => {
    try {
        const queryString = new URLSearchParams(req.query).toString();
        const url = `${GAMMA_API}/events${queryString ? '?' + queryString : ''}`;

        console.log(`[API] Fetching: ${url}`);

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'PolymarketLeverageSimulator/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`Polymarket API returned ${response.status}`);
        }

        const data = await response.json();
        console.log(`[API] Got ${data.length} events`);
        res.json(data);
    } catch (error) {
        console.error('[API Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/markets', async (req, res) => {
    try {
        const queryString = new URLSearchParams(req.query).toString();
        const url = `${GAMMA_API}/markets${queryString ? '?' + queryString : ''}`;

        console.log(`[API] Fetching: ${url}`);

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'PolymarketLeverageSimulator/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`Polymarket API returned ${response.status}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[API Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/markets/:id', async (req, res) => {
    try {
        const url = `${GAMMA_API}/markets/${req.params.id}`;

        console.log(`[API] Fetching: ${url}`);

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'PolymarketLeverageSimulator/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`Polymarket API returned ${response.status}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[API Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for proxying to Polymarket CLOB
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (clientWs) => {
    console.log('[WS] Client connected');

    // Connect to Polymarket WebSocket
    let polymarketWs = null;
    let pingInterval = null;
    let subscribedAssets = [];

    const connectToPolymarket = () => {
        polymarketWs = new WebSocket(CLOB_WS);

        polymarketWs.on('open', () => {
            console.log('[WS] Connected to Polymarket CLOB');
            clientWs.send(JSON.stringify({ type: 'connected', message: 'Connected to Polymarket' }));

            // Start PING keepalive (per Polymarket docs - every 10 seconds)
            pingInterval = setInterval(() => {
                if (polymarketWs && polymarketWs.readyState === WebSocket.OPEN) {
                    polymarketWs.send('PING');
                }
            }, 10000);

            // Resubscribe to any previously subscribed assets
            if (subscribedAssets.length > 0) {
                const subMsg = JSON.stringify({ assets_ids: subscribedAssets, type: 'market' });
                console.log('[WS] Resubscribing:', subMsg);
                polymarketWs.send(subMsg);
            }
        });

        polymarketWs.on('message', (data) => {
            const msgStr = data.toString();

            // Log all messages for debugging
            if (msgStr !== 'PONG') {
                console.log('[WS] Polymarket →', msgStr.substring(0, 200));
            }

            // Forward messages from Polymarket to client
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(msgStr);
            }
        });

        polymarketWs.on('close', () => {
            console.log('[WS] Polymarket connection closed');
            if (pingInterval) clearInterval(pingInterval);
            clientWs.send(JSON.stringify({ type: 'disconnected', message: 'Polymarket connection closed' }));

            // Attempt to reconnect after 3 seconds
            setTimeout(() => {
                if (clientWs.readyState === WebSocket.OPEN) {
                    console.log('[WS] Attempting to reconnect to Polymarket...');
                    connectToPolymarket();
                }
            }, 3000);
        });

        polymarketWs.on('error', (error) => {
            console.error('[WS Error]', error.message);
            clientWs.send(JSON.stringify({ type: 'error', message: error.message }));
        });
    };

    connectToPolymarket();

    // Forward messages from client to Polymarket
    clientWs.on('message', (message) => {
        const msgStr = message.toString();
        console.log('[WS] Client →', msgStr);

        // Track subscribed assets for reconnection
        try {
            const parsed = JSON.parse(msgStr);
            if (parsed.assets_ids && Array.isArray(parsed.assets_ids)) {
                subscribedAssets = [...new Set([...subscribedAssets, ...parsed.assets_ids])];
                console.log('[WS] Now tracking', subscribedAssets.length, 'assets');
            }
        } catch (e) { }

        if (polymarketWs && polymarketWs.readyState === WebSocket.OPEN) {
            polymarketWs.send(msgStr);
        }
    });

    clientWs.on('close', () => {
        console.log('[WS] Client disconnected');
        if (pingInterval) clearInterval(pingInterval);
        if (polymarketWs) {
            polymarketWs.close();
        }
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Polymarket Leverage Simulator                         ║
║     Server running at http://localhost:${PORT}               ║
╠═══════════════════════════════════════════════════════════╣
║  API Endpoints:                                           ║
║    GET /api/events    - Fetch prediction markets          ║
║    GET /api/markets   - Fetch market details              ║
║    WS  /ws            - Real-time price updates           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});
