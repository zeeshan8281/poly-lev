'use client';

import { Trade, WalletStats } from '@/hooks/useWallet';
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    Trophy,
    Skull,
    Target,
    BarChart3,
    RefreshCcw,
    ChevronDown,
    ChevronUp,
    Zap,
    AlertTriangle
} from 'lucide-react';
import { useState } from 'react';

interface WalletAnalysisProps {
    balance: number;
    startingBalance: number;
    trades: Trade[];
    stats: WalletStats;
    onReset: () => void;
}

export function WalletAnalysis({ balance, startingBalance, trades, stats, onReset }: WalletAnalysisProps) {
    const [showAllTrades, setShowAllTrades] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);

    const balanceChange = balance - startingBalance;
    const balanceChangePercent = (balanceChange / startingBalance) * 100;
    const isProfit = balanceChange >= 0;

    const displayedTrades = showAllTrades ? trades : trades.slice(-5).reverse();

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(value);
    };

    const formatPercent = (value: number) => {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    };

    return (
        <div className="wallet-analysis">
            {/* Wallet Balance Card */}
            <div className="wallet-balance-card">
                <div className="wallet-header">
                    <div className="wallet-icon">
                        <Wallet size={24} />
                    </div>
                    <div className="wallet-title">
                        <span>Paper Trading Wallet</span>
                        <span className="wallet-subtitle">Simulated Balance</span>
                    </div>
                    <button
                        className="reset-btn"
                        onClick={() => setConfirmReset(true)}
                        title="Reset Wallet"
                    >
                        <RefreshCcw size={16} />
                    </button>
                </div>

                <div className="balance-display">
                    <div className="balance-amount">{formatCurrency(balance)}</div>
                    <div className={`balance-change ${isProfit ? 'profit' : 'loss'}`}>
                        {isProfit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        {formatCurrency(Math.abs(balanceChange))} ({formatPercent(balanceChangePercent)})
                    </div>
                </div>

                <div className="balance-bar">
                    <div
                        className={`balance-fill ${isProfit ? 'profit' : 'loss'}`}
                        style={{ width: `${Math.min(100, Math.max(0, (balance / startingBalance) * 100))}%` }}
                    />
                </div>
                <div className="balance-labels">
                    <span>$0</span>
                    <span>Starting: {formatCurrency(startingBalance)}</span>
                </div>
            </div>

            {/* Reset Confirmation Modal */}
            {confirmReset && (
                <div className="modal-overlay" onClick={() => setConfirmReset(false)}>
                    <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
                        <AlertTriangle size={48} color="var(--accent-amber)" />
                        <h3>Reset Wallet?</h3>
                        <p>This will reset your balance to {formatCurrency(startingBalance)} and clear all trade history.</p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setConfirmReset(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={() => { onReset(); setConfirmReset(false); }}
                            >
                                Reset Wallet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Performance Stats Grid */}
            <div className="stats-section">
                <h3 className="section-title">
                    <BarChart3 size={18} />
                    Performance Analytics
                </h3>

                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon win">
                            <Trophy size={20} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-value">{stats.winRate.toFixed(1)}%</div>
                            <div className="stat-label">Win Rate</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon neutral">
                            <Target size={20} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-value">{stats.totalTrades}</div>
                            <div className="stat-label">Total Trades</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon win">
                            <TrendingUp size={20} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-value">{stats.winningTrades}</div>
                            <div className="stat-label">Winners</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon loss">
                            <TrendingDown size={20} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-value">{stats.losingTrades}</div>
                            <div className="stat-label">Losers</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon loss">
                            <Skull size={20} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-value">{stats.liquidatedTrades}</div>
                            <div className="stat-label">Liquidated</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon neutral">
                            <Zap size={20} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-value">
                                {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
                            </div>
                            <div className="stat-label">Profit Factor</div>
                        </div>
                    </div>
                </div>

                {/* Additional Stats */}
                <div className="additional-stats">
                    <div className="additional-stat">
                        <span className="additional-stat-label">Avg Win</span>
                        <span className="additional-stat-value win">{formatCurrency(stats.avgWin)}</span>
                    </div>
                    <div className="additional-stat">
                        <span className="additional-stat-label">Avg Loss</span>
                        <span className="additional-stat-value loss">-{formatCurrency(stats.avgLoss)}</span>
                    </div>
                    <div className="additional-stat">
                        <span className="additional-stat-label">Max Drawdown</span>
                        <span className="additional-stat-value loss">{stats.maxDrawdown.toFixed(2)}%</span>
                    </div>
                </div>
            </div>

            {/* Best/Worst Trades */}
            {(stats.bestTrade || stats.worstTrade) && (
                <div className="highlight-trades">
                    {stats.bestTrade && stats.bestTrade.pnl > 0 && (
                        <div className="highlight-card best">
                            <div className="highlight-header">
                                <Trophy size={16} />
                                <span>Best Trade</span>
                            </div>
                            <div className="highlight-title">{stats.bestTrade.marketTitle}</div>
                            <div className="highlight-pnl">+{formatCurrency(stats.bestTrade.pnl)}</div>
                        </div>
                    )}
                    {stats.worstTrade && stats.worstTrade.pnl < 0 && (
                        <div className="highlight-card worst">
                            <div className="highlight-header">
                                <Skull size={16} />
                                <span>Worst Trade</span>
                            </div>
                            <div className="highlight-title">{stats.worstTrade.marketTitle}</div>
                            <div className="highlight-pnl">{formatCurrency(stats.worstTrade.pnl)}</div>
                        </div>
                    )}
                </div>
            )}

            {/* Trade History */}
            <div className="trade-history-section">
                <h3 className="section-title">
                    <BarChart3 size={18} />
                    Trade History
                    {trades.length > 0 && <span className="trade-count">{trades.length}</span>}
                </h3>

                {trades.length === 0 ? (
                    <div className="empty-trades">
                        <Target size={32} />
                        <p>No trades yet. Open a position and close it to see your trade history.</p>
                    </div>
                ) : (
                    <>
                        <div className="trade-list">
                            {displayedTrades.map(trade => (
                                <div
                                    key={trade.id}
                                    className={`trade-item ${trade.outcome}`}
                                >
                                    <div className="trade-info">
                                        <div className="trade-market">{trade.marketTitle}</div>
                                        <div className="trade-details">
                                            <span className={`trade-prediction ${trade.prediction}`}>
                                                {trade.leverage}x {trade.prediction.toUpperCase()}
                                            </span>
                                            <span className="trade-date">
                                                {new Date(trade.closeTime).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="trade-result">
                                        <div className={`trade-pnl ${trade.pnl >= 0 ? 'profit' : 'loss'}`}>
                                            {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                                        </div>
                                        <div className={`trade-pnl-percent ${trade.pnl >= 0 ? 'profit' : 'loss'}`}>
                                            {formatPercent(trade.pnlPercent)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {trades.length > 5 && (
                            <button
                                className="show-more-btn"
                                onClick={() => setShowAllTrades(!showAllTrades)}
                            >
                                {showAllTrades ? (
                                    <>
                                        <ChevronUp size={16} />
                                        Show Less
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown size={16} />
                                        Show All ({trades.length} trades)
                                    </>
                                )}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
