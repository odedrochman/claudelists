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

const CATEGORIES = [
  'MCP Servers', 'Prompts & Techniques', 'CLAUDE.md & Config',
  'Workflows & Automation', 'Skills & Agents', 'Tools & Libraries',
  'Tutorials & Guides', 'Projects & Showcases', 'News & Announcements',
  'Discussion & Opinion',
];

export default function AddContent({ adminKey }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Editable fields
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [score, setScore] = useState(5);
  const [tweetDraft, setTweetDraft] = useState('');

  // Output selection
  const [outputResource, setOutputResource] = useState(true);
  const [outputTweet, setOutputTweet] = useState(false);
  const [outputArticle, setOutputArticle] = useState(false);

  // Article-specific state
  const [articleTitle, setArticleTitle] = useState('');
  const [articleType, setArticleType] = useState('daily');
  const [metaDescription, setMetaDescription] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const [generatingArticle, setGeneratingArticle] = useState(false);
  const [showArticlePreview, setShowArticlePreview] = useState(false);

  // Execution state
  const [posting, setPosting] = useState(false);
  const [results, setResults] = useState(null);

  async function handleExtract(e) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setPreview(null);
    setResults(null);
    setDuplicateWarning(null);

    try {
      const resp = await fetch(`/api/admin/add-content?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        if (data.error === 'duplicate') {
          // Show as warning, not blocking error (user might want article-only)
          setDuplicateWarning(`Already exists as resource: "${data.existing.title}"`);
          setOutputResource(false);
          setOutputTweet(false);
          setOutputArticle(true);
        } else {
          setError(data.error || 'Failed to extract content');
          return;
        }
      }

      if (data.preview) {
        setPreview(data.preview);
        setTitle(data.preview.title);
        setSummary(data.preview.summary);
        setCategory(data.preview.category);
        setTags(data.preview.tags.join(', '));
        setScore(data.preview.ai_quality_score);
        setTweetDraft(data.preview.tweet_draft);
        setArticleTitle(data.preview.title);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleResourceToggle(checked) {
    setOutputResource(checked);
    if (checked) setOutputTweet(false);
  }

  function handleTweetToggle(checked) {
    setOutputTweet(checked);
    if (checked) setOutputResource(false);
  }

  async function handleGenerateArticle() {
    setGeneratingArticle(true);
    setError(null);

    try {
      const resp = await fetch(`/api/admin/add-content/generate-article?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary,
          source_url: preview?.source_url || url,
          url_type: preview?.url_type,
          author: preview?.author,
          content: preview?.extracted_content || '',
          transcript: preview?.transcript || null,
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || 'Failed to generate article');
        return;
      }

      setArticleContent(data.content);
    } catch (e) {
      setError(e.message);
    } finally {
      setGeneratingArticle(false);
    }
  }

  async function handleExecute() {
    // Validation
    if (!outputResource && !outputTweet && !outputArticle) {
      setError('Select at least one output option');
      return;
    }

    if ((outputResource || outputTweet) && !tweetDraft.trim()) {
      setError('Tweet text is required');
      return;
    }

    if ((outputResource || outputTweet) && tweetDraft.length > 280) {
      setError('Tweet exceeds 280 characters');
      return;
    }

    if (outputArticle && !articleContent.trim()) {
      setError('Article content is required');
      return;
    }

    setPosting(true);
    setError(null);
    const executionResults = {};

    try {
      // Path 1: Save resource + tweet
      if (outputResource) {
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
            source_url: preview?.source_url || url,
            url_type: preview?.url_type,
            author: preview?.author,
          }),
        });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Failed to save resource');
        executionResults.resource = data;
      }

      // Path 2: Standalone tweet
      if (outputTweet) {
        const resp = await fetch(`/api/admin/add-content/tweet?key=${adminKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tweet_text: tweetDraft }),
        });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Failed to post tweet');
        executionResults.tweet = data;
      }

      // Path 3: Create article draft
      if (outputArticle) {
        const resp = await fetch(`/api/admin/add-content/article?key=${adminKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: articleTitle || title,
            article_type: articleType,
            content: articleContent,
            meta_description: metaDescription,
            source_url: preview?.source_url || url,
            resource_id: executionResults.resource?.resource?.id || null,
          }),
        });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Failed to create article');
        executionResults.article = data;
      }

      setResults(executionResults);
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
    setResults(null);
    setError(null);
    setDuplicateWarning(null);
    setTitle('');
    setSummary('');
    setCategory('');
    setTags('');
    setScore(5);
    setTweetDraft('');
    setOutputResource(true);
    setOutputTweet(false);
    setOutputArticle(false);
    setArticleTitle('');
    setArticleType('daily');
    setMetaDescription('');
    setArticleContent('');
    setShowArticlePreview(false);
  }

  function getExecuteButtonText() {
    if (posting) return 'Processing...';
    const parts = [];
    if (outputResource) parts.push('Save Resource & Tweet');
    if (outputTweet) parts.push('Post Tweet');
    if (outputArticle) parts.push('Create Article Draft');
    return parts.join(' + ') || 'Select an output';
  }

  const hasAnyOutput = outputResource || outputTweet || outputArticle;

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#3D2E1F] mb-6">Add Content</h2>

      {/* Success results */}
      {results && (
        <div className="space-y-3 mb-6">
          {results.resource && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-emerald-800 mb-2">Resource saved</h3>
              <div className="space-y-1 text-sm text-emerald-700">
                <p>{results.resource.resource.title}</p>
                <p>
                  Tweet:{' '}
                  <a href={results.resource.tweet.url} target="_blank" rel="noopener noreferrer" className="underline">
                    {results.resource.tweet.url}
                  </a>
                </p>
                {results.resource.tags?.length > 0 && (
                  <p>Tags: {results.resource.tags.join(', ')}</p>
                )}
              </div>
            </div>
          )}

          {results.tweet && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">Tweet posted</h3>
              <p className="text-sm text-blue-700">
                <a href={results.tweet.tweet.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {results.tweet.tweet.url}
                </a>
              </p>
            </div>
          )}

          {results.article && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">Article draft created</h3>
              <div className="space-y-1 text-sm text-amber-700">
                <p>{results.article.article.title}</p>
                <p>Slug: {results.article.article.slug}</p>
                <p>Status: Draft (publish from the Digest tab)</p>
              </div>
            </div>
          )}

          <button
            onClick={handleReset}
            className="px-4 py-2 bg-[#C15F3C] text-white rounded-lg text-sm font-medium hover:bg-[#A84E31]"
          >
            Add another
          </button>
        </div>
      )}

      {/* URL input */}
      {!results && (
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
            {!preview && !duplicateWarning && (
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="px-5 py-2.5 bg-[#C15F3C] text-white rounded-lg text-sm font-medium hover:bg-[#A84E31] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Extracting...' : 'Extract'}
              </button>
            )}
            {(preview || duplicateWarning) && (
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

      {/* Duplicate warning */}
      {duplicateWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-700">{duplicateWarning}</p>
          <p className="text-xs text-amber-600 mt-1">You can still create an article about this content.</p>
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
      {(preview || duplicateWarning) && !results && (
        <div className="bg-white rounded-xl border border-[#E0D5C1] p-6 space-y-5">
          {/* Source badge */}
          {preview && (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-[#F5F0E8] text-[#5C4A32] rounded text-xs font-medium">
                {URL_TYPE_LABELS[preview.url_type] || 'Link'}
              </span>
              {preview.author && (
                <span className="text-xs text-[#8B7355]">by {preview.author}</span>
              )}
              {preview.transcript && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-medium border border-emerald-200">
                  Transcript available
                </span>
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
          )}

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
                {CATEGORIES.map((c) => (
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

          {/* Output Selection */}
          <div className="border-t border-[#E0D5C1] pt-5">
            <label className="block text-xs font-medium text-[#8B7355] mb-3">Output options (select at least one)</label>
            <div className="space-y-3">
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${outputResource ? 'bg-emerald-50 border-emerald-200' : 'bg-[#FAF9F5] border-[#E0D5C1] hover:bg-[#F5F0E8]'} ${duplicateWarning ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input
                  type="checkbox"
                  checked={outputResource}
                  onChange={(e) => handleResourceToggle(e.target.checked)}
                  disabled={!!duplicateWarning}
                  className="mt-0.5 accent-emerald-600"
                />
                <div>
                  <span className="text-sm font-medium text-[#3D2E1F]">Add to resource list</span>
                  <p className="text-xs text-[#8B7355] mt-0.5">Save to database + post tweet about this resource</p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${outputTweet ? 'bg-blue-50 border-blue-200' : 'bg-[#FAF9F5] border-[#E0D5C1] hover:bg-[#F5F0E8]'}`}>
                <input
                  type="checkbox"
                  checked={outputTweet}
                  onChange={(e) => handleTweetToggle(e.target.checked)}
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <span className="text-sm font-medium text-[#3D2E1F]">Post standalone tweet</span>
                  <p className="text-xs text-[#8B7355] mt-0.5">Post tweet only (no resource saved to database)</p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${outputArticle ? 'bg-amber-50 border-amber-200' : 'bg-[#FAF9F5] border-[#E0D5C1] hover:bg-[#F5F0E8]'}`}>
                <input
                  type="checkbox"
                  checked={outputArticle}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setOutputArticle(checked);
                    if (checked) {
                      // Auto-fill meta description from summary
                      if (!metaDescription && summary) {
                        setMetaDescription(summary.length > 160 ? summary.substring(0, 157) + '...' : summary);
                      }
                      // Auto-generate article content if empty
                      if (!articleContent && preview) {
                        handleGenerateArticle();
                      }
                    }
                  }}
                  className="mt-0.5 accent-amber-600"
                />
                <div>
                  <span className="text-sm font-medium text-[#3D2E1F]">Create article on site</span>
                  <p className="text-xs text-[#8B7355] mt-0.5">Create a draft article at /digest/[slug] (publish later from Digest tab)</p>
                </div>
              </label>
            </div>
          </div>

          {/* Article sub-form */}
          {outputArticle && (
            <div className="border-t border-[#E0D5C1] pt-5 space-y-4">
              <h3 className="text-sm font-semibold text-[#3D2E1F]">Article Details</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#8B7355] mb-1">Article Title</label>
                  <input
                    type="text"
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                    placeholder={title}
                    className="w-full px-3 py-2 bg-[#FAF9F5] border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#C15F3C]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8B7355] mb-1">Article Type</label>
                  <select
                    value={articleType}
                    onChange={(e) => setArticleType(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF9F5] border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#C15F3C]/30"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8B7355] mb-1">Meta Description (SEO)</label>
                <input
                  type="text"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  maxLength={160}
                  placeholder="Brief description for search engines (max 160 chars)"
                  className="w-full px-3 py-2 bg-[#FAF9F5] border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#C15F3C]/30"
                />
                <span className="text-xs text-[#B8A990]">{metaDescription.length}/160</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-[#8B7355]">Content (Markdown)</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateArticle}
                      disabled={generatingArticle}
                      className="px-3 py-1 bg-[#C15F3C] text-white rounded text-xs font-medium hover:bg-[#A84E31] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generatingArticle ? 'Generating...' : 'Auto-generate with Claude'}
                    </button>
                    {articleContent && (
                      <button
                        type="button"
                        onClick={() => setShowArticlePreview(!showArticlePreview)}
                        className="px-3 py-1 bg-white text-[#5C4A32] border border-[#E0D5C1] rounded text-xs font-medium hover:bg-[#F5F0E8]"
                      >
                        {showArticlePreview ? 'Edit' : 'Preview'}
                      </button>
                    )}
                  </div>
                </div>

                {generatingArticle && (
                  <div className="text-center py-8 bg-[#FAF9F5] border border-[#E0D5C1] rounded-lg">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#C15F3C] border-t-transparent mb-2"></div>
                    <p className="text-xs text-[#8B7355]">Generating article content with Claude...</p>
                  </div>
                )}

                {!generatingArticle && !showArticlePreview && (
                  <textarea
                    value={articleContent}
                    onChange={(e) => setArticleContent(e.target.value)}
                    rows={12}
                    placeholder="Write or paste your article content in Markdown format..."
                    className="w-full px-3 py-2 bg-[#FAF9F5] border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#C15F3C]/30 font-mono resize-y"
                  />
                )}

                {!generatingArticle && showArticlePreview && articleContent && (
                  <div
                    className="w-full px-4 py-3 bg-white border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm prose prose-sm max-w-none overflow-y-auto"
                    style={{ maxHeight: '400px' }}
                    dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(articleContent) }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-[#E0D5C1]">
            <button
              onClick={handleExecute}
              disabled={posting || !hasAnyOutput}
              className="px-5 py-2.5 bg-[#C15F3C] text-white rounded-lg text-sm font-medium hover:bg-[#A84E31] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {getExecuteButtonText()}
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

// Simple markdown to HTML for preview (no heavy dependency needed)
function simpleMarkdownToHtml(md) {
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f5f0e8;padding:1px 4px;border-radius:3px">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#C15F3C">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, function(match, offset, str) {
      // Don't wrap lines that are already HTML tags
      return match;
    })
    .replace(/^([^<].*)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[123]>)/g, '$1')
    .replace(/(<\/h[123]>)<\/p>/g, '$1')
    .replace(/<p>(<ul>)/g, '$1')
    .replace(/(<\/ul>)<\/p>/g, '$1');
}
