'use client';
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import WaitlistApp from '@/components/WaitlistApp';

export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <WaitlistApp />
        </Suspense>
    );
}
