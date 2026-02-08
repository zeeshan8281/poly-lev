# CTO Review: Leverage Polymarket Simulator

**Date:** 2026-02-08
**Reviewer:** Antigravity (AI Assistant)
**Scope:** Architecture, Security, Scalability, and Deployment Readiness

---

## 🏛️ Executive Summary

The project is split into two distinct applications:
1.  **Waitlist App:** A production-ready Next.js application for user acquisition. It is currently deployed and functional.
2.  **Main App (Simulator):** A complex trading simulator with real-time features. It has **critical architectural dependencies** that make it incompatible with standard Serverless deployments (like Vercel) in its current state.

**Overall Rating:**
*   **Waitlist App:** 🟢 Ready (Needs Security Patch)
*   **Main App:** 🔴 Not Ready for Production Deployment (Needs Architecture Refactor)

---

## 🚨 Critical Issues (Immediate Action Required)

### 1. 🔒 Security: Public Database Access (P0 - Critical)
**Severity:** Critical
**Systems Affected:** Waitlist App, Main App

*   **Issue:** The Supabase Row Level Security (RLS) policies are currently configured as `USING (true)` for `SELECT` and `INSERT` operations on the `waitlist`, `positions`, and `trades` tables.
*   **Impact:**
    *   **Waitlist:** Any user with your public `ANON_KEY` (exposed in the browser) can query your entire waitlist database, exposing user emails and names.
    *   **Main App:** Malicious users can query, modify, or delete *other users'* positions and trade history because there is no robust server-side verification of the `user_id`.
*   **Recommended Fix:**
    *   **Waitlist:** Disable public `SELECT` access. Update the API route (`/api/waitlist`) to use a `SUPABASE_SERVICE_ROLE_KEY` (server-side secret) to perform checks and inserts securely.
    *   **Main App:** Implement RLS policies that verify the `auth.uid()`. Since you are using Privy, you must implement a mechanism to verify the Privy Access Token on the backend before trusting the `user_id`.

### 2. 🏗️ Architecture: WebSocket Incompatibility (P1 - Blocker)
**Severity:** High (Blocking Vercel Deployment)
**Systems Affected:** Main App

*   **Issue:** The Main App relies on a custom Node.js server (`server.js`) to host a WebSocket proxy at `/ws`. It connects clients to `ws://localhost:3000/ws`, which then relays messages to Polymarket.
*   **Impact:** **This architecture fails on Vercel.** Vercel deployments use Serverless Functions, which do not run your `server.js` entry point. The `/ws` route will return a 404 error, breaking the live price feed and simulations.
*   **Recommended Fix:**
    *   **Refactor (Recommended):** Update the frontend (`usePositions.ts`) to connect **directly** to Polymarket's WebSocket API (`wss://ws-subscriptions-clob.polymarket.com/ws/market`) from the browser. This removes the dependency on the backend proxy loop and makes the app fully "Serverless-compatible."
    *   **Alternative:** Deploy the Main App to a persistent container service (e.g., Railway, DigitalOcean App Platform, Render) where `server.js` can run continuously.

---

## 🔍 Code Quality & Patterns

### ✅ Strengths
*   **Dual-Layer Persistence:** The simulation logic (`usePositions`, `useWallet`) smartly synchronizes state between Supabase and LocalStorage. This ensures users don't lose data if the network fails and allows for offline capability.
*   **Type Safety:** The codebase uses strong TypeScript definitions for core entities (`Position`, `Trade`, `Wallet`), reducing runtime errors.
*   **Separation of Concerns:** Logic is well-encapsulated in custom hooks, keeping UI components clean and focused on rendering.

### ⚠️ Risks & Technical Debt
*   **Client-Side Trust:** P&L (Profit and Loss) and Liquidation calculations happen entirely on the client side. While acceptable for a Simulator, this architecture is **fundamentally insecure** for any real-money application, as savvy users could manipulate their browser state to avoid losses.
*   **Hardcoded Configuration:** Code contains hardcoded URL assumptions (e.g., `ws://${window.location.host}/ws`) that break when environments change (e.g., local vs. prod).

---

## 📋 Action Plan & Roadmap

### Phase 1: Security Hardening (Immediate)
1.  **Secure Waitlist API:** 
    *   Switch `supabase-js` client in API routes to use `SERVICE_ROLE_KEY`.
    *   Update Supabase RLS policies to `USING (false)` for `SELECT` on the public role.
2.  **Verify Data:** Ensure no sensitive data has already been exposed or scraped.

### Phase 2: Main App Refactor (Before Launch)
1.  **Remove `server.js` Dependency:**
    *   Refactor `usePositions.ts` to connect directly to Polymarket WS.
    *   Implement client-side heartbeat/keepalive for the WebSocket connection.
2.  **Vercel Compatibility Check:**
    *   Deploy the refactored Main App to a Vercel Preview environment.
    *   Verify that real-time prices stream correctly without the custom server.

### Phase 3: Simulator Integrity (Future)
1.  **Server-Side Validation:** Move critical calculations (Liquidation checks, Trade execution prices) to a server-side process (Next.js API Route or separate backend) to prevent client-side manipulation.
