const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const WebSocket = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const CLOB_WS = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    // WebSocket server
    const wss = new WebSocket.Server({ server, path: '/ws' });

    wss.on('connection', (clientWs) => {
        console.log('[WS] Client connected');

        let polymarketWs = null;
        let pingInterval = null;
        let subscribedAssets = [];

        const connectToPolymarket = () => {
            polymarketWs = new WebSocket(CLOB_WS);

            polymarketWs.on('open', () => {
                console.log('[WS] Connected to Polymarket CLOB');
                clientWs.send(JSON.stringify({ type: 'connected', message: 'Connected to Polymarket' }));

                // PING keepalive every 10 seconds
                pingInterval = setInterval(() => {
                    if (polymarketWs && polymarketWs.readyState === WebSocket.OPEN) {
                        polymarketWs.send('PING');
                    }
                }, 10000);

                // Resubscribe to assets with custom features enabled
                if (subscribedAssets.length > 0) {
                    const subMsg = JSON.stringify({
                        assets_ids: subscribedAssets,
                        type: 'market',
                        custom_feature_enabled: true  // Enable new_market, best_bid_ask events
                    });
                    polymarketWs.send(subMsg);
                }
            });

            polymarketWs.on('message', (data) => {
                const msgStr = data.toString();
                if (msgStr !== 'PONG' && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(msgStr);
                }
            });

            polymarketWs.on('close', () => {
                console.log('[WS] Polymarket connection closed');
                if (pingInterval) clearInterval(pingInterval);
                clientWs.send(JSON.stringify({ type: 'disconnected' }));

                // Reconnect after 3 seconds
                setTimeout(() => {
                    if (clientWs.readyState === WebSocket.OPEN) {
                        connectToPolymarket();
                    }
                }, 3000);
            });

            polymarketWs.on('error', (error) => {
                console.error('[WS Error]', error.message);
            });
        };

        connectToPolymarket();

        // Forward messages from client to Polymarket
        clientWs.on('message', (message) => {
            const msgStr = message.toString();

            try {
                const parsed = JSON.parse(msgStr);
                if (parsed.assets_ids && Array.isArray(parsed.assets_ids)) {
                    subscribedAssets = [...new Set([...subscribedAssets, ...parsed.assets_ids])];
                }
            } catch (e) { }

            if (polymarketWs && polymarketWs.readyState === WebSocket.OPEN) {
                polymarketWs.send(msgStr);
            }
        });

        clientWs.on('close', () => {
            console.log('[WS] Client disconnected');
            if (pingInterval) clearInterval(pingInterval);
            if (polymarketWs) polymarketWs.close();
        });
    });

    server.listen(port, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║     Polymarket Leverage Simulator - Next.js + TypeScript          ║
║     Server running at http://localhost:${port}                       ║
╠═══════════════════════════════════════════════════════════════════╣
║     • Aptos-inspired UI with organic color palette                ║
║     • Real-time Polymarket WebSocket integration                  ║
║     • API proxy at /api/events                                    ║
║     • WebSocket relay at /ws                                      ║
╚═══════════════════════════════════════════════════════════════════╝
    `);
    });
});
