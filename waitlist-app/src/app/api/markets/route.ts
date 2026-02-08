import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API = 'https://gamma-api.polymarket.com';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const queryString = searchParams.toString();
        const url = `${GAMMA_API}/markets${queryString ? '?' + queryString : ''}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'PolymarketLeverageSimulator/1.0'
            },
            next: { revalidate: 60 } // Cache for 60 seconds
        });

        if (!response.ok) {
            throw new Error(`Polymarket API returned ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[API Error]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
