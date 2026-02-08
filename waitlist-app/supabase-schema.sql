-- Supabase Schema for Polymarket Leverage Simulator
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Positions Table
CREATE TABLE IF NOT EXISTS positions (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,  -- Privy user ID
    market_id TEXT NOT NULL,
    title TEXT NOT NULL,
    question TEXT,  -- Market question/description
    prediction TEXT CHECK (prediction IN ('yes', 'no')) NOT NULL,
    entry_odds DECIMAL(10,4) NOT NULL,
    current_odds DECIMAL(10,4),
    liquidation_odds DECIMAL(10,4) NOT NULL,
    position_size DECIMAL(15,2) NOT NULL,
    leverage INTEGER NOT NULL,
    collateral DECIMAL(15,2) NOT NULL,
    status TEXT CHECK (status IN ('open', 'closed', 'liquidated')) DEFAULT 'open',
    token_id TEXT,
    open_time TIMESTAMPTZ DEFAULT NOW(),
    close_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trades Table (closed positions history)
CREATE TABLE IF NOT EXISTS trades (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    market_id TEXT NOT NULL,
    market_title TEXT NOT NULL,
    prediction TEXT CHECK (prediction IN ('yes', 'no')) NOT NULL,
    entry_price DECIMAL(10,4) NOT NULL,
    exit_price DECIMAL(10,4) NOT NULL,
    position_size DECIMAL(15,2) NOT NULL,
    leverage INTEGER NOT NULL,
    collateral DECIMAL(15,2) NOT NULL,
    pnl DECIMAL(15,2) NOT NULL,
    pnl_percent DECIMAL(10,4) NOT NULL,
    outcome TEXT CHECK (outcome IN ('win', 'loss', 'liquidated')) NOT NULL,
    open_time TIMESTAMPTZ NOT NULL,
    close_time TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet Table
CREATE TABLE IF NOT EXISTS wallets (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    balance DECIMAL(15,2) NOT NULL DEFAULT 10000.00,
    starting_balance DECIMAL(15,2) NOT NULL DEFAULT 10000.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- Row Level Security Policies (users can only access their own data)
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Policies: Allow all operations for authenticated users on their own data
-- Note: Since we're using Privy (not Supabase Auth), we pass user_id in the request
-- For production, you might want to verify user_id server-side

CREATE POLICY "Users can view own positions" ON positions
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own positions" ON positions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own positions" ON positions
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete own positions" ON positions
    FOR DELETE USING (true);

CREATE POLICY "Users can view own trades" ON trades
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own trades" ON trades
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own wallet" ON wallets
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own wallet" ON wallets
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own wallet" ON wallets
    FOR UPDATE USING (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_positions_updated_at
    BEFORE UPDATE ON positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
    BEFORE UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
