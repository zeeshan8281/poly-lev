'use client';

import { PrivyProvider } from '@privy-io/react-auth';

// Use a placeholder if not set, to prevent crashes before user configures it
const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

export default function PrivyProviderWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <PrivyProvider
            appId={APP_ID}
            config={{
                loginMethods: ['email', 'wallet'],
                appearance: {
                    theme: 'dark',
                    accentColor: '#22c55e', // Green to match our theme
                    showWalletLoginFirst: false,
                },
                embeddedWallets: {
                    ethereum: {
                        createOnLogin: 'users-without-wallets',
                    },
                },
            }}
        >
            {children}
        </PrivyProvider>
    );
}
