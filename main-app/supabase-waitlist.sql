-- Waitlist Table for Polymarket Leverage
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS waitlist (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telegram TEXT,
    twitter TEXT,
    referral_code TEXT UNIQUE NOT NULL,  -- This user's unique code
    referred_by TEXT,  -- Referral code they used to sign up
    referral_count INTEGER DEFAULT 0,  -- How many people used their code
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by ON waitlist(referred_by);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);

-- Enable RLS
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Allow inserts (signups) from anonymous users
CREATE POLICY "Allow anonymous inserts" ON waitlist
    FOR INSERT WITH CHECK (true);

-- Allow reads for checking referral codes
CREATE POLICY "Allow anonymous reads" ON waitlist
    FOR SELECT USING (true);

-- Allow updates for referral count
CREATE POLICY "Allow updates" ON waitlist
    FOR UPDATE USING (true);
