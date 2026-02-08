'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Zap } from 'lucide-react';

export default function WaitlistPage() {
    const searchParams = useSearchParams();
    const refParam = searchParams.get('ref');

    // ... state ...
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        telegram: '',
        twitter: '',
        referredBy: refParam || ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [position, setPosition] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (refParam) {
            setFormData(prev => ({ ...prev, referredBy: refParam }));
        }
    }, [refParam]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const response = await fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 409) {
                    setError('You\'re already on the list! Your code: ' + data.referralCode);
                    setReferralCode(data.referralCode);
                } else {
                    setError(data.error || 'Something went wrong');
                }
                return;
            }

            setIsSuccess(true);
            setReferralCode(data.referralCode);
            setPosition(data.position);
        } catch (err) {
            setError('Failed to connect. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyReferralLink = () => {
        const link = `${window.location.origin}/waitlist?ref=${referralCode}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="app-container">
            <header className="header">
                <div className="header-inner">
                    <div className="header-pill">
                        <div className="logo">
                            <div className="logo-icon">
                                <Zap size={16} />
                            </div>
                            <span>Polymarket <span style={{ fontWeight: 400 }}>Leverage</span></span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="main-content" style={{ paddingTop: '2rem' }}>
                {/* Hero Section - Matching main app */}
                <div className="hero-section">
                    <h1 className="hero-title">
                        Polymarket <span className="hero-title-accent">Leverage</span>
                    </h1>
                </div>

                {/* Signup Form - Using existing card styles */}
                <div style={{ maxWidth: '480px', margin: '1rem auto 0' }}>
                    <div className="card">
                        <div className="card-content">
                            {!isSuccess ? (
                                <>
                                    <h2 style={{ color: 'var(--text-primary)', textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
                                        Join the Waitlist
                                    </h2>
                                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.5rem' }}>
                                        Get early access when we launch
                                    </p>

                                    <form onSubmit={handleSubmit}>
                                        <div className="form-group">
                                            <input
                                                type="text"
                                                placeholder="Your Name *"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                required
                                                className="input"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <input
                                                type="email"
                                                placeholder="Email Address *"
                                                value={formData.email}
                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                required
                                                className="input"
                                            />
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <input
                                                    type="text"
                                                    placeholder="@telegram"
                                                    value={formData.telegram}
                                                    onChange={e => setFormData({ ...formData, telegram: e.target.value })}
                                                    className="input"
                                                />
                                            </div>
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <input
                                                    type="text"
                                                    placeholder="@twitter"
                                                    value={formData.twitter}
                                                    onChange={e => setFormData({ ...formData, twitter: e.target.value })}
                                                    className="input"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <input
                                                type="text"
                                                placeholder="Referral Code (optional)"
                                                value={formData.referredBy}
                                                onChange={e => setFormData({ ...formData, referredBy: e.target.value.toUpperCase() })}
                                                className="input"
                                                style={{ textTransform: 'uppercase' }}
                                            />
                                        </div>

                                        {error && (
                                            <div style={{
                                                padding: '0.75rem',
                                                borderRadius: '8px',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                color: '#ef4444',
                                                fontSize: '0.9rem',
                                                marginBottom: '1rem'
                                            }}>
                                                {error}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="btn btn-primary"
                                            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
                                        >
                                            {isSubmitting ? 'Joining...' : 'Join Waitlist →'}
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        margin: '0 auto 1.5rem',
                                        borderRadius: '50%',
                                        background: 'rgba(34, 197, 94, 0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <span style={{ fontSize: '2.5rem' }}>✓</span>
                                    </div>
                                    <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>You're on the list! 🎉</h2>
                                    {position && (
                                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                                            You're #{position} in line
                                        </p>
                                    )}

                                    <div style={{
                                        padding: '1rem',
                                        borderRadius: '12px',
                                        background: 'var(--card-bg)',
                                        border: '1px solid var(--border-color)',
                                        marginBottom: '1.5rem'
                                    }}>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Your Referral Code:</p>
                                        <p style={{
                                            fontSize: '1.5rem',
                                            fontFamily: 'monospace',
                                            fontWeight: 'bold',
                                            color: 'var(--success)'
                                        }}>{referralCode}</p>
                                    </div>

                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                        Share your link to move up the waitlist:
                                    </p>
                                    <button
                                        onClick={copyReferralLink}
                                        className="btn btn-secondary"
                                        style={{ width: '100%' }}
                                    >
                                        {copied ? '✓ Copied!' : '📋 Copy Referral Link'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '3rem',
                        marginTop: '2rem',
                        textAlign: 'center'
                    }}>
                        <div>
                            <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>10x</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Max Leverage</p>
                        </div>
                        <div style={{ width: '1px', background: 'var(--border-color)' }} />
                        <div>
                            <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>$0</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Trading Fees</p>
                        </div>
                        <div style={{ width: '1px', background: 'var(--border-color)' }} />
                        <div>
                            <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>24/7</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Live Markets</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
