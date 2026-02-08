/**
 * Polymarket Leverage Simulator
 * Paper trading with leverage on prediction markets
 * Uses WebSocket for real-time market data
 */

class PolymarketLeverageSimulator {
    constructor() {
        // State
        this.positions = [];
        this.selectedMarket = null;
        this.pnlHistory = [{ time: new Date(), value: 0 }];
        this.chartInstance = null;
        this.ws = null;
        this.subscribedTokens = new Set();

        // Configuration
        this.leverage = 5;
        this.prediction = 'yes';
        this.useDemoMode = false; // Will auto-enable if API fails

        // Polymarket API endpoints (proxied through our server)
        this.API_BASE = '/api';
        this.WS_URL = `ws://${window.location.host}/ws`;

        // Demo markets for offline testing
        this.demoMarkets = [
            { id: 1, title: "Will Bitcoin reach $100k by Dec 2025?", yesPrice: 64.2, noPrice: 35.8, volume: 2500000 },
            { id: 2, title: "Will Ethereum reach $5k in 2026?", yesPrice: 45.5, noPrice: 54.5, volume: 1800000 },
            { id: 3, title: "Will Trump win 2028 Presidential Election?", yesPrice: 52.3, noPrice: 47.7, volume: 5600000 },
            { id: 4, title: "Will Fed cut rates in Q1 2026?", yesPrice: 71.8, noPrice: 28.2, volume: 890000 },
            { id: 5, title: "Will AI pass bar exam by 2027?", yesPrice: 82.4, noPrice: 17.6, volume: 450000 },
            { id: 6, title: "Will SpaceX land on Mars by 2030?", yesPrice: 38.9, noPrice: 61.1, volume: 1200000 },
            { id: 7, title: "Will Tesla stock hit $500 in 2026?", yesPrice: 44.1, noPrice: 55.9, volume: 2100000 },
            { id: 8, title: "Will Apple announce AR glasses in 2026?", yesPrice: 56.7, noPrice: 43.3, volume: 670000 },
            { id: 9, title: "Will US enter recession in 2026?", yesPrice: 32.5, noPrice: 67.5, volume: 980000 },
            { id: 10, title: "Will Democrats win Senate in 2026?", yesPrice: 48.2, noPrice: 51.8, volume: 3400000 }
        ];

        // Initialize
        this.init();
    }

    init() {
        this.bindEvents();
        this.initChart();
        this.connectWebSocket();
        this.loadPositions();
        this.updatePortfolioSummary();

        // Periodic check for liquidations (no price simulation)
        setInterval(() => this.checkLiquidations(), 10000);
    }

    // WebSocket Connection
    connectWebSocket() {
        this.updateConnectionStatus('connecting');

        try {
            this.ws = new WebSocket(this.WS_URL);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.updateConnectionStatus('connected');
                this.resubscribeToMarkets();
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (e) {
                    console.log('WS message:', event.data);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket closed, reconnecting...');
                this.updateConnectionStatus('disconnected');
                setTimeout(() => this.connectWebSocket(), 3000);
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('error');
            };
        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.updateConnectionStatus('error');
        }
    }

    handleWebSocketMessage(data) {
        // Handle connection status
        if (data.type === 'connected') {
            console.log('[WS] Connected to Polymarket');
            this.updateConnectionStatus('connected');
            return;
        }

        if (data.type === 'disconnected' || data.type === 'error') {
            console.log('[WS] Disconnected:', data.message);
            this.updateConnectionStatus('disconnected');
            return;
        }

        // Handle price_changes array format (main Polymarket format)
        if (data.price_changes && Array.isArray(data.price_changes)) {
            let updated = false;

            data.price_changes.forEach(change => {
                const tokenId = change.asset_id;
                let price = parseFloat(change.price);

                // Polymarket prices are 0-1, convert to percentage
                if (price <= 1) price = price * 100;

                // Update positions with this token
                this.positions.forEach(pos => {
                    if (pos.tokenId === tokenId) {
                        const oldOdds = pos.currentOdds;
                        pos.currentOdds = price;
                        updated = true;
                        console.log(`[WS] Price update: ${pos.title.slice(0, 30)}... ${oldOdds.toFixed(2)}% → ${price.toFixed(2)}%`);

                        // Check for liquidation
                        const isLiquidated = pos.prediction === 'yes'
                            ? pos.currentOdds <= pos.liquidationOdds
                            : pos.currentOdds >= pos.liquidationOdds;

                        if (isLiquidated && pos.status === 'open') {
                            pos.status = 'liquidated';
                            this.showToast(`Position "${pos.title.slice(0, 30)}..." liquidated!`, 'error');
                        }
                    }
                });
            });

            if (updated) {
                this.savePositions();
                this.renderPositions();
                this.updatePortfolioSummary();
            }
            return;
        }

        // Handle array of orderbook snapshots (initial subscription response)
        if (Array.isArray(data)) {
            data.forEach(item => {
                if (item.asset_id && (item.bids || item.asks)) {
                    const tokenId = item.asset_id;
                    // Calculate mid-price from best bid/ask
                    const bestBid = item.bids && item.bids[0] ? parseFloat(item.bids[0].price) : 0;
                    const bestAsk = item.asks && item.asks[0] ? parseFloat(item.asks[0].price) : 1;
                    const price = ((bestBid + bestAsk) / 2) * 100;

                    this.positions.forEach(pos => {
                        if (pos.tokenId === tokenId) {
                            const oldOdds = pos.currentOdds;
                            pos.currentOdds = price;
                            console.log(`[WS] Initial price: ${pos.title.slice(0, 30)}... ${oldOdds.toFixed(2)}% → ${price.toFixed(2)}%`);
                        }
                    });
                }
            });
            this.savePositions();
            this.renderPositions();
            this.updatePortfolioSummary();
            return;
        }

        // Handle single asset updates
        const tokenId = data.asset_id || data.token_id;
        let price = null;

        if (data.price !== undefined) {
            price = parseFloat(data.price);
            if (price <= 1) price = price * 100;
        } else if (data.best_bid !== undefined || data.best_ask !== undefined) {
            const bid = parseFloat(data.best_bid || 0);
            const ask = parseFloat(data.best_ask || 1);
            price = ((bid + ask) / 2) * 100;
        }

        if (tokenId && price !== null) {
            let updated = false;

            this.positions.forEach(pos => {
                if (pos.tokenId === tokenId) {
                    const oldOdds = pos.currentOdds;
                    pos.currentOdds = price;
                    updated = true;
                    console.log(`[WS] Updated: ${oldOdds.toFixed(2)}% → ${price.toFixed(2)}%`);

                    const isLiquidated = pos.prediction === 'yes'
                        ? pos.currentOdds <= pos.liquidationOdds
                        : pos.currentOdds >= pos.liquidationOdds;

                    if (isLiquidated && pos.status === 'open') {
                        pos.status = 'liquidated';
                        this.showToast(`Position "${pos.title.slice(0, 30)}..." liquidated!`, 'error');
                    }
                }
            });

            if (updated) {
                this.savePositions();
                this.renderPositions();
                this.updatePortfolioSummary();
            }
        }
    }

    subscribeToMarket(tokenIds) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const message = {
            type: 'subscribe',
            channel: 'market',
            assets_ids: tokenIds
        };

        this.ws.send(JSON.stringify(message));
        tokenIds.forEach(id => this.subscribedTokens.add(id));
    }

    resubscribeToMarkets() {
        if (this.subscribedTokens.size > 0) {
            this.subscribeToMarket([...this.subscribedTokens]);
        }
    }

    updateConnectionStatus(status) {
        const indicator = document.getElementById('wsStatus');
        const statusText = indicator.querySelector('.status-text');

        indicator.className = 'status-indicator';

        switch (status) {
            case 'connected':
                indicator.classList.add('connected');
                statusText.textContent = 'Live';
                break;
            case 'connecting':
                statusText.textContent = 'Connecting...';
                break;
            case 'disconnected':
            case 'error':
                indicator.classList.add('error');
                statusText.textContent = 'Disconnected';
                break;
        }
    }

    // Event Bindings
    bindEvents() {
        // Search
        document.getElementById('searchBtn').addEventListener('click', () => this.searchMarkets());
        document.getElementById('marketSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchMarkets();
        });

        // Prediction toggle
        document.getElementById('predYes').addEventListener('click', () => this.setPrediction('yes'));
        document.getElementById('predNo').addEventListener('click', () => this.setPrediction('no'));

        // Leverage buttons
        document.querySelectorAll('.lev-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.lev-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.leverage = parseInt(btn.dataset.lev);
                this.updatePositionSummary();
            });
        });

        // Position size input
        document.getElementById('positionSize').addEventListener('input', () => this.updatePositionSummary());

        // Open position button
        document.getElementById('openPositionBtn').addEventListener('click', () => this.openPosition());
    }

    setPrediction(pred) {
        this.prediction = pred;
        document.getElementById('predYes').classList.toggle('active', pred === 'yes');
        document.getElementById('predNo').classList.toggle('active', pred === 'no');
        this.updatePositionSummary();
    }

    // Market Search
    async searchMarkets() {
        const query = document.getElementById('marketSearch').value.trim();
        if (!query) return;

        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '<div class="loading-spinner"></div>';

        try {
            // Try to fetch from Polymarket API with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${this.API_BASE}/events?closed=false&active=true&limit=20`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const events = await response.json();

            // Filter by search query
            const filtered = events.filter(event =>
                event.title.toLowerCase().includes(query.toLowerCase()) ||
                (event.description && event.description.toLowerCase().includes(query.toLowerCase()))
            ).slice(0, 10);

            if (filtered.length === 0) {
                resultsContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">No markets found</p>';
                return;
            }

            resultsContainer.innerHTML = filtered.map(event => {
                const market = event.markets && event.markets[0];
                let yesPrice = '--', noPrice = '--';

                if (market && market.outcomePrices) {
                    try {
                        const prices = JSON.parse(market.outcomePrices);
                        yesPrice = (parseFloat(prices[0]) * 100).toFixed(1);
                        noPrice = (parseFloat(prices[1]) * 100).toFixed(1);
                    } catch (e) { }
                }

                return `
                    <div class="market-item" data-event='${JSON.stringify(event).replace(/'/g, "&#39;")}'>
                        <div class="market-item-title">${event.title}</div>
                        <div class="market-item-meta">
                            <span>Vol: $${this.formatNumber(event.volume || 0)}</span>
                            <div class="market-item-odds">
                                <span class="odds-badge yes">YES ${yesPrice}%</span>
                                <span class="odds-badge no">NO ${noPrice}%</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Add click handlers
            resultsContainer.querySelectorAll('.market-item').forEach(item => {
                item.addEventListener('click', () => {
                    const event = JSON.parse(item.dataset.event);
                    this.selectMarket(event);
                });
            });

        } catch (error) {
            console.warn('API unavailable, using demo markets:', error.message);
            this.useDemoMode = true;
            this.searchDemoMarkets(query, resultsContainer);
        }
    }

    searchDemoMarkets(query, container) {
        // Filter demo markets by query
        const filtered = this.demoMarkets.filter(m =>
            m.title.toLowerCase().includes(query.toLowerCase())
        );

        if (filtered.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">No markets found</p>';
            return;
        }

        container.innerHTML = `
            <div style="padding: 0.5rem; margin-bottom: 0.5rem; background: rgba(245, 158, 11, 0.15); border-radius: 8px; font-size: 0.75rem; color: #f59e0b; display: flex; align-items: center; gap: 0.5rem;">
                <span>⚡</span> Demo Mode - Using simulated markets
            </div>
        ` + filtered.map(market => `
            <div class="market-item" data-market-id="${market.id}">
                <div class="market-item-title">${market.title}</div>
                <div class="market-item-meta">
                    <span>Vol: $${this.formatNumber(market.volume)}</span>
                    <div class="market-item-odds">
                        <span class="odds-badge yes">YES ${market.yesPrice.toFixed(1)}%</span>
                        <span class="odds-badge no">NO ${market.noPrice.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        `).join('');

        // Add click handlers for demo markets
        container.querySelectorAll('.market-item').forEach(item => {
            item.addEventListener('click', () => {
                const marketId = parseInt(item.dataset.marketId);
                const market = this.demoMarkets.find(m => m.id === marketId);
                if (market) this.selectDemoMarket(market);
            });
        });
    }

    selectDemoMarket(market) {
        this.selectedMarket = {
            id: market.id,
            conditionId: null,
            title: market.title,
            question: market.title,
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
            tokenIds: [],
            volume: market.volume,
            isDemo: true
        };

        // Update UI
        document.getElementById('selectedMarket').innerHTML = `
            <div class="selected-market-info">
                <div class="selected-market-title">${this.selectedMarket.title}</div>
                <div class="selected-market-meta">
                    <span>Vol: $${this.formatNumber(this.selectedMarket.volume)}</span>
                    <span style="color: #f59e0b; font-size: 0.75rem;">⚡ Demo</span>
                </div>
            </div>
        `;

        document.getElementById('currentOddsDisplay').innerHTML = `
            <span class="odds-yes">YES: ${market.yesPrice.toFixed(1)}%</span>
            <span class="odds-no">NO: ${market.noPrice.toFixed(1)}%</span>
        `;

        document.getElementById('positionForm').style.display = 'block';
        this.updatePositionSummary();

        // Clear search results
        document.getElementById('searchResults').innerHTML = '';
        document.getElementById('marketSearch').value = '';
    }

    selectMarket(event) {
        const market = event.markets && event.markets[0];
        if (!market) {
            this.showToast('Invalid market data', 'error');
            return;
        }

        let yesPrice = 50, noPrice = 50;
        let tokenIds = [];

        try {
            if (market.outcomePrices) {
                const prices = JSON.parse(market.outcomePrices);
                yesPrice = parseFloat(prices[0]) * 100;
                noPrice = parseFloat(prices[1]) * 100;
            }
            if (market.clobTokenIds) {
                tokenIds = JSON.parse(market.clobTokenIds);
            }
        } catch (e) { }

        this.selectedMarket = {
            id: market.id,
            conditionId: market.conditionId,
            title: event.title,
            question: market.question || event.title,
            yesPrice,
            noPrice,
            tokenIds,
            volume: event.volume || 0
        };

        // Subscribe to market updates
        if (tokenIds.length > 0) {
            this.subscribeToMarket(tokenIds);
        }

        // Update UI
        document.getElementById('selectedMarket').innerHTML = `
            <div class="selected-market-info">
                <div class="selected-market-title">${this.selectedMarket.title}</div>
                <div class="selected-market-meta">
                    <span>Vol: $${this.formatNumber(this.selectedMarket.volume)}</span>
                </div>
            </div>
        `;

        document.getElementById('currentOddsDisplay').innerHTML = `
            <span class="odds-yes">YES: ${yesPrice.toFixed(1)}%</span>
            <span class="odds-no">NO: ${noPrice.toFixed(1)}%</span>
        `;

        document.getElementById('positionForm').style.display = 'block';
        this.updatePositionSummary();

        // Clear search results
        document.getElementById('searchResults').innerHTML = '';
        document.getElementById('marketSearch').value = '';
    }

    updatePositionSummary() {
        if (!this.selectedMarket) return;

        const positionSize = parseFloat(document.getElementById('positionSize').value) || 100;
        const collateral = positionSize / this.leverage;

        document.getElementById('collateralRequired').textContent = `$${collateral.toFixed(2)}`;
        document.getElementById('effectivePosition').textContent = `$${positionSize.toFixed(2)}`;

        // Calculate liquidation point
        const entryOdds = this.prediction === 'yes' ? this.selectedMarket.yesPrice : this.selectedMarket.noPrice;
        const liquidationOdds = this.calculateLiquidationOdds(this.prediction, entryOdds, this.leverage);
        document.getElementById('liquidationPoint').textContent = `${liquidationOdds.toFixed(1)}%`;
    }

    calculateLiquidationOdds(prediction, entryOdds, leverage) {
        // Liquidation occurs when loss equals collateral
        // For YES: liquidated when odds drop such that loss exceeds collateral
        // For NO: liquidated when odds rise such that loss exceeds collateral
        const maxLossPercent = 100 / leverage;

        if (prediction === 'yes') {
            return Math.max(1, entryOdds - maxLossPercent);
        } else {
            return Math.min(99, entryOdds + maxLossPercent);
        }
    }

    openPosition() {
        if (!this.selectedMarket) {
            this.showToast('Please select a market first', 'error');
            return;
        }

        const positionSize = parseFloat(document.getElementById('positionSize').value);
        if (!positionSize || positionSize <= 0) {
            this.showToast('Please enter a valid position size', 'error');
            return;
        }

        const entryOdds = this.prediction === 'yes' ? this.selectedMarket.yesPrice : this.selectedMarket.noPrice;
        const collateral = positionSize / this.leverage;
        const liquidationOdds = this.calculateLiquidationOdds(this.prediction, entryOdds, this.leverage);

        const position = {
            id: Date.now(),
            marketId: this.selectedMarket.id,
            title: this.selectedMarket.title,
            question: this.selectedMarket.question,
            prediction: this.prediction,
            entryOdds,
            currentOdds: entryOdds,
            positionSize,
            leverage: this.leverage,
            collateral,
            liquidationOdds,
            tokenId: this.selectedMarket.tokenIds[this.prediction === 'yes' ? 0 : 1],
            openTime: new Date().toISOString(),
            status: 'open'
        };

        this.positions.push(position);
        this.savePositions();
        this.renderPositions();
        this.updatePortfolioSummary();

        // Reset form
        this.selectedMarket = null;
        document.getElementById('selectedMarket').innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <p>Search and select a market above</p>
            </div>
        `;
        document.getElementById('positionForm').style.display = 'none';

        this.showToast(`Opened ${this.leverage}x ${this.prediction.toUpperCase()} position`, 'success');
    }

    calculatePnL(position) {
        const { prediction, entryOdds, currentOdds, positionSize, leverage } = position;

        let oddsChange;
        if (prediction === 'yes') {
            oddsChange = currentOdds - entryOdds;
        } else {
            oddsChange = entryOdds - currentOdds;
        }

        // P&L is proportional to odds change, amplified by leverage
        const pnl = (oddsChange / 100) * positionSize * leverage;
        return pnl;
    }

    updateCurrentOdds(positionId) {
        const position = this.positions.find(p => p.id === positionId);
        if (!position) return;

        const newOdds = prompt(`Enter current odds for ${position.prediction.toUpperCase()} (1-99):`, position.currentOdds.toFixed(1));

        if (newOdds === null) return;

        const odds = parseFloat(newOdds);
        if (isNaN(odds) || odds < 1 || odds > 99) {
            this.showToast('Please enter a valid odds value (1-99)', 'error');
            return;
        }

        position.currentOdds = odds;

        // Check for liquidation
        const isLiquidated = position.prediction === 'yes'
            ? odds <= position.liquidationOdds
            : odds >= position.liquidationOdds;

        if (isLiquidated) {
            position.status = 'liquidated';
            this.showToast('Position liquidated!', 'error');
        }

        this.savePositions();
        this.renderPositions();
        this.updatePortfolioSummary();
    }

    closePosition(positionId) {
        const position = this.positions.find(p => p.id === positionId);
        if (!position) return;

        const pnl = this.calculatePnL(position);
        const confirmed = confirm(`Close position on "${position.title}"?\nP&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);

        if (confirmed) {
            position.status = 'closed';
            this.savePositions();
            this.renderPositions();
            this.updatePortfolioSummary();
            this.showToast(`Position closed. P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`, pnl >= 0 ? 'success' : 'error');
        }
    }

    renderPositions() {
        const container = document.getElementById('positionsList');
        const activePositions = this.positions.filter(p => p.status === 'open');

        document.getElementById('positionsBadge').textContent = activePositions.length;
        document.getElementById('activePositionsCount').textContent = activePositions.length;

        if (activePositions.length === 0) {
            container.innerHTML = `
                <div class="empty-positions">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M8 12h8M12 8v8"/>
                    </svg>
                    <p>No active positions</p>
                    <span>Open a position to start tracking</span>
                </div>
            `;
            return;
        }

        container.innerHTML = activePositions.map(position => {
            const pnl = this.calculatePnL(position);
            const pnlPercent = (pnl / position.collateral) * 100;
            const pnlClass = pnl >= 0 ? 'positive' : 'negative';
            const isNearLiquidation = position.prediction === 'yes'
                ? (position.currentOdds - position.liquidationOdds) < 5
                : (position.liquidationOdds - position.currentOdds) < 5;

            return `
                <div class="position-item ${isNearLiquidation ? 'near-liquidation' : ''}">
                    <div class="position-header">
                        <div class="position-title">${position.title}</div>
                        <div class="position-pnl">
                            <div class="position-pnl-value ${pnlClass}">
                                ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}
                            </div>
                            <div class="position-pnl-percent ${pnlClass}">
                                ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                    
                    <div class="position-meta">
                        <span class="position-tag ${position.prediction}">${position.prediction.toUpperCase()}</span>
                        <span class="position-tag leverage">${position.leverage}x</span>
                    </div>
                    
                    <div class="position-stats">
                        <div class="position-stat">
                            <div class="position-stat-label">Entry</div>
                            <div class="position-stat-value">${position.entryOdds.toFixed(1)}%</div>
                        </div>
                        <div class="position-stat">
                            <div class="position-stat-label">Current</div>
                            <div class="position-stat-value">${position.currentOdds.toFixed(1)}%</div>
                        </div>
                        <div class="position-stat">
                            <div class="position-stat-label">Liquidation</div>
                            <div class="position-stat-value ${isNearLiquidation ? 'danger' : ''}">${position.liquidationOdds.toFixed(1)}%</div>
                        </div>
                        <div class="position-stat">
                            <div class="position-stat-label">Collateral</div>
                            <div class="position-stat-value">$${position.collateral.toFixed(2)}</div>
                        </div>
                    </div>
                    
                    <div class="position-actions">
                        <button class="position-btn update" onclick="app.updateCurrentOdds(${position.id})">Update Odds</button>
                        <button class="position-btn close" onclick="app.closePosition(${position.id})">Close</button>
                    </div>
                    
                    ${isNearLiquidation ? '<div class="liquidation-warning">⚠️ Near Liquidation!</div>' : ''}
                </div>
            `;
        }).join('');
    }

    updatePortfolioSummary() {
        const activePositions = this.positions.filter(p => p.status === 'open');

        const totalCollateral = activePositions.reduce((sum, p) => sum + p.collateral, 0);
        const totalExposure = activePositions.reduce((sum, p) => sum + p.positionSize, 0);
        const unrealizedPnL = activePositions.reduce((sum, p) => sum + this.calculatePnL(p), 0);

        document.getElementById('totalCollateral').textContent = `$${totalCollateral.toFixed(2)}`;
        document.getElementById('totalExposure').textContent = `$${totalExposure.toFixed(2)}`;

        const pnlElement = document.getElementById('unrealizedPnL');
        pnlElement.textContent = `${unrealizedPnL >= 0 ? '+' : ''}$${unrealizedPnL.toFixed(2)}`;
        pnlElement.className = `stat-value ${unrealizedPnL >= 0 ? 'positive' : 'negative'}`;

        // Update P&L history
        this.pnlHistory.push({ time: new Date(), value: unrealizedPnL });
        if (this.pnlHistory.length > 50) this.pnlHistory.shift();

        this.updateChart();
    }

    checkLiquidations() {
        // Only check for liquidations - no price simulation
        // Real prices come from WebSocket updates only
        this.positions.forEach(position => {
            if (position.status !== 'open') return;

            // Check liquidation based on current (real) odds
            const isLiquidated = position.prediction === 'yes'
                ? position.currentOdds <= position.liquidationOdds
                : position.currentOdds >= position.liquidationOdds;

            if (isLiquidated) {
                position.status = 'liquidated';
                this.savePositions();
                this.renderPositions();
                this.updatePortfolioSummary();
                this.showToast(`Position "${position.title.slice(0, 30)}..." liquidated!`, 'error');
            }
        });
    }

    // Chart
    initChart() {
        const ctx = document.getElementById('pnlChart').getContext('2d');

        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Unrealized P&L',
                    data: [],
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(18, 18, 26, 0.9)',
                        titleColor: 'rgba(255, 255, 255, 0.7)',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: (context) => `P&L: $${context.raw.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.5)',
                            font: { size: 10 },
                            callback: (value) => `$${value}`
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.5)',
                            font: { size: 10 },
                            maxTicksLimit: 6
                        }
                    }
                }
            }
        });
    }

    updateChart() {
        if (!this.chartInstance) return;

        const latestPnL = this.pnlHistory[this.pnlHistory.length - 1].value;
        const color = latestPnL >= 0 ? '#22c55e' : '#ef4444';
        const bgColor = latestPnL >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';

        this.chartInstance.data.labels = this.pnlHistory.map(h =>
            h.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        );
        this.chartInstance.data.datasets[0].data = this.pnlHistory.map(h => h.value);
        this.chartInstance.data.datasets[0].borderColor = color;
        this.chartInstance.data.datasets[0].backgroundColor = bgColor;

        this.chartInstance.update('none');
    }

    // Persistence
    savePositions() {
        localStorage.setItem('polymarket_positions', JSON.stringify(this.positions));
    }

    loadPositions() {
        const saved = localStorage.getItem('polymarket_positions');
        if (saved) {
            try {
                this.positions = JSON.parse(saved);
                this.renderPositions();
            } catch (e) {
                console.error('Failed to load positions:', e);
            }
        }
    }

    // Utilities
    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toFixed(2);
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${type === 'success'
                ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
                : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
            }
            </svg>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// Initialize app
const app = new PolymarketLeverageSimulator();
