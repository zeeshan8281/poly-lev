'use client';

import { useState } from 'react';
import { Market } from '@/types';
import { Search, Zap } from 'lucide-react';

interface MarketSearchProps {
    results: Market[];
    isLoading: boolean;
    isDemo: boolean;
    onSearch: (query: string) => void;
    onSelect: (market: Market) => void;
}

export function MarketSearch({ results, isLoading, isDemo, onSearch, onSelect }: MarketSearchProps) {
    const [query, setQuery] = useState('');

    const handleSearch = () => {
        if (query.trim()) onSearch(query);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    const formatVolume = (vol: number) => {
        if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
        if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
        return `$${vol.toFixed(0)}`;
    };

    return (
        <div className="space-y-4">
            {/* Search Input */}
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Search prediction markets..."
                        className="input !pl-10"
                    />
                </div>
                <button onClick={handleSearch} className="btn-primary">
                    Search
                </button>
            </div>

            {/* Results */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
                {isLoading && (
                    <div className="flex justify-center py-10">
                        <div className="spinner" />
                    </div>
                )}

                {isDemo && results.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 text-xs font-medium">
                        <Zap size={14} />
                        Demo Mode - Using sample data
                    </div>
                )}

                {results.map((market) => (
                    <div
                        key={market.id}
                        onClick={() => {
                            onSelect(market);
                            setQuery('');
                        }}
                        className="p-4 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-primary)] hover:border-[var(--border-hover)] cursor-pointer transition-all hover:shadow-md"
                    >
                        <div className="font-serif text-sm font-medium mb-2 line-clamp-2">
                            {market.title}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-[var(--text-muted)]">Vol: {formatVolume(market.volume)}</span>
                            <div className="flex gap-2">
                                <span className="px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold">
                                    YES {market.yesPrice.toFixed(0)}%
                                </span>
                                <span className="px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-semibold">
                                    NO {market.noPrice.toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    </div>
                ))}

                {!isLoading && results.length === 0 && query && (
                    <div className="text-center py-10 text-[var(--text-muted)] text-sm">
                        No markets found for "{query}"
                    </div>
                )}

                {!isLoading && results.length === 0 && !query && (
                    <div className="text-center py-10 text-[var(--text-muted)] text-sm">
                        Search for markets like "Bitcoin" or "Trump"
                    </div>
                )}
            </div>
        </div>
    );
}
