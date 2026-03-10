'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { formatContentType, getScoreStyle } from '../lib/resource-utils';

export default function SearchBar({ className = '' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  // Fetch search results
  const fetchResults = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
      setIsOpen(data.results?.length > 0);
      setActiveIndex(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => fetchResults(query.trim()), 200);
    } else {
      setResults([]);
      setIsOpen(false);
    }
    return () => clearTimeout(debounceRef.current);
  }, [query, fetchResults]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global "/" shortcut to focus search
  useEffect(() => {
    function handleGlobalKey(e) {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, []);

  function navigateToResource(id) {
    setIsOpen(false);
    router.push(`/resource/${id}`);
  }

  function handleFullSearch() {
    setIsOpen(false);
    const params = new URLSearchParams(searchParams);
    if (query.trim()) {
      params.set('q', query.trim());
    } else {
      params.delete('q');
    }
    params.delete('page');
    router.push(`/browse?${params.toString()}`);
  }

  function handleKeyDown(e) {
    if (!isOpen && e.key !== 'Enter') return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, results.length)); // last = "see all"
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) {
          navigateToResource(results[activeIndex].id);
        } else {
          handleFullSearch();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }

  function clearQuery() {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={(e) => { e.preventDefault(); handleFullSearch(); }}>
        {/* Search icon */}
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
          width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        >
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l3.5 3.5" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search tools, prompts, MCP servers..."
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-10 pr-20 py-2.5 text-sm placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
        />

        {/* Right side: clear button + keyboard hint */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={clearQuery}
              className="text-[var(--muted)] hover:text-[var(--foreground)] p-1 rounded-lg hover:bg-[var(--surface-alt)]"
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
          {!query && (
            <kbd className="hidden sm:inline-flex items-center rounded border border-[var(--border)] bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10px] text-[var(--muted)] font-mono">
              /
            </kbd>
          )}
        </div>
      </form>

      {/* Results dropdown */}
      <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="absolute z-50 top-full left-0 right-0 mt-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden flex flex-col"
          role="listbox"
        >
          <div className="max-h-[360px] overflow-y-auto">
          {results.map((r, i) => {
            const scoreStyle = getScoreStyle(r.ai_quality_score);
            return (
              <button
                key={r.id}
                id={`search-result-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => navigateToResource(r.id)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                  i === activeIndex ? 'bg-[var(--surface-alt)]' : 'hover:bg-[var(--surface-alt)]'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--foreground)] truncate">
                      {r.title}
                    </span>
                    {r.ai_quality_score && scoreStyle && (
                      <span className={`shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${scoreStyle}`}>
                        {r.ai_quality_score}/10
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[var(--muted)]">{formatContentType(r.content_type)}</span>
                    {r.categories?.name && (
                      <>
                        <span className="text-[var(--border)]">/</span>
                        <span className="text-xs text-[var(--muted)]">{r.categories.name}</span>
                      </>
                    )}
                    {r.author_handle && (
                      <>
                        <span className="text-[var(--border)]">/</span>
                        <span className="text-xs text-[var(--muted)]">@{r.author_handle}</span>
                      </>
                    )}
                  </div>
                </div>
                {/* Arrow */}
                <svg className="shrink-0 mt-1 text-[var(--muted)]" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </button>
            );
          })}

          </div>
          {/* See all results */}
          <button
            id={`search-result-${results.length}`}
            role="option"
            aria-selected={activeIndex === results.length}
            onClick={handleFullSearch}
            onMouseEnter={() => setActiveIndex(results.length)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm border-t border-[var(--border)] transition-colors ${
              activeIndex === results.length
                ? 'bg-[var(--surface-alt)] text-[var(--accent)]'
                : 'text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--accent)]'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7" cy="7" r="5" />
              <path d="M11 11l3.5 3.5" />
            </svg>
            See all results for &quot;{query}&quot;
          </button>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Loading spinner */}
      {loading && query.length >= 2 && (
        <div className="absolute right-12 top-1/2 -translate-y-1/2">
          <div className="w-3.5 h-3.5 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
