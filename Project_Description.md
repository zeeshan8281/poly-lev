# Polymarket Leverage Simulator

## Overview
**Polymarket Leverage** is a web-based trading simulator that brings high-leverage trading mechanics to prediction markets. Built with Next.js and Supabase, it allows users to experience the thrill of 10x leverage on real-world events without financial risk.

## Key Features

### 🚀 Waitlist Application (Live)
Values simplicity and conversion.
*   **Viral Growth:** Built-in referral system tracking user invites.
*   **Gamification:** Users see their position in line and total referrals.
*   **Tech Stack:** Next.js (App Router), Supabase (PostgreSQL), server-side API routes for security.

### 📈 Trading Simulator (Main App)
A robust leverage trading interface mimicking professional exchanges.
*   **Real-Time Data:** Streams live odds directly from Polymarket via WebSocket.
*   **Leverage Engine:** Offers up to **10x leverage** on YES/NO outcomes with dynamic PnL tracking.
*   **Portfolio Management:** Tracks open positions, trade history, and account equity in real-time.
*   **Dual Persistence:** Seamlessly syncs trading data between local storage (for speed) and Supabase (for cross-device access).
*   **Risk System:** Automated liquidation logic manages position health.

## Technical Architecture
*   **Frontend:** Next.js 14, React 18, Tailwind CSS, Lucide Icons.
*   **Backend:** Next.js API Routes (Serverless), Custom WebSocket Proxy (Node.js).
*   **Database:** Supabase (PostgreSQL) with Row Level Security.
*   **Auth:** Privy for seamless wallet-based authentication.
