'use client';

import { useState } from 'react';
import { Market } from '@/types';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface PositionFormProps {
    market: Market;
    onOpenPosition: (prediction: 'yes' | 'no', size: number, leverage: number, entryOdds: number) => void;
    onCancel: () => void;
}

const LEVERAGE_OPTIONS = [1, 2, 5, 10];

export function PositionForm({ market, onOpenPosition, onCancel }: PositionFormProps) {
    const [prediction, setPrediction] = useState<'yes' | 'no'>('yes');
    const [positionSize, setPositionSize] = useState(100);
    const [leverage, setLeverage] = useState(5);

    const entryOdds = prediction === 'yes' ? market.yesPrice : market.noPrice;
    const collateral = positionSize / leverage;
    const maxLossPercent = 100 / leverage;
    const liquidationOdds = prediction === 'yes'
        ? Math.max(1, entryOdds - maxLossPercent)
        : Math.min(99, entryOdds + maxLossPercent);

    const handleSubmit = () => {
        onOpenPosition(prediction, positionSize, leverage, entryOdds);
    };

    return (
        <div className="space-y-4">
            {/* Prediction Toggle */}
            <div className="form-group">
                <label className="form-label">Your Prediction</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button
                        onClick={() => setPrediction('yes')}
                        className={`outcome-btn yes ${prediction === 'yes' ? 'ring-2 ring-green-500' : ''}`}
                        style={{
                            outline: prediction === 'yes' ? '2px solid var(--accent-green)' : 'none',
                            outlineOffset: '2px'
                        }}
                    >
                        <TrendingUp size={20} style={{ marginBottom: '4px' }} />
                        <span className="outcome-label">Yes</span>
                        <span className="outcome-price">{market.yesPrice?.toFixed(0) || 50}¢</span>
                    </button>
                    <button
                        onClick={() => setPrediction('no')}
                        className={`outcome-btn no ${prediction === 'no' ? 'ring-2 ring-red-500' : ''}`}
                        style={{
                            outline: prediction === 'no' ? '2px solid var(--accent-red)' : 'none',
                            outlineOffset: '2px'
                        }}
                    >
                        <TrendingDown size={20} style={{ marginBottom: '4px' }} />
                        <span className="outcome-label">No</span>
                        <span className="outcome-price">{market.noPrice?.toFixed(0) || 50}¢</span>
                    </button>
                </div>
            </div>

            {/* Position Size */}
            <div className="form-group">
                <label className="form-label">Position Size ($)</label>
                <input
                    type="number"
                    value={positionSize}
                    onChange={(e) => setPositionSize(Math.max(1, parseFloat(e.target.value) || 0))}
                    className="form-input"
                    min="1"
                />
            </div>

            {/* Leverage */}
            <div className="form-group">
                <label className="form-label">Leverage</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {LEVERAGE_OPTIONS.map((lev) => (
                        <button
                            key={lev}
                            onClick={() => setLeverage(lev)}
                            className={`btn ${leverage === lev ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            {lev}x
                        </button>
                    ))}
                </div>
            </div>

            {/* Risk Warning */}
            {leverage >= 5 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    background: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.2)',
                    borderRadius: '10px',
                    fontSize: '13px',
                    color: '#ca8a04'
                }}>
                    <AlertTriangle size={16} />
                    High leverage increases liquidation risk
                </div>
            )}

            {/* Summary */}
            <div style={{
                background: 'var(--bg-tertiary)',
                borderRadius: '12px',
                padding: '16px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Collateral Required</span>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>${collateral.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Entry Price</span>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{entryOdds.toFixed(1)}¢</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Liquidation Price</span>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--accent-red)' }}>
                        {liquidationOdds.toFixed(1)}¢
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={onCancel} className="btn btn-secondary" style={{ flex: 1 }}>
                    Cancel
                </button>
                <button onClick={handleSubmit} className="btn btn-primary" style={{ flex: 1 }}>
                    Open {leverage}x {prediction.toUpperCase()}
                </button>
            </div>
        </div>
    );
}
