'use client';

import { useState } from 'react';

const RESOURCE_TYPES = [
  { value: 'github_repo', label: 'GitHub Repo' },
  { value: 'article', label: 'Article / Blog Post' },
  { value: 'video', label: 'Video' },
  { value: 'tweet', label: 'Tweet / Thread' },
  { value: 'tool', label: 'Tool / App' },
  { value: 'other', label: 'Other' },
];

export default function SubmitForm() {
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    const formData = new FormData(e.target);
    const payload = {
      url: formData.get('url'),
      title: formData.get('title'),
      type: formData.get('type'),
      description: formData.get('description'),
      submitter_name: formData.get('submitter_name'),
      submitter_twitter: formData.get('submitter_twitter'),
    };

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="text-3xl mb-3">&#10003;</div>
        <h2 className="text-lg font-semibold text-emerald-800 mb-2">Submission received!</h2>
        <p className="text-sm text-emerald-700 mb-4">
          Thanks for contributing. We review submissions regularly and will add quality resources to the directory.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="text-sm text-[var(--accent)] hover:underline"
        >
          Submit another resource
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* URL (required) */}
      <div>
        <label htmlFor="url" className="block text-sm font-medium mb-1.5">
          Resource URL <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          id="url"
          name="url"
          required
          placeholder="https://github.com/example/mcp-server"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
        />
      </div>

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          name="title"
          required
          placeholder="My Awesome MCP Server"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
        />
      </div>

      {/* Type */}
      <div>
        <label htmlFor="type" className="block text-sm font-medium mb-1.5">
          Resource Type
        </label>
        <select
          id="type"
          name="type"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
        >
          <option value="">Select type...</option>
          {RESOURCE_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1.5">
          Short Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="What does this resource do? Why is it useful?"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none"
        />
      </div>

      {/* Submitter info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="submitter_name" className="block text-sm font-medium mb-1.5">
            Your Name <span className="text-xs text-[var(--muted)]">(optional)</span>
          </label>
          <input
            type="text"
            id="submitter_name"
            name="submitter_name"
            placeholder="Jane Doe"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label htmlFor="submitter_twitter" className="block text-sm font-medium mb-1.5">
            Your X Handle <span className="text-xs text-[var(--muted)]">(optional)</span>
          </label>
          <input
            type="text"
            id="submitter_twitter"
            name="submitter_twitter"
            placeholder="@janedoe"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* Error */}
      {status === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full sm:w-auto rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {status === 'submitting' ? 'Submitting...' : 'Submit Resource'}
      </button>
    </form>
  );
}
