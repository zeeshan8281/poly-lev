import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Generate a unique referral code
function generateReferralCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
    let code = 'PLM-'; // Polymarket prefix
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, email, telegram, twitter, referredBy } = body;

        // Validate required fields
        if (!name || !email) {
            return NextResponse.json(
                { error: 'Name and email are required' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Check if email already exists
        const { data: existing } = await supabase
            .from('waitlist')
            .select('id, referral_code')
            .eq('email', email.toLowerCase())
            .single();

        if (existing) {
            return NextResponse.json(
                {
                    error: 'Email already registered',
                    referralCode: existing.referral_code
                },
                { status: 409 }
            );
        }

        // If referred by someone, validate and increment their count
        if (referredBy) {
            const { data: referrer } = await supabase
                .from('waitlist')
                .select('id, referral_count')
                .eq('referral_code', referredBy.toUpperCase())
                .single();

            if (referrer) {
                await supabase
                    .from('waitlist')
                    .update({ referral_count: (referrer.referral_count || 0) + 1 })
                    .eq('id', referrer.id);
            }
        }

        // Generate unique referral code
        let referralCode = generateReferralCode();
        let attempts = 0;
        while (attempts < 5) {
            const { data: codeExists } = await supabase
                .from('waitlist')
                .select('id')
                .eq('referral_code', referralCode)
                .single();

            if (!codeExists) break;
            referralCode = generateReferralCode();
            attempts++;
        }

        // Insert new waitlist entry
        const { data, error } = await supabase
            .from('waitlist')
            .insert({
                name: name.trim(),
                email: email.toLowerCase().trim(),
                telegram: telegram?.trim() || null,
                twitter: twitter?.replace('@', '').trim() || null,
                referral_code: referralCode,
                referred_by: referredBy?.toUpperCase() || null,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            console.error('[Waitlist] Insert error:', error);
            return NextResponse.json(
                { error: 'Failed to join waitlist' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Successfully joined the waitlist!',
            referralCode: data.referral_code,
            position: data.id
        });

    } catch (error) {
        console.error('[Waitlist] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET endpoint to check referral stats
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json(
            { error: 'Referral code required' },
            { status: 400 }
        );
    }

    const { data, error } = await supabase
        .from('waitlist')
        .select('referral_count, created_at')
        .eq('referral_code', code.toUpperCase())
        .single();

    if (error || !data) {
        return NextResponse.json(
            { error: 'Referral code not found' },
            { status: 404 }
        );
    }

    return NextResponse.json({
        referralCount: data.referral_count,
        joinedAt: data.created_at
    });
}
