// Market types
export interface Market {
    id: string;
    conditionId?: string;
    title: string;
    question: string;
    yesPrice: number;
    noPrice: number;
    tokenIds: string[];
    volume: number;
    isDemo?: boolean;
}

export interface PolymarketEvent {
    id: string;
    title: string;
    description?: string;
    volume?: number;
    markets?: PolymarketMarket[];
}

export interface PolymarketMarket {
    id: string;
    conditionId?: string;
    question?: string;
    outcomePrices?: string;
    clobTokenIds?: string;
}

// Position types
export interface Position {
    id: number;
    marketId: string;
    title: string;
    question: string;
    prediction: 'yes' | 'no';
    entryOdds: number;
    currentOdds: number;
    positionSize: number;
    leverage: number;
    collateral: number;
    liquidationOdds: number;
    tokenId?: string;
    openTime: string;
    status: 'open' | 'closed' | 'liquidated';
}

// WebSocket message types
export interface WSMessage {
    type?: string;
    message?: string;
    price_changes?: PriceChange[];
    asset_id?: string;
    price?: string;
    best_bid?: string;
    best_ask?: string;
    bids?: OrderBookEntry[];
    asks?: OrderBookEntry[];
}

export interface PriceChange {
    asset_id: string;
    price: string;
}

export interface OrderBookEntry {
    price: string;
    size: string;
}

// Portfolio stats
export interface PortfolioStats {
    totalCollateral: number;
    totalExposure: number;
    unrealizedPnL: number;
    activePositions: number;
}

// Price history point (real data from WebSocket)
export interface PricePoint {
    time: Date;
    price: number;
    assetId: string;
}

// Chart data point
export interface ChartPoint {
    time: Date;
    value: number;
    label?: string;
}
