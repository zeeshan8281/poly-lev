# Polymarket Leverage Simulator

A paper trading simulator for Polymarket prediction markets with leverage support. Practice trading with 1x-10x leverage on real market data without risking real funds.

![Polymarket Leverage Simulator](https://img.shields.io/badge/status-active-success)
![Node.js](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

### 📊 Real-Time Market Data
- Live market search from Polymarket's Gamma API
- Real-time odds updates via WebSocket connection
- Automatic fallback to demo markets if API unavailable

### 💰 Leverage Trading Simulator
- **Leverage Options**: 1x, 2x, 5x, 10x
- **Automatic Calculations**:
  - Collateral required (Position Size / Leverage)
  - Liquidation price based on leverage
  - Real-time P&L tracking

### 📈 Portfolio Dashboard
- Total Collateral locked
- Total Exposure (leveraged position value)
- Unrealized P&L with color-coded display
- Active positions count
- P&L performance chart

### ⚠️ Risk Management
- Near-liquidation warnings (highlighted in red)
- Liquidation price display for each position
- Position status tracking (open/closed/liquidated)

## Project Structure

```
polymarket-leverage-simulator/
├── package.json          # Node.js dependencies
├── server.js             # Express + WebSocket backend
├── README.md             # This file
└── public/
    ├── index.html        # Main HTML
    ├── styles.css        # Premium dark theme CSS
    └── app.js            # Frontend JavaScript
```

## Installation

1. **Clone or navigate to the project**:
   ```bash
   cd "/Users/zeeshan/leverage polymarket"
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Open in browser**:
   ```
   http://localhost:3000
   ```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves the frontend app |
| `/api/events` | GET | Proxy to Polymarket Gamma API for markets |
| `/api/markets` | GET | Proxy for market details |
| `/api/markets/:id` | GET | Proxy for specific market |
| `/ws` | WebSocket | Real-time price updates relay |

## How It Works

### Leverage Mechanics
- **Position Size**: Total value you're betting
- **Collateral**: Amount locked = Position Size / Leverage
- **Effective Exposure**: Full position size

### P&L Calculation
```
P&L = (odds_change / 100) × position_size × leverage
```

### Liquidation Price
For YES positions: `liquidation = entry_odds - (100 / leverage)`
For NO positions: `liquidation = entry_odds + (100 / leverage)`

### Example
- **Market**: "Will Bitcoin reach $100k?"
- **Entry Odds**: 65% YES
- **Position Size**: $100
- **Leverage**: 5x
- **Collateral**: $20 ($100 / 5)
- **Liquidation**: 45% (65 - 20)

If odds move to 75%:
- P&L = (10 / 100) × $100 × 5 = **+$50** (250% ROE!)

## Tech Stack

- **Backend**: Node.js + Express
- **WebSocket**: ws library
- **Frontend**: Vanilla JavaScript
- **Charts**: Chart.js
- **Styling**: Custom CSS with glassmorphism

## Configuration

### Change Port
Edit `server.js` line 6:
```javascript
const PORT = 3000; // Change to desired port
```

### Polymarket API
The app proxies requests to:
- REST: `https://gamma-api.polymarket.com`
- WebSocket: `wss://ws-subscriptions-clob.polymarket.com/ws/market`

## Screenshots

### Market Search
Search and select from real Polymarket prediction markets.

### Position Entry
Configure leverage, position size, and see calculated metrics.

### Active Positions
Track positions with real-time P&L and liquidation warnings.

## Disclaimer

⚠️ **This is a PAPER TRADING simulator only.** No real funds are involved. This tool is for educational and entertainment purposes. Leveraged trading carries significant risk - never trade with funds you can't afford to lose.

## License

MIT License - Feel free to modify and use as needed.
