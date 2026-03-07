import './globals.css';

export const metadata = {
  title: 'ClaudeLists - Curated Claude & AI Resources',
  description: 'Discover MCP servers, prompts, CLAUDE.md configs, tools, and more from the Claude ecosystem.',
  openGraph: {
    title: 'ClaudeLists - Curated Claude & AI Resources',
    description: 'Discover MCP servers, prompts, CLAUDE.md configs, tools, and more from the Claude ecosystem.',
    url: 'https://claudelists.com',
    siteName: 'ClaudeLists',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@claudelists',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <a href="/" className="flex items-center gap-2 font-bold text-lg">
                <span className="text-[var(--accent)]">Claude</span>Lists
              </a>
              <div className="flex items-center gap-6">
                <a href="/browse" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Browse
                </a>
                <a
                  href="https://x.com/claudelists"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  @claudelists
                </a>
              </div>
            </div>
          </div>
        </nav>

        <main>{children}</main>

        <footer className="border-t border-[var(--border)] mt-16 py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-sm text-[var(--muted)]">
            <p>ClaudeLists.com &mdash; Curated Claude ecosystem resources, updated daily.</p>
            <p className="mt-1">
              Tag <a href="https://x.com/claudelists" className="text-[var(--accent)] hover:underline" target="_blank" rel="noopener noreferrer">@claudelists</a> on Twitter with Claude resources!
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
