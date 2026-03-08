'use client';

import { useState } from 'react';

const SCORE_STYLE = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  mid: 'bg-blue-50 text-blue-700 border-blue-200',
  low: 'bg-gray-50 text-gray-600 border-gray-200',
  poor: 'bg-orange-50 text-orange-700 border-orange-200',
};

function getScoreClass(score) {
  if (score >= 8) return SCORE_STYLE.high;
  if (score >= 6) return SCORE_STYLE.mid;
  if (score >= 4) return SCORE_STYLE.low;
  return SCORE_STYLE.poor;
}

const URL_TYPE_LABELS = {
  github: 'GitHub',
  youtube: 'YouTube',
  reddit: 'Reddit',
  hackernews: 'Hacker News',
  producthunt: 'Product Hunt',
  tweet: 'Tweet',
  article: 'Article',
  unknown: 'Link',
};

export default function AddContent({ adminKey }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  // Editable fields
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [score, setScore] = useState(5);
  const [tweetDraft, setTweetDraft] = useState('');

  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState(null);

  async function handleExtract(e) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setPreview(null);
    setResult(null);

    try {
      const resp = await fetch(`/api/admin/add-content?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        if (data.error === 'duplicate') {
          setError(`Already exists: "${data.existing.title}"`);
        } else {
          setError(data.error || 'Failed to extract content');
        }
        return;
      }

      setPreview(data.preview);
      setTitle(data.preview.title);
      setSummary(data.preview.summary);
      setCategory(data.preview.category);
      setTags(data.preview.tags.join(', '));
      setScore(data.preview.ai_quality_score);
      setTweetDraft(data.preview.tweet_draft);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!tweetDraft.trim()) {
      setError('Tweet text is required');
      return;
    }

    setPosting(true);
    setError(null);

    try {
      const resp = await fetch(`/api/admin/add-content/approve?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary,
          category,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          ai_quality_score: score,
          tweet_text: tweetDraft,
          source_url: preview.source_url,
          url_type: preview.url_type,
          author: preview.author,
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || 'Failed to approve');
        return;
      }

      setResult(data);
      setPreview(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setPosting(false);
    }
  }

  function handleReset() {
    setUrl('');
    setPreview(null);
    setResult(null);
    setError(null);
    setTitle('');
    setSummary('');
    setCategory('');
    setTags('');
    setScore(5);
    setTweetDraft('');
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#3D2E1F] mb-6">Add Content</h2>

      {/* Success result */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6">
          <h3 className="text-lg font-semibold text-emerald-800 mb-2">Published successfully</h3>
          <div className="space-y-1 text-sm text-emerald-700">
            <p>Resource: {result.resource.title}</p>
            <p>
              Tweet:{' '}
              <a href={result.tweet.url} target="_blank" rel="noopener noreferrer" className="underline">
                {result.tweet.url}
              </a>
            </p>
            <p>Tags: {result.tags.join(', ')}</p>
          </div>
          <button
            onClick={handleReset}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
          >
            Add another
          </button>
        </div>
      )}

      {/* URL input */}
      {!result && (
        <form onSubmit={handleExtract} className="mb-6">
          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a URL (GitHub, YouTube, Reddit, article...)"
              className="flex-1 px-4 py-2.5 bg-white border border-[#E0D5C1] rounded-lg text-[#3D2E1F] placeholder:text-[#B8A990] focus:outline-none focus:ring-2 focus:ring-[#C15F3C]/30 focus:border-[#C15F3C]"
              disabled={loading || preview}
            />
            {!preview && (
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="px-5 py-2.5 bg-[#C15F3C] text-white rounded-lg text-sm font-medium hover:bg-[#A84E31] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Extracting...' : 'Extract'}
              </button>
            )}
            {preview && (
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-2.5 bg-white text-[#5C4A32] border border-[#E0D5C1] rounded-lg text-sm font-medium hover:bg-[#F5F0E8]"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#C15F3C] border-t-transparent mb-3"></div>
          <p className="text-[#8B7355]">Extracting content and analyzing with Claude...</p>
        </div>
      )}

      {/* Preview / Edit form */}
      {preview && !result && (
        <div className="bg-white rounded-xl border border-[#E0D5C1] p-6 space-y-5">
          {/* Source badge */}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-[#F5F0E8] text-[#5C4A32] rounded text-xs font-medium">
              {URL_TYPE_LABELS[preview.url_type] || 'Link'}
            </span>
            {preview.author && (
              <span className="text-xs text-[#8B7355]">by {preview.author}</span>
            )}
            <a
              href={preview.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#C15F3C] hover:underline ml-auto"
            >
              View source
            </a>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-[#8B7355] mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              className="w-full px-3 py-2 bg-[#FAF9F5] border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#C15F3C]/30"
            />
            <span className="text-xs text-[#B8A990]">{title.length}/80</span>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-xs font-medium text-[#8B7355] mb-1">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={200}
              rows={2}
              className="w-full px-3 py-2 bg-[#FAF9F5] border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#C15F3C]/30 resize-none"
            />
            <span className="text-xs text-[#B8A990]">{summary.length}/200</span>
          </div>

          {/* Category + Score row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#8B7355] mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF9F5] border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#C15F3C]/30"
              >
                {[
                  'MCP Servers', 'Prompts & Techniques', 'CLAUDE.md & Config',
                  'Workflows & Automation', 'Skills & Agents', 'Tools & Libraries',
                  'Tutorials & Guides', 'Projects & Showcases', 'News & Announcements',
                  'Discussion & Opinion',
                ].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8B7355] mb-1">
                Quality Score
                <span className={`ml-2 px-2 py-0.5 rounded text-xs border ${getScoreClass(score)}`}>
                  {score}/10
                </span>
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="w-full mt-1 accent-[#C15F3C]"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-[#8B7355] mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 bg-[#FAF9F5] border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#C15F3C]/30"
            />
          </div>

          {/* Tweet draft */}
          <div>
            <label className="block text-xs font-medium text-[#8B7355] mb-1">
              Tweet
              <span className={`ml-2 text-xs ${tweetDraft.length > 280 ? 'text-red-600 font-semibold' : 'text-[#B8A990]'}`}>
                {tweetDraft.length}/280
              </span>
            </label>
            <textarea
              value={tweetDraft}
              onChange={(e) => setTweetDraft(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-[#FAF9F5] border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#C15F3C]/30 resize-none font-mono"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-[#E0D5C1]">
            <button
              onClick={handleApprove}
              disabled={posting || tweetDraft.length > 280}
              className="px-5 py-2.5 bg-[#C15F3C] text-white rounded-lg text-sm font-medium hover:bg-[#A84E31] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {posting ? 'Posting tweet & saving...' : 'Approve & Post Tweet'}
            </button>
            <button
              onClick={handleReset}
              disabled={posting}
              className="px-4 py-2.5 text-[#8B7355] text-sm hover:text-[#5C4A32]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
