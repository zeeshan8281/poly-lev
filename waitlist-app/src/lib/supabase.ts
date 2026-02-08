import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Missing environment variables. Database features disabled.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Types matching our database schema
export interface DbPosition {
    id?: number;
    user_id: string;
    market_id: string;
    title: string;
    prediction: 'yes' | 'no';
    entry_odds: number;
    current_odds?: number;
    liquidation_odds: number;
    position_size: number;
    leverage: number;
    collateral: number;
    status: 'open' | 'closed' | 'liquidated';
    token_id?: string;
    open_time?: string;
    close_time?: string;
}

export interface DbTrade {
    id?: number;
    user_id: string;
    market_id: string;
    market_title: string;
    prediction: 'yes' | 'no';
    entry_price: number;
    exit_price: number;
    position_size: number;
    leverage: number;
    collateral: number;
    pnl: number;
    pnl_percent: number;
    outcome: 'win' | 'loss' | 'liquidated';
    open_time: string;
    close_time?: string;
}

export interface DbWallet {
    id?: number;
    user_id: string;
    balance: number;
    starting_balance: number;
}

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
    return supabaseUrl && supabaseAnonKey && supabaseAnonKey !== 'YOUR_ANON_KEY_HERE';
};
