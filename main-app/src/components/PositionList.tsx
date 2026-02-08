'use client';

import { Position } from '@/types';
import { TrendingUp, X } from 'lucide-react';

interface PositionListProps {
    positions: Position[];
    calculatePnL: (position: Position) => number;
    onClose: (positionId: number) => void;
    onUpdateOdds: (positionId: number, newOdds: number) => void;
}

export function PositionList({ positions, calculatePnL, onClose, onUpdateOdds }: PositionListProps) {
    const activePositions = positions.filter(p => p.status === 'open');

    const handleClose = (position: Position) => {
        onClose(position.id);
    };

    if (activePositions.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-icon">
                    <TrendingUp size={28} />
                </div>
                <div className="empty-title">No active positions</div>
                <p className="empty-text">
                    Go to Discover to find markets and start trading
                </p>
            </div>
        );
    }

    return (
        <div className="market-grid">
            {activePositions.map((position) => {
                const pnl = calculatePnL(position);
                const isProfitable = pnl >= 0;
                const pnlPercent = (pnl / position.collateral) * 100;

                return (
                    <div
                        key={position.id}
                        className={`position-card ${isProfitable ? 'profitable' : 'losing'}`}
                    >
                        <div className="position-header">
                            <h3 className="position-title">{position.title}</h3>
                            <span className={`position-badge ${position.prediction}`}>
                                {position.leverage}x {position.prediction.toUpperCase()}
                            </span>
                        </div>

                        <div className="position-stats">
                            <div className="position-stat">
                                <div className="position-stat-label">Entry</div>
                                <div className="position-stat-value">{position.entryOdds.toFixed(1)}¢</div>
                            </div>
                            <div className="position-stat">
                                <div className="position-stat-label">Current</div>
                                <div className="position-stat-value">
                                    {(position.currentOdds || position.entryOdds).toFixed(1)}¢
                                </div>
                            </div>
                            <div className="position-stat">
                                <div className="position-stat-label">Liquidation</div>
                                <div className="position-stat-value" style={{ color: 'var(--accent-red)' }}>
                                    {position.liquidationOdds.toFixed(1)}¢
                                </div>
                            </div>
                            <div className="position-stat">
                                <div className="position-stat-label">P&L</div>
                                <div
                                    className="position-stat-value"
                                    style={{ color: isProfitable ? 'var(--accent-green)' : 'var(--accent-red)' }}
                                >
                                    {isProfitable ? '+' : ''}{pnlPercent.toFixed(1)}%
                                </div>
                            </div>
                        </div>

                        <div className="position-actions">
                            <div style={{
                                flex: 1,
                                fontSize: '18px',
                                fontWeight: 600,
                                color: isProfitable ? 'var(--accent-green)' : 'var(--accent-red)'
                            }}>
                                {isProfitable ? '+' : ''}${pnl.toFixed(2)}
                            </div>
                            <button
                                className="btn btn-danger"
                                onClick={() => handleClose(position)}
                            >
                                <X size={16} />
                                Close
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
