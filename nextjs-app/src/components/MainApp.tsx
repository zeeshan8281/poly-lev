'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { PositionList } from '@/components/PositionList';
import { PositionForm } from '@/components/PositionForm';
import { WalletAnalysis } from '@/components/WalletAnalysis';
import { usePositions } from '@/hooks/usePositions';
import { useMarketSearch } from '@/hooks/useMarketSearch';
import { useWallet, Trade } from '@/hooks/useWallet';
import { Market, Position } from '@/types';
import {
    Compass,
    Wallet,
    DollarSign,
    TrendingUp,
    Activity,
    Search,
    Sparkles,
    LayoutGrid,
    PieChart
} from 'lucide-react';

type Tab = 'discover' | 'mybets' | 'wallet';

export default function MainApp() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // State initialization from URL params
    const initialTab = (searchParams.get('tab') as Tab) || 'discover';
    const initialQuery = searchParams.get('q') || '';

    const [activeTab, setActiveTabState] = useState<Tab>(initialTab);
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);

    const {
        positions,
        wsStatus,
        openPosition,
        closePosition,
        updateOdds,
        calculatePnL,
        getPortfolioStats,
        subscribeToMarket,
        isLoaded: positionsLoaded
    } = usePositions();

    const {
        results,
        popularMarkets,
        isLoading,
        isLoadingPopular,
        error,
        searchMarkets,
        clearResults
    } = useMarketSearch();

    const {
        balance,
        trades,
        isLoaded: walletLoaded,
        recordTrade,
        deductCollateral,
        settlePosition,
        getStats,
        resetWallet,
        startingBalance
    } = useWallet();

    const walletStats = useMemo(() => getStats(), [getStats, trades]);

    // Sync state with URL
    const setActiveTab = (tab: Tab) => {
        setActiveTabState(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.replace(`?${params.toString()}`, { scroll: false });
    };

    // Perform search if query exists in URL on mount
    useEffect(() => {
        if (initialQuery && results.length === 0 && !isLoading) {
            searchMarkets(initialQuery);
        }
    }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            searchMarkets(searchQuery);
            const params = new URLSearchParams(searchParams.toString());
            params.set('q', searchQuery);
            router.replace(`?${params.toString()}`, { scroll: false });
        }
    };

    const handleSelectMarket = (market: Market) => {
        setSelectedMarket(market);
        // Don't clear results here so user doesn't lose context if they cancel
        if (market.tokenIds.length > 0) {
            subscribeToMarket(market.tokenIds);
        }
    };

    const handleOpenPosition = (prediction: 'yes' | 'no', size: number, leverage: number, entryOdds: number) => {
        if (!selectedMarket) return;

        const collateral = size / leverage;

        if (collateral > balance) {
            alert(`Insufficient balance. You need $${collateral.toFixed(2)} but only have $${balance.toFixed(2)}`);
            return;
        }

        const success = deductCollateral(collateral);
        if (!success) {
            alert('Failed to deduct collateral');
            return;
        }

        openPosition(
            {
                id: selectedMarket.id,
                title: selectedMarket.title,
                question: selectedMarket.question,
                tokenIds: selectedMarket.tokenIds
            },
            prediction,
            size,
            leverage,
            entryOdds
        );
        setSelectedMarket(null);
        setActiveTab('mybets');
    };

    const handleClosePosition = (positionId: number) => {
        const position = positions.find(p => p.id === positionId);
        if (!position) return;

        const pnl = calculatePnL(position);
        const pnlPercent = (pnl / position.collateral) * 100;

        settlePosition(position.collateral, pnl);

        const trade: Omit<Trade, 'id'> = {
            marketId: position.marketId,
            marketTitle: position.title,
            prediction: position.prediction,
            entryPrice: position.entryOdds,
            exitPrice: position.currentOdds || position.entryOdds,
            positionSize: position.positionSize,
            leverage: position.leverage,
            collateral: position.collateral,
            pnl,
            pnlPercent,
            openTime: position.openTime,
            closeTime: new Date().toISOString(),
            outcome: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'win'
        };
        recordTrade(trade);
        closePosition(positionId);
    };

    const stats = getPortfolioStats();
    const marketsToShow = results.length > 0 ? results : popularMarkets;
    const activePositions = positions.filter(p => p.status === 'open');

    if (!positionsLoaded || !walletLoaded) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="loader"></div>
                    <p className="text-muted">Loading your leverage terminal...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <Header wsStatus={wsStatus} />

            {/* Hero Section */}
            <div className="hero">
                <h1 className="hero-title">
                    Polymarket <span className="hero-title-italic">Leverage</span>
                </h1>
                <p className="hero-subtitle">
                    Advanced paper trading terminal with 10x leverage on real-time prediction markets.
                </p>
            </div>

            {/* Tabs */}
            <div className="tabs-container">
                <button
                    className={`tab ${activeTab === 'discover' ? 'active' : ''}`}
                    onClick={() => setActiveTab('discover')}
                >
                    <Compass size={18} />
                    Discover
                </button>
                <button
                    className={`tab ${activeTab === 'mybets' ? 'active' : ''}`}
                    onClick={() => setActiveTab('mybets')}
                >
                    <Activity size={18} />
                    My Bets
                    {activePositions.length > 0 && (
                        <span className="tab-badge">{activePositions.length}</span>
                    )}
                </button>
                <button
                    className={`tab ${activeTab === 'wallet' ? 'active' : ''}`}
                    onClick={() => setActiveTab('wallet')}
                >
                    <Wallet size={18} />
                    Wallet
                    {trades.length > 0 && (
                        <span className="tab-badge">{trades.length}</span>
                    )}
                </button>
            </div>

            {/* Position Form Modal */}
            {selectedMarket && (
                <div className="modal-overlay" onClick={() => setSelectedMarket(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Open Position</h3>
                        <p className="text-sm text-muted mb-4">{selectedMarket.question || selectedMarket.title}</p>
                        <div className="wallet-balance-mini">
                            <Wallet size={14} />
                            Available: <strong>${balance.toFixed(2)}</strong>
                        </div>
                        <PositionForm
                            market={selectedMarket}
                            onOpenPosition={handleOpenPosition}
                            onCancel={() => setSelectedMarket(null)}
                        />
                    </div>
                </div>
            )}

            <main className="main-container">
                {/* Discover Tab */}
                {activeTab === 'discover' && (
                    <div>
                        {/* Search */}
                        <form onSubmit={handleSearch} className="search-container">
                            <Search size={18} className="search-icon" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search prediction markets..."
                                className="search-input"
                            />
                            <button type="submit" className="search-btn">
                                Search
                            </button>
                        </form>

                        {/* Section Header */}
                        <div className="section-header">
                            <h2 className="section-title">
                                {results.length > 0 ? (
                                    <>
                                        <Search size={20} />
                                        Search Results
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={20} />
                                        Popular Markets
                                    </>
                                )}
                            </h2>
                            {results.length > 0 ? (
                                <button
                                    onClick={() => {
                                        clearResults();
                                        setSearchQuery('');
                                        const params = new URLSearchParams(searchParams.toString());
                                        params.delete('q');
                                        router.replace(`?${params.toString()}`, { scroll: false });
                                    }}
                                    className="btn btn-secondary"
                                >
                                    Clear
                                </button>
                            ) : (
                                <span className="section-badge">Live</span>
                            )}
                        </div>

                        {/* Error State */}
                        {error && (
                            <div className="error-banner">
                                <p>Error: {error}</p>
                            </div>
                        )}

                        {/* Markets Grid */}
                        {(isLoading || isLoadingPopular) && marketsToShow.length === 0 ? (
                            <div className="loading-container">
                                <div className="loader"></div>
                                <p>Loading markets...</p>
                            </div>
                        ) : (
                            <div className="market-grid">
                                {marketsToShow.map((market) => (
                                    <div key={market.id} className="market-card">
                                        <div className="market-header">
                                            <h3 className="market-title">{market.question || market.title}</h3>
                                            <span className="market-volume">
                                                ${((market.volume || 0) / 1000000).toFixed(1)}M Vol
                                            </span>
                                        </div>
                                        <div className="market-outcomes">
                                            <button
                                                className="outcome-btn yes"
                                                onClick={() => handleSelectMarket(market)}
                                            >
                                                <span className="outcome-label">Yes</span>
                                                <span className="outcome-price">{market.yesPrice?.toFixed(0) || 50}¢</span>
                                            </button>
                                            <button
                                                className="outcome-btn no"
                                                onClick={() => handleSelectMarket(market)}
                                            >
                                                <span className="outcome-label">No</span>
                                                <span className="outcome-price">{market.noPrice?.toFixed(0) || 50}¢</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* My Bets Tab */}
                {activeTab === 'mybets' && (
                    <div>
                        {/* Portfolio Overview */}
                        <div className="portfolio-section">
                            <div className="section-label">
                                <LayoutGrid size={14} />
                                Portfolio Overview
                            </div>
                            <div className="portfolio-grid">
                                <div className="stat-card">
                                    <div className="stat-icon collateral">
                                        <DollarSign size={18} />
                                    </div>
                                    <div className="stat-label">Collateral</div>
                                    <div className="stat-value">${stats.totalCollateral.toFixed(2)}</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon exposure">
                                        <TrendingUp size={18} />
                                    </div>
                                    <div className="stat-label">Exposure</div>
                                    <div className="stat-value">${stats.totalExposure.toFixed(2)}</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon pnl">
                                        <DollarSign size={18} />
                                    </div>
                                    <div className="stat-label">Unrealized P&L</div>
                                    <div className={`stat-value ${stats.unrealizedPnL >= 0 ? 'positive' : 'negative'}`}>
                                        {stats.unrealizedPnL >= 0 ? '+' : ''}${stats.unrealizedPnL.toFixed(2)}
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon positions">
                                        <Activity size={18} />
                                    </div>
                                    <div className="stat-label">Active</div>
                                    <div className="stat-value">{stats.activePositions}</div>
                                </div>
                            </div>
                        </div>

                        {/* Positions Section */}
                        <div className="section-header">
                            <h2 className="section-title">
                                <PieChart size={20} />
                                Your Positions
                            </h2>
                            <span className="section-badge">{stats.activePositions} Active</span>
                        </div>

                        <PositionList
                            positions={positions}
                            calculatePnL={calculatePnL}
                            onClose={handleClosePosition}
                            onUpdateOdds={updateOdds}
                        />
                    </div>
                )}

                {/* Wallet Tab */}
                {activeTab === 'wallet' && walletLoaded && (
                    <WalletAnalysis
                        balance={balance}
                        startingBalance={startingBalance}
                        trades={trades}
                        stats={walletStats}
                        onReset={resetWallet}
                    />
                )}
            </main>
        </div>
    );
}
