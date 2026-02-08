'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Market, PolymarketEvent } from '@/types';

interface PolymarketMarket {
    id: string;
    question: string;
    conditionId?: string;
    slug?: string;
    outcomePrices?: string;
    clobTokenIds?: string;
    volume?: number;
    volumeNum?: number;
    active?: boolean;
    closed?: boolean;
}

function parseEvent(event: PolymarketEvent): Market {
    const market = event.markets?.[0];
    let yesPrice = 50, noPrice = 50;
    let tokenIds: string[] = [];

    try {
        if (market?.outcomePrices) {
            const prices = JSON.parse(market.outcomePrices);
            yesPrice = parseFloat(prices[0]) * 100;
            noPrice = parseFloat(prices[1]) * 100;
        }
        if (market?.clobTokenIds) {
            tokenIds = JSON.parse(market.clobTokenIds);
        }
    } catch (e) { }

    return {
        id: market?.id || event.id,
        conditionId: market?.conditionId,
        title: event.title,
        question: market?.question || event.title,
        yesPrice,
        noPrice,
        tokenIds,
        volume: event.volume || 0
    } as Market;
}

function parseMarket(market: PolymarketMarket): Market {
    let yesPrice = 50, noPrice = 50;
    let tokenIds: string[] = [];

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

    return {
        id: market.id,
        conditionId: market.conditionId,
        title: market.question,
        question: market.question,
        yesPrice,
        noPrice,
        tokenIds,
        volume: market.volumeNum || market.volume || 0
    };
}

export function useMarketSearch() {
    const [results, setResults] = useState<Market[]>([]);
    const [popularMarkets, setPopularMarkets] = useState<Market[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingPopular, setIsLoadingPopular] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // WebSocket for real-time price updates
    const wsRef = useRef<WebSocket | null>(null);
    const subscribedTokensRef = useRef<Set<string>>(new Set());
    const priceMapRef = useRef<Map<string, number>>(new Map());

    // Connect to WebSocket for real-time updates
    useEffect(() => {
        const connect = () => {
            const wsUrl = `ws://${window.location.host}/ws`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[MarketSearch WS] Connected');
                if (subscribedTokensRef.current.size > 0) {
                    const msg = {
                        type: 'market',
                        assets_ids: Array.from(subscribedTokensRef.current),
                        custom_feature_enabled: true
                    };
                    ws.send(JSON.stringify(msg));
                }
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.price_changes && Array.isArray(data.price_changes)) {
                        data.price_changes.forEach((change: any) => {
                            let price = parseFloat(change.best_bid || change.price);
                            if (price <= 1) price = price * 100;
                            priceMapRef.current.set(change.asset_id, price);
                        });

                        // Update popular markets with new prices
                        setPopularMarkets(prev => prev.map(market => {
                            if (market.tokenIds.length >= 2) {
                                const yesPrice = priceMapRef.current.get(market.tokenIds[0]);
                                const noPrice = priceMapRef.current.get(market.tokenIds[1]);
                                if (yesPrice !== undefined || noPrice !== undefined) {
                                    return {
                                        ...market,
                                        yesPrice: yesPrice ?? market.yesPrice,
                                        noPrice: noPrice ?? market.noPrice
                                    };
                                }
                            }
                            return market;
                        }));

                        // Update search results with new prices
                        setResults(prev => prev.map(market => {
                            if (market.tokenIds.length >= 2) {
                                const yesPrice = priceMapRef.current.get(market.tokenIds[0]);
                                const noPrice = priceMapRef.current.get(market.tokenIds[1]);
                                if (yesPrice !== undefined || noPrice !== undefined) {
                                    return {
                                        ...market,
                                        yesPrice: yesPrice ?? market.yesPrice,
                                        noPrice: noPrice ?? market.noPrice
                                    };
                                }
                            }
                            return market;
                        }));
                    }

                    if (data.event_type === 'book' && data.bids && data.bids.length > 0) {
                        const bestBid = parseFloat(data.bids[0].price);
                        priceMapRef.current.set(data.asset_id, bestBid <= 1 ? bestBid * 100 : bestBid);
                    }

                    if (data.event_type === 'last_trade_price') {
                        let price = parseFloat(data.price);
                        if (price <= 1) price = price * 100;
                        priceMapRef.current.set(data.asset_id, price);
                    }
                } catch (e) { }
            };

            ws.onclose = () => {
                console.log('[MarketSearch WS] Disconnected, reconnecting...');
                setTimeout(connect, 3000);
            };

            ws.onerror = (error) => {
                console.error('[MarketSearch WS] Error:', error);
            };
        };

        connect();
        return () => { wsRef.current?.close(); };
    }, []);

    const subscribeToMarkets = useCallback((markets: Market[]) => {
        const allTokenIds: string[] = [];
        markets.forEach(market => {
            market.tokenIds?.forEach(id => {
                subscribedTokensRef.current.add(id);
                allTokenIds.push(id);
            });
        });

        if (wsRef.current?.readyState === WebSocket.OPEN && allTokenIds.length > 0) {
            wsRef.current.send(JSON.stringify({
                type: 'market',
                assets_ids: allTokenIds,
                custom_feature_enabled: true
            }));
            console.log('[MarketSearch WS] Subscribed to', allTokenIds.length, 'tokens');
        }
    }, []);

    // Fetch popular markets on mount
    useEffect(() => {
        const fetchPopular = async () => {
            setIsLoadingPopular(true);
            setError(null);

            try {
                const response = await fetch(`/api/events?closed=false&active=true&limit=50&order=volume`);
                if (!response.ok) throw new Error(`API returned ${response.status}`);

                const events: PolymarketEvent[] = await response.json();
                if (!events || events.length === 0) throw new Error('No markets returned');

                const sorted = events
                    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
                    .slice(0, 12)
                    .map(parseEvent);

                setPopularMarkets(sorted);
                subscribeToMarkets(sorted);
            } catch (err) {
                console.error('[Markets] Failed to fetch:', err);
                setError(err instanceof Error ? err.message : 'Failed to load markets');
            } finally {
                setIsLoadingPopular(false);
            }
        };

        fetchPopular();
    }, [subscribeToMarkets]);

    // Search markets - fetch large batch and filter client-side for accurate results
    const searchMarkets = useCallback(async (query: string) => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        setError(null);
        const searchTerm = query.toLowerCase();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            // Fetch from markets API with larger limit for comprehensive search
            const response = await fetch(`/api/markets?closed=false&active=true&limit=500`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`API returned ${response.status}`);

            const markets: PolymarketMarket[] = await response.json();

            // Client-side filtering for accurate text matching
            const filtered = markets
                .filter(m =>
                    m.question?.toLowerCase().includes(searchTerm) ||
                    m.slug?.toLowerCase().includes(searchTerm)
                )
                .map(parseMarket)
                .sort((a, b) => (b.volume || 0) - (a.volume || 0))
                .slice(0, 50); // Cap at 50 results

            console.log(`[Search] Found ${filtered.length} results for "${query}" (from ${markets.length} markets)`);
            setResults(filtered);
            subscribeToMarkets(filtered);
        } catch (err) {
            console.error('[Search] Failed:', err);
            setError(err instanceof Error ? err.message : 'Search failed');
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, [subscribeToMarkets]);

    const clearResults = useCallback(() => {
        setResults([]);
    }, []);

    return {
        results,
        popularMarkets,
        isLoading,
        isLoadingPopular,
        error,
        searchMarkets,
        clearResults
    };
}
