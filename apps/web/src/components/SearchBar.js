'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SearchBar({ className = '' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');

  function handleSubmit(e) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (query.trim()) {
      params.set('q', query.trim());
    } else {
      params.delete('q');
    }
    params.delete('page');
    router.push(`/browse?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <svg
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
        width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      >
        <circle cx="7" cy="7" r="5" />
        <path d="M11 11l3.5 3.5" />
      </svg>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search tools, prompts, MCP servers..."
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-10 pr-10 py-2.5 text-sm placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--accent)] p-1 rounded-lg hover:bg-[var(--surface-alt)]"
        aria-label="Search"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M14 8H2M8 2l6 6-6 6" />
        </svg>
      </button>
    </form>
  );
}
