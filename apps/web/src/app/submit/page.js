import SubmitForm from './SubmitForm';

export const metadata = {
  title: 'Submit a Resource | ClaudeLists',
  description: 'Submit a Claude ecosystem resource to be featured on ClaudeLists. Share MCP servers, prompts, tools, tutorials, and more.',
};

function XIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Submit a Resource</h1>
      <p className="text-[var(--muted)] mb-8">
        Know a great Claude ecosystem resource? Share it with the community. We review every submission and add quality resources to the directory.
      </p>

      <SubmitForm />

      {/* Alternative: share on X */}
      <div className="mt-10 pt-8 border-t border-[var(--border)]">
        <h2 className="text-sm font-semibold mb-2 text-[var(--muted)]">Or share on X</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Tag <strong className="text-[var(--foreground)]">@claudelists</strong> on X with a link to the resource and we will pick it up automatically.
        </p>
        <a
          href="https://x.com/intent/tweet?text=Check%20out%20this%20Claude%20resource%20%40claudelists"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
        >
          <XIcon /> Share on X
        </a>
      </div>
    </div>
  );
}
