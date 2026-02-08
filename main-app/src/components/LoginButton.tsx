'use client';

import { usePrivy } from '@privy-io/react-auth';
import { User, LogOut } from 'lucide-react';

export function LoginButton() {
    const { login, logout, authenticated, user } = usePrivy();

    if (authenticated) {
        return (
            <button
                onClick={logout}
                className="btn btn-secondary"
                title="Log Out"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 12px' }}
            >
                <User size={14} />
                <span>
                    {user?.wallet?.address
                        ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
                        : user?.email?.address || 'User'}
                </span>
                <LogOut size={14} style={{ marginLeft: '4px' }} />
            </button>
        );
    }

    return (
        <button
            onClick={login}
            className="btn btn-primary"
            style={{ fontSize: '13px', padding: '6px 16px' }}
        >
            Log In
        </button>
    );
}
