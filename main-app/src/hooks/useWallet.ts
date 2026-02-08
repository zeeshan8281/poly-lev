'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase, isSupabaseConfigured, DbWallet, DbTrade } from '@/lib/supabase';

export interface Trade {
    id: number;
    marketId: string;
    marketTitle: string;
    prediction: 'yes' | 'no';
    entryPrice: number;
    exitPrice: number;
    positionSize: number;
    leverage: number;
    collateral: number;
    pnl: number;
    pnlPercent: number;
    openTime: string;
    closeTime: string;
    outcome: 'win' | 'loss' | 'liquidated';
}

export interface WalletStats {
    startingBalance: number;
    currentBalance: number;
    totalPnL: number;
    totalPnLPercent: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    liquidatedTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    bestTrade: Trade | null;
    worstTrade: Trade | null;
    profitFactor: number;
    maxDrawdown: number;
}

const BASE_STORAGE_KEY = 'polymarket_wallet';
const STARTING_BALANCE = 10000;

interface WalletState {
    balance: number;
    trades: Trade[];
    createdAt: string;
}

export function useWallet() {
    const { user } = usePrivy();
    const userId = user?.id || 'guest';
    const storageKey = `${BASE_STORAGE_KEY}_${userId}`;
    const useSupabase = isSupabaseConfigured() && userId !== 'guest';

    const [balance, setBalance] = useState(STARTING_BALANCE);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load wallet data
    useEffect(() => {
        const loadWallet = async () => {
            setIsLoaded(false);

            if (useSupabase) {
                try {
                    // Load wallet from Supabase
                    const { data: walletData } = await supabase
                        .from('wallets')
                        .select('*')
                        .eq('user_id', userId)
                        .single();

                    if (walletData) {
                        setBalance(walletData.balance);
                    } else {
                        // Create new wallet for user
                        await supabase.from('wallets').insert({
                            user_id: userId,
                            balance: STARTING_BALANCE,
                            starting_balance: STARTING_BALANCE
                        });
                        setBalance(STARTING_BALANCE);
                    }

                    // Load trades from Supabase
                    const { data: tradesData } = await supabase
                        .from('trades')
                        .select('*')
                        .eq('user_id', userId)
                        .order('close_time', { ascending: false });

                    if (tradesData) {
                        setTrades(tradesData.map(t => ({
                            id: t.id,
                            marketId: t.market_id,
                            marketTitle: t.market_title,
                            prediction: t.prediction,
                            entryPrice: t.entry_price,
                            exitPrice: t.exit_price,
                            positionSize: t.position_size,
                            leverage: t.leverage,
                            collateral: t.collateral,
                            pnl: t.pnl,
                            pnlPercent: t.pnl_percent,
                            openTime: t.open_time,
                            closeTime: t.close_time,
                            outcome: t.outcome
                        })));
                    }
                    console.log('[Wallet] Loaded from Supabase');
                } catch (e) {
                    console.error('[Wallet] Supabase error, falling back to localStorage:', e);
                    loadFromLocalStorage();
                }
            } else {
                loadFromLocalStorage();
            }

            setIsLoaded(true);
        };

        const loadFromLocalStorage = () => {
            try {
                const saved = localStorage.getItem(storageKey);
                if (saved) {
                    const state: WalletState = JSON.parse(saved);
                    setBalance(state.balance);
                    setTrades(state.trades);
                } else {
                    setBalance(STARTING_BALANCE);
                    setTrades([]);
                }
            } catch (e) {
                console.error('Failed to load wallet:', e);
                setBalance(STARTING_BALANCE);
                setTrades([]);
            }
        };

        loadWallet();
    }, [userId, storageKey, useSupabase]);

    // Save wallet
    const saveWallet = useCallback(async (newBalance: number, newTrades: Trade[]) => {
        if (useSupabase) {
            try {
                await supabase
                    .from('wallets')
                    .update({ balance: newBalance })
                    .eq('user_id', userId);
            } catch (e) {
                console.error('[Wallet] Failed to save to Supabase:', e);
            }
        }

        // Always save to localStorage as backup
        const state: WalletState = {
            balance: newBalance,
            trades: newTrades,
            createdAt: new Date().toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify(state));
    }, [userId, storageKey, useSupabase]);

    // Record a closed trade
    const recordTrade = useCallback(async (trade: Omit<Trade, 'id'>) => {
        const newTrade: Trade = {
            ...trade,
            id: Date.now()
        };

        const newBalance = balance + trade.pnl;
        const newTrades = [...trades, newTrade];

        setBalance(newBalance);
        setTrades(newTrades);

        if (useSupabase) {
            try {
                await supabase.from('trades').insert({
                    user_id: userId,
                    market_id: trade.marketId,
                    market_title: trade.marketTitle,
                    prediction: trade.prediction,
                    entry_price: trade.entryPrice,
                    exit_price: trade.exitPrice,
                    position_size: trade.positionSize,
                    leverage: trade.leverage,
                    collateral: trade.collateral,
                    pnl: trade.pnl,
                    pnl_percent: trade.pnlPercent,
                    outcome: trade.outcome,
                    open_time: trade.openTime,
                    close_time: trade.closeTime
                });
            } catch (e) {
                console.error('[Wallet] Failed to record trade in Supabase:', e);
            }
        }

        await saveWallet(newBalance, newTrades);
        return newTrade;
    }, [balance, trades, saveWallet, useSupabase, userId]);

    // Deduct collateral when opening position
    const deductCollateral = useCallback(async (amount: number): Promise<boolean> => {
        if (amount > balance) {
            return false;
        }
        const newBalance = balance - amount;
        setBalance(newBalance);
        await saveWallet(newBalance, trades);
        return true;
    }, [balance, trades, saveWallet]);

    // Return collateral + PnL when closing position
    const settlePosition = useCallback(async (collateral: number, pnl: number) => {
        const newBalance = balance + collateral + pnl;
        setBalance(newBalance);
        await saveWallet(newBalance, trades);
    }, [balance, trades, saveWallet]);

    // Calculate wallet stats
    const getStats = useCallback((): WalletStats => {
        const winningTrades = trades.filter(t => t.outcome === 'win');
        const losingTrades = trades.filter(t => t.outcome === 'loss');
        const liquidatedTrades = trades.filter(t => t.outcome === 'liquidated');

        const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
        const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) +
            liquidatedTrades.reduce((sum, t) => sum + t.pnl, 0));

        const avgWin = winningTrades.length > 0
            ? totalWins / winningTrades.length
            : 0;
        const avgLoss = (losingTrades.length + liquidatedTrades.length) > 0
            ? totalLosses / (losingTrades.length + liquidatedTrades.length)
            : 0;

        const sortedByPnl = [...trades].sort((a, b) => b.pnl - a.pnl);
        const bestTrade = sortedByPnl[0] || null;
        const worstTrade = sortedByPnl[sortedByPnl.length - 1] || null;

        let peak = STARTING_BALANCE;
        let maxDrawdown = 0;
        let runningBalance = STARTING_BALANCE;

        for (const trade of trades) {
            runningBalance += trade.pnl;
            if (runningBalance > peak) {
                peak = runningBalance;
            }
            const drawdown = ((peak - runningBalance) / peak) * 100;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }

        return {
            startingBalance: STARTING_BALANCE,
            currentBalance: balance,
            totalPnL,
            totalPnLPercent: (totalPnL / STARTING_BALANCE) * 100,
            totalTrades: trades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            liquidatedTrades: liquidatedTrades.length,
            winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
            avgWin,
            avgLoss,
            bestTrade,
            worstTrade,
            profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
            maxDrawdown
        };
    }, [trades, balance]);

    // Reset wallet
    const resetWallet = useCallback(async () => {
        setBalance(STARTING_BALANCE);
        setTrades([]);

        if (useSupabase) {
            try {
                await supabase
                    .from('wallets')
                    .update({ balance: STARTING_BALANCE })
                    .eq('user_id', userId);
                await supabase
                    .from('trades')
                    .delete()
                    .eq('user_id', userId);
            } catch (e) {
                console.error('[Wallet] Failed to reset in Supabase:', e);
            }
        }

        localStorage.removeItem(storageKey);
    }, [storageKey, useSupabase, userId]);

    return {
        balance,
        trades,
        isLoaded,
        recordTrade,
        deductCollateral,
        settlePosition,
        getStats,
        resetWallet,
        startingBalance: STARTING_BALANCE
    };
}
