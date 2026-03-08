import './globals.css';
import { Inter } from 'next/font/google';
import Script from 'next/script';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: 'ClaudeLists - Curated Claude & AI Resources',
  description: 'The community-curated directory of Claude ecosystem resources. MCP servers, prompts, CLAUDE.md configs, tools, and more.',
  icons: {
    icon: '/favicon.svg',
    apple: '/icon.svg',
  },
  metadataBase: new URL('https://claudelists.com'),
  openGraph: {
    title: 'ClaudeLists - Curated Claude & AI Resources',
    description: 'The community-curated directory of Claude ecosystem resources. MCP servers, prompts, CLAUDE.md configs, tools, and more.',
    url: 'https://claudelists.com',
    siteName: 'ClaudeLists',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@claudelists',
    creator: '@claudelists',
  },
};

function Logo({ className = '' }) {
  return (
    <a href="/" className={`flex items-center gap-2.5 group ${className}`}>
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        <text x="16" y="22" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="700" fontSize="18" fill="#FAF9F5">CL</text>
      </svg>
      <span className="font-semibold text-lg tracking-tight">
        <span className="text-[var(--accent)]">Claude</span>
        <span className="text-[var(--foreground)]">Lists</span>
      </span>
    </a>
  );
}

function XIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-RZZG5WVJV7"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-RZZG5WVJV7', {
              content_group: window.location.pathname.startsWith('/digest/') ? 'digest_article'
                : window.location.pathname === '/digest' ? 'digest_index'
                : window.location.pathname.startsWith('/resource/') ? 'resource'
                : window.location.pathname.startsWith('/category/') ? 'category'
                : window.location.pathname.startsWith('/browse') ? 'browse'
                : 'other'
            });
          `}
        </Script>
      </head>
      <body className="min-h-screen antialiased">
        {/* Header */}
        <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center justify-between">
              <Logo />
              <div className="flex items-center gap-1">
                <a href="/browse" className="rounded-lg px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
                  Browse
                </a>
                <a href="/digest" className="rounded-lg px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
                  Digest
                </a>
                <a href="/submit" className="rounded-lg px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
                  Submit
                </a>
                <a href="/about" className="rounded-lg px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-alt)] hidden sm:block">
                  About
                </a>
                <span className="mx-1 h-4 w-px bg-[var(--border)]" />
                <a
                  href="https://x.com/claudelists"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-2 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                  title="Follow @claudelists on X"
                >
                  <XIcon />
                </a>
              </div>
            </div>
          </div>
        </nav>

        <main>{children}</main>

        {/* Footer */}
        <footer className="mt-20 border-t border-[var(--border)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 py-10">
              {/* Brand */}
              <div>
                <Logo className="mb-3" />
                <p className="text-sm text-[var(--muted)] leading-relaxed">
                  The community-curated directory of Claude ecosystem resources, updated daily.
                </p>
              </div>

              {/* Links */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">Explore</h3>
                <ul className="space-y-2 text-sm">
                  <li><a href="/browse" className="text-[var(--foreground)] hover:text-[var(--accent)]">Browse Resources</a></li>
                  <li><a href="/digest" className="text-[var(--foreground)] hover:text-[var(--accent)]">Digest</a></li>
                  <li><a href="/submit" className="text-[var(--foreground)] hover:text-[var(--accent)]">Submit a Resource</a></li>
                  <li><a href="/about" className="text-[var(--foreground)] hover:text-[var(--accent)]">Why ClaudeLists</a></li>
                </ul>
              </div>

              {/* Community */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">Community</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed mb-3">
                  Found a useful Claude resource? Tweet about it and tag <a href="https://x.com/claudelists" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">@claudelists</a>. We&apos;ll add it to the directory.
                </p>
                <a
                  href="https://x.com/claudelists"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-[var(--foreground)] hover:text-[var(--accent)]"
                >
                  <XIcon size={16} /> @claudelists
                </a>
              </div>
            </div>

            {/* Bottom bar with disclaimer */}
            <div className="border-t border-[var(--border)] py-6 space-y-2">
              <p className="text-xs text-[var(--muted)] text-center">
                &copy; {new Date().getFullYear()} ClaudeLists.com
              </p>
              <p className="text-[11px] text-[var(--muted)]/70 text-center max-w-xl mx-auto leading-relaxed">
                ClaudeLists is an independent community project. Not affiliated with, endorsed by, or associated with Anthropic or Claude.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
