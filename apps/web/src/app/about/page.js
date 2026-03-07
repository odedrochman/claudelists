export const metadata = {
  title: 'Why ClaudeLists - The Story Behind the Directory',
  description: 'Why I built ClaudeLists, the community-curated directory of Claude ecosystem resources.',
};

function XIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <h1 className="text-3xl font-bold tracking-tight mb-2">
        Why I Built <span className="text-[var(--accent)]">Claude</span>Lists
      </h1>
      <p className="text-[var(--muted)] mb-10">A personal project that became a community resource.</p>

      {/* Story */}
      <div className="prose prose-sm max-w-none space-y-5 text-[var(--foreground)]">
        <p className="text-base leading-relaxed">
          I use Claude every day. It&apos;s become central to how I work. Writing code, thinking through problems, building entire projects. Naturally, I want to stay on top of everything happening in the Claude ecosystem.
        </p>

        <p className="text-base leading-relaxed">
          The problem? Most of the best Claude resources (MCP servers, prompt engineering techniques, workflow automations, CLAUDE.md configs) surface on Twitter. And Twitter moves fast. Really fast.
        </p>

        <p className="text-base leading-relaxed">
          I tried bookmarking everything. But Twitter bookmarks are essentially a black hole. No search, no context, no categories. I&apos;d remember seeing an amazing MCP server someone shared, but when I actually needed it three weeks later? Gone. Buried under hundreds of other bookmarks with no way to find it.
        </p>

        <p className="text-base leading-relaxed">
          So I built ClaudeLists.
        </p>

        <p className="text-base leading-relaxed">
          Every day, the system scans for the most useful Claude-related resources shared on Twitter. Each one gets categorized, tagged, scored for quality, and stored with full context. The original tweet, extracted metadata, links, and when available, the full content as downloadable Markdown.
        </p>

        <p className="text-base leading-relaxed">
          The result is a searchable, browsable directory where you can actually find things when you need them. Looking for the best MCP servers? They&apos;re here. Need a good CLAUDE.md config? It&apos;s here. Want to see what Claude tools people are building? All here, organized and rated.
        </p>
      </div>

      {/* Goal */}
      <div className="mt-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold mb-3">The Goal</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          I want ClaudeLists to become the largest and most up-to-date Claude resource directory on the internet. A place where anyone in the Claude ecosystem can find the tools, prompts, configs, and references they need without digging through endless Twitter threads.
        </p>
      </div>

      {/* CTA */}
      <div className="mt-12 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-6 text-center">
        <h2 className="text-lg font-semibold mb-3">Help Grow the Directory</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed mb-5 max-w-lg mx-auto">
          Found an interesting Claude resource? A cool MCP server, a useful prompt, a great workflow?
          Share it on X and tag <strong className="text-[var(--foreground)]">@claudelists</strong>. We&apos;ll review it and add it to the directory.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="https://x.com/intent/tweet?text=Check%20out%20this%20Claude%20resource%20%40claudelists"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <XIcon /> Share a Resource
          </a>
          <a
            href="https://x.com/claudelists"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
          >
            <XIcon /> Follow @claudelists
          </a>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-12">
        <h2 className="text-lg font-semibold mb-4">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-2xl mb-2">1</div>
            <h3 className="text-sm font-semibold mb-1">Discover</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Resources are discovered daily from the Claude community on Twitter/X.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-2xl mb-2">2</div>
            <h3 className="text-sm font-semibold mb-1">Analyze</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Each resource is categorized, tagged, and quality-scored using AI analysis.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-2xl mb-2">3</div>
            <h3 className="text-sm font-semibold mb-1">Browse</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Search, filter, and find exactly what you need, when you need it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
