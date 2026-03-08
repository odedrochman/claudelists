'use client';

import { useState } from 'react';

export default function ShareButtons({ url, title }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'share', { method: 'copy_link', content_type: 'digest', item_id: url });
      }
    });
  }

  const tweetText = encodeURIComponent(`${title}\n\n${url}\n\nvia @claudelists`);
  const tweetUrl = `https://x.com/intent/tweet?text=${tweetText}`;

  function handleShareX() {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'share', { method: 'twitter', content_type: 'digest', item_id: url });
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
        title="Copy link"
      >
        {copied ? (
          <>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 8l3.5 3.5L13 4" />
            </svg>
            Copied
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="5" y="5" width="9" height="9" rx="1.5" />
              <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
            </svg>
            Copy link
          </>
        )}
      </button>
      <a
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleShareX}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
        title="Share on X"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Share on X
      </a>
    </div>
  );
}
