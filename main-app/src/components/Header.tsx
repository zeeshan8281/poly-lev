'use client';

import { useTheme } from '@/hooks/useTheme';
import { Zap, Moon, Sun } from 'lucide-react';
import { LoginButton } from './LoginButton';

interface HeaderProps {
    wsStatus: 'connecting' | 'connected' | 'disconnected';
}

export function Header({ wsStatus }: HeaderProps) {
    const { theme, toggleTheme, mounted } = useTheme();

    const statusText = {
        connecting: 'Connecting...',
        connected: 'Live Data',
        disconnected: 'Offline'
    };

    return (
        <header className="header">
            <div className="header-inner">
                <div className="header-pill">
                    <div className="logo">
                        <div className="logo-icon">
                            <Zap size={16} />
                        </div>
                        <span>Polymarket <span style={{ fontWeight: 400 }}>Leverage</span></span>
                    </div>

                    <div style={{ flex: 1 }}></div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className={`status-badge ${wsStatus}`}>
                            <span className="status-dot"></span>
                            {statusText[wsStatus]}
                        </div>

                        <LoginButton />

                        {mounted && (
                            <button onClick={toggleTheme} className="theme-toggle">
                                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
