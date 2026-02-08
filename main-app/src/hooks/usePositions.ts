'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Position, WSMessage, PricePoint, ChartPoint } from '@/types';
import { usePrivy } from '@privy-io/react-auth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const BASE_STORAGE_KEY = 'polymarket_positions';
const MAX_PRICE_HISTORY = 120; // 1 hour of data at 30s intervals

export function usePositions() {
    const { user } = usePrivy();
    const userId = user?.id || 'guest';
    const storageKey = `${BASE_STORAGE_KEY}_${userId}`;
    const useSupabaseDb = isSupabaseConfigured() && userId !== 'guest';

    const [positions, setPositions] = useState<Position[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
    const [chartData, setChartData] = useState<ChartPoint[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    const subscribedTokensRef = useRef<Set<string>>(new Set());
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isUnmountedRef = useRef(false);
    const lastPriceRef = useRef<Map<string, number>>(new Map());

    // Load positions from database or localStorage
    useEffect(() => {
        const loadPositions = async () => {
            setIsLoaded(false);
            subscribedTokensRef.current.clear();

            if (useSupabaseDb) {
                try {
                    const { data, error } = await supabase
                        .from('positions')
                        .select('*')
                        .eq('user_id', userId)
                        .eq('status', 'open');

                    if (data && !error) {
                        const loadedPositions: Position[] = data.map(p => ({
                            id: p.id,
                            marketId: p.market_id,
                            title: p.title,
                            question: p.question || p.title, // Fallback to title if question not stored
                            prediction: p.prediction,
                            entryOdds: Number(p.entry_odds),
                            currentOdds: p.current_odds ? Number(p.current_odds) : Number(p.entry_odds),
                            liquidationOdds: Number(p.liquidation_odds),
                            positionSize: Number(p.position_size),
                            leverage: p.leverage,
                            collateral: Number(p.collateral),
                            status: p.status,
                            tokenId: p.token_id,
                            openTime: p.open_time
                        }));
                        setPositions(loadedPositions);
                        loadedPositions.forEach(p => {
                            if (p.tokenId) subscribedTokensRef.current.add(p.tokenId);
                        });
                        console.log('[Positions] Loaded from Supabase:', loadedPositions.length);
                    }
                } catch (e) {
                    console.error('[Positions] Supabase error, falling back to localStorage:', e);
                    loadFromLocalStorage();
                }
            } else {
                loadFromLocalStorage();
            }
            setIsLoaded(true);
        };

        const loadFromLocalStorage = () => {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setPositions(parsed);
                    parsed.forEach((p: Position) => {
                        if (p.tokenId) subscribedTokensRef.current.add(p.tokenId);
                    });
                } catch (e) {
                    console.error('Failed to load positions:', e);
                    setPositions([]);
                }
            } else {
                setPositions([]);
            }
        };

        loadPositions();
    }, [userId, storageKey, useSupabaseDb]);

    // Save positions to database and localStorage
    const savePositions = useCallback(async (newPositions: Position[]) => {
        setPositions(newPositions);
        if (isLoaded) {
            localStorage.setItem(storageKey, JSON.stringify(newPositions));
        }
    }, [isLoaded, storageKey]);

    // Handle WebSocket messages - TRACK REAL PRICES
    const handleWebSocketMessage = useCallback((data: WSMessage) => {
        if (data.type === 'connected') {
            setWsStatus('connected');
            return;
        }

        if (data.type === 'disconnected' || data.type === 'error') {
            setWsStatus('disconnected');
            return;
        }

        // Handle price_changes array format - THIS IS REAL POLYMARKET DATA
        if (data.price_changes && Array.isArray(data.price_changes)) {
            const now = new Date();

            data.price_changes.forEach(change => {
                let price = parseFloat(change.price);
                if (price <= 1) price = price * 100; // Convert from decimal to percentage

                // Store real price point
                const pricePoint: PricePoint = {
                    time: now,
                    price: price,
                    assetId: change.asset_id
                };

                // Update price history with real data
                setPriceHistory(prev => {
                    const newHistory = [...prev, pricePoint];
                    // Keep last MAX_PRICE_HISTORY points
                    return newHistory.slice(-MAX_PRICE_HISTORY * 10); // More history for multiple assets
                });

                // Track last price per asset
                lastPriceRef.current.set(change.asset_id, price);
            });

            // Update positions with real prices
            setPositions(prev => {
                let updated = false;
                const newPositions = prev.map(pos => {
                    const change = data.price_changes!.find(c => c.asset_id === pos.tokenId);
                    if (change) {
                        let price = parseFloat(change.price);
                        if (price <= 1) price = price * 100;
                        updated = true;

                        const isLiquidated = pos.prediction === 'yes'
                            ? price <= pos.liquidationOdds
                            : price >= pos.liquidationOdds;

                        return {
                            ...pos,
                            currentOdds: price,
                            status: isLiquidated && pos.status === 'open' ? 'liquidated' as const : pos.status
                        };
                    }
                    return pos;
                });

                if (updated) {
                    localStorage.setItem(storageKey, JSON.stringify(newPositions));
                }
                return newPositions;
            });
        }
    }, [storageKey]);

    // Handle WebSocket and PING/PONG
    useEffect(() => {
        isUnmountedRef.current = false;
        let pingInterval: NodeJS.Timeout | null = null;

        const connect = () => {
            if (isUnmountedRef.current) return;

            if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
                return; // Already collecting or connected
            }

            // DIRECT CONNECTION TO POLYMARKET
            const wsUrl = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                if (isUnmountedRef.current) {
                    ws.close();
                    return;
                }
                console.log('[WS] Connected directly to Polymarket CLOB');
                setWsStatus('connected');

                // START PING INTERVAL (Keep-Alive)
                // Polymarket requires regular activity or it disconnects
                pingInterval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send('PING');
                    }
                }, 10000); // Every 10 seconds

                // Resubscribe to existing tokens if any
                const savedPositions = localStorage.getItem(storageKey);
                if (savedPositions) {
                    try {
                        const parsed = JSON.parse(savedPositions) as Position[];
                        const tokensToSub = parsed
                            .filter(p => p.status === 'open' && p.tokenId)
                            .map(p => p.tokenId as string);

                        if (tokensToSub.length > 0) {
                            tokensToSub.forEach(id => subscribedTokensRef.current.add(id));
                        }
                    } catch (e) { console.error(e); }
                }

                if (subscribedTokensRef.current.size > 0) {
                    const msg = {
                        type: 'market',
                        assets_ids: Array.from(subscribedTokensRef.current)
                    };
                    ws.send(JSON.stringify(msg));
                    console.log('[WS] Resubscribed to:', subscribedTokensRef.current.size, 'assets');
                }
            };

            ws.onmessage = (event) => {
                const dataStr = event.data.toString();

                // Handle PONG responses (ignore them)
                if (dataStr === 'PONG') return;

                try {
                    const data: WSMessage = JSON.parse(dataStr);
                    handleWebSocketMessage(data);
                } catch (e) {
                    // console.error('[WS Parse Error]', e); 
                }
            };

            ws.onclose = () => {
                if (isUnmountedRef.current) return;
                console.log('[WS] Disconnected');
                setWsStatus('disconnected');
                if (pingInterval) clearInterval(pingInterval);

                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }
                reconnectTimeoutRef.current = setTimeout(connect, 3000); // Retry sooner
            };

            ws.onerror = (err) => {
                if (isUnmountedRef.current) return;
                console.error('[WS Error]', err);
                setWsStatus('disconnected');
            };
        };

        connect();

        return () => {
            isUnmountedRef.current = true;
            if (pingInterval) clearInterval(pingInterval);
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [handleWebSocketMessage, storageKey]);

    // Subscribe to market tokens
    const subscribeToMarket = useCallback((tokenIds: string[]) => {
        tokenIds.forEach(id => subscribedTokensRef.current.add(id));

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const msg = {
                type: 'market',
                assets_ids: tokenIds
            };
            wsRef.current.send(JSON.stringify(msg));
            console.log('[WS] Subscribed to tokens:', tokenIds);
        }
    }, []);

    // Calculate P&L for a position
    const calculatePnL = useCallback((position: Position): number => {
        const { prediction, entryOdds, currentOdds, positionSize, leverage } = position;
        const oddsChange = prediction === 'yes'
            ? currentOdds - entryOdds
            : entryOdds - currentOdds;
        return (oddsChange / 100) * positionSize * leverage;
    }, []);

    // Calculate liquidation odds
    const calculateLiquidationOdds = useCallback((prediction: 'yes' | 'no', entryOdds: number, leverage: number): number => {
        const maxLossPercent = 100 / leverage;
        if (prediction === 'yes') {
            return Math.max(1, entryOdds - maxLossPercent);
        } else {
            return Math.min(99, entryOdds + maxLossPercent);
        }
    }, []);

    // Open a new position
    const openPosition = useCallback(async (
        market: { id: string; title: string; question: string; tokenIds: string[] },
        prediction: 'yes' | 'no',
        size: number,
        leverage: number,
        entryOdds: number
    ) => {
        const collateral = size / leverage;
        const liquidationOdds = calculateLiquidationOdds(prediction, entryOdds, leverage);
        const tokenId = prediction === 'yes' ? market.tokenIds[0] : market.tokenIds[1];

        const newPosition: Position = {
            id: Date.now(),
            marketId: market.id,
            title: market.title,
            question: market.question,
            prediction,
            entryOdds,
            currentOdds: entryOdds,
            positionSize: size,
            leverage,
            collateral,
            liquidationOdds,
            tokenId,
            openTime: new Date().toISOString(),
            status: 'open'
        };

        // Subscribe to price updates for this token
        if (tokenId) {
            subscribeToMarket([tokenId]);
        }

        // Save to Supabase if available
        if (useSupabaseDb) {
            try {
                const { data, error } = await supabase.from('positions').insert({
                    user_id: userId,
                    market_id: market.id,
                    title: market.title,
                    question: market.question,
                    prediction,
                    entry_odds: entryOdds,
                    current_odds: entryOdds,
                    liquidation_odds: liquidationOdds,
                    position_size: size,
                    leverage,
                    collateral,
                    status: 'open',
                    token_id: tokenId,
                    open_time: newPosition.openTime
                }).select().single();

                if (data && !error) {
                    newPosition.id = data.id; // Use Supabase ID
                    console.log('[Positions] Saved to Supabase:', data.id);
                }
            } catch (e) {
                console.error('[Positions] Failed to save to Supabase:', e);
            }
        }

        savePositions([...positions, newPosition]);
    }, [positions, savePositions, subscribeToMarket, calculateLiquidationOdds, useSupabaseDb, userId]);

    // Close a position
    const closePosition = useCallback(async (positionId: number) => {
        // Update in Supabase if available
        if (useSupabaseDb) {
            try {
                await supabase
                    .from('positions')
                    .update({ status: 'closed', close_time: new Date().toISOString() })
                    .eq('id', positionId);
                console.log('[Positions] Closed in Supabase:', positionId);
            } catch (e) {
                console.error('[Positions] Failed to close in Supabase:', e);
            }
        }

        savePositions(positions.map(p =>
            p.id === positionId ? { ...p, status: 'closed' as const } : p
        ));
    }, [positions, savePositions, useSupabaseDb]);

    // Update odds manually (for testing)
    const updateOdds = useCallback((positionId: number, newOdds: number) => {
        savePositions(positions.map(p => {
            if (p.id !== positionId) return p;

            const isLiquidated = p.prediction === 'yes'
                ? newOdds <= p.liquidationOdds
                : newOdds >= p.liquidationOdds;

            return {
                ...p,
                currentOdds: newOdds,
                status: isLiquidated ? 'liquidated' as const : p.status
            };
        }));
    }, [positions, savePositions]);

    // Get portfolio stats
    const getPortfolioStats = useCallback(() => {
        const activePositions = positions.filter(p => p.status === 'open');
        return {
            totalCollateral: activePositions.reduce((sum, p) => sum + p.collateral, 0),
            totalExposure: activePositions.reduce((sum, p) => sum + p.positionSize, 0),
            unrealizedPnL: activePositions.reduce((sum, p) => sum + calculatePnL(p), 0),
            activePositions: activePositions.length
        };
    }, [positions, calculatePnL]);

    // Build chart data from real price history
    // Shows the first subscribed asset's price over time
    const getChartData = useCallback((): ChartPoint[] => {
        if (priceHistory.length === 0) {
            return [];
        }

        // Get the first asset we're tracking
        const firstAssetId = priceHistory[0]?.assetId;
        if (!firstAssetId) return [];

        // Filter and deduplicate by time (take last price per second)
        const assetPrices = priceHistory
            .filter(p => p.assetId === firstAssetId)
            .reduce((acc, point) => {
                const timeKey = Math.floor(point.time.getTime() / 1000);
                acc.set(timeKey, point);
                return acc;
            }, new Map<number, PricePoint>());

        // Convert to chart points
        const chartPoints: ChartPoint[] = Array.from(assetPrices.values())
            .sort((a, b) => a.time.getTime() - b.time.getTime())
            .slice(-MAX_PRICE_HISTORY)
            .map(p => ({
                time: p.time,
                value: p.price
            }));

        return chartPoints;
    }, [priceHistory]);

    // Update chart data when price history changes
    useEffect(() => {
        setChartData(getChartData());
    }, [priceHistory, getChartData]);

    return {
        positions,
        wsStatus,
        priceHistory,
        chartData,
        openPosition,
        closePosition,
        updateOdds,
        calculatePnL,
        getPortfolioStats,
        subscribeToMarket,
        isLoaded
    };
}
