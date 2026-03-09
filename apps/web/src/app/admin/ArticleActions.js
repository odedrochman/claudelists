'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ArticleActions({ article, adminKey }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showContent, setShowContent] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  const [xArticleUrl, setXArticleUrl] = useState('');
  const [promoPreview, setPromoPreview] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [postResult, setPostResult] = useState(null);
  const router = useRouter();

  // Edit state
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editMetaDesc, setEditMetaDesc] = useState('');
  const [editArticleType, setEditArticleType] = useState('daily');
  const [editLoading, setEditLoading] = useState(false);
  const [editPreview, setEditPreview] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [ogBgLoading, setOgBgLoading] = useState(false);
  const [ogBgResult, setOgBgResult] = useState(null);
  const [xArticleContent, setXArticleContent] = useState(null);
  const [xArticleLoading, setXArticleLoading] = useState(false);
  const [xArticleCopied, setXArticleCopied] = useState(false);

  const articleId = article.id;

  async function handleAction(action, extra = {}) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/articles/${articleId}?key=${adminKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });

      if (res.ok) {
        if (action === 'publish_site') {
          setDone('Published on site');
        } else if (action === 'reject') {
          setDone('Rejected');
        }
        setTimeout(() => router.refresh(), 1500);
      } else {
        const data = await res.json();
        alert(data.error || 'Something went wrong');
      }
    } catch {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handlePromoPreview() {
    setPromoLoading(true);
    try {
      const res = await fetch(`/api/admin/articles/${articleId}/promo-tweet?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', xArticleUrl: xArticleUrl || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setPromoPreview(data);
      } else {
        alert(data.error || 'Preview failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setPromoLoading(false);
    }
  }

  async function handlePromoPost() {
    if (!confirm('Post this promo tweet to X? This cannot be undone.')) return;
    setPromoLoading(true);
    try {
      const res = await fetch(`/api/admin/articles/${articleId}/promo-tweet?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post', xArticleUrl: xArticleUrl || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setPostResult(data);
        setTimeout(() => router.refresh(), 2000);
      } else {
        alert(data.error || 'Post failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setPromoLoading(false);
    }
  }

  function openEditor() {
    setEditTitle(article.title || '');
    setEditContent(article.content || '');
    setEditMetaDesc(article.meta_description || '');
    setEditArticleType(article.article_type || 'daily');
    setEditPreview(false);
    setShowEdit(true);
  }

  async function handleSaveEdit() {
    setEditLoading(true);
    try {
      const res = await fetch(`/api/admin/articles/${articleId}?key=${adminKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          title: editTitle,
          content: editContent,
          meta_description: editMetaDesc,
          article_type: editArticleType,
        }),
      });

      if (res.ok) {
        setShowEdit(false);
        setDone('Saved');
        setTimeout(() => { setDone(null); router.refresh(); }, 1500);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save');
      }
    } catch {
      alert('Network error');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleGenerateOgBg() {
    setOgBgLoading(true);
    setOgBgResult(null);
    try {
      const res = await fetch(`/api/admin/generate-og-background?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'article', targetId: articleId }),
      });
      const data = await res.json();
      if (res.ok) {
        setOgBgResult({ success: true, url: data.url });
        setTimeout(() => router.refresh(), 2000);
      } else {
        setOgBgResult({ success: false, error: data.error || 'Failed to generate' });
      }
    } catch {
      setOgBgResult({ success: false, error: 'Network error' });
    } finally {
      setOgBgLoading(false);
    }
  }

  async function handleGenerateXArticle() {
    setXArticleLoading(true);
    setXArticleContent(null);
    setXArticleCopied(false);
    try {
      const res = await fetch(`/api/admin/articles/${articleId}/x-article-content?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        setXArticleContent(data);
      } else {
        alert(data.error || 'Failed to generate X Article content');
      }
    } catch {
      alert('Network error');
    } finally {
      setXArticleLoading(false);
    }
  }

  async function copyXArticleContent() {
    if (xArticleContent?.content) {
      await navigator.clipboard.writeText(xArticleContent.content);
      setXArticleCopied(true);
      setTimeout(() => setXArticleCopied(false), 2000);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/admin/add-content/generate-article?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          summary: '',
          source_url: '',
          url_type: 'article',
          content: '',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setEditContent(data.content);
      } else {
        alert(data.error || 'Failed to regenerate');
      }
    } catch {
      alert('Network error');
    } finally {
      setRegenerating(false);
    }
  }

  if (done) {
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
        done.includes('Rejected') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
      }`}>
        {done}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full mt-4 border-t border-[#E0D5C1] pt-4">
      {/* Preview toggle + OG Background */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setShowContent(!showContent)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E0D5C1] text-[#5C4A32] hover:bg-[#F5F0E8] transition-colors"
        >
          {showContent ? 'Hide Article' : 'Preview Article'}
        </button>
        <button
          onClick={handleGenerateOgBg}
          disabled={ogBgLoading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 disabled:opacity-50 transition-colors"
        >
          {ogBgLoading ? 'Generating BG...' : article.og_background_url ? 'Regenerate OG Background' : 'Generate OG Background'}
        </button>
        {ogBgResult && (
          <span className={`text-[10px] ${ogBgResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
            {ogBgResult.success ? 'Background generated!' : ogBgResult.error}
          </span>
        )}
      </div>

      {/* Article content preview */}
      {showContent && (
        <div className="bg-[#FAF9F5] border border-[#E0D5C1] rounded-lg p-4 max-h-96 overflow-y-auto">
          <pre className="text-xs text-[#3D2E1F] whitespace-pre-wrap font-sans leading-relaxed">
            {article.content}
          </pre>
        </div>
      )}

      {/* Draft actions: Edit / Publish to Site / Reject */}
      {article.status === 'draft' && (
        <>
          {/* Edit panel */}
          {showEdit && (
            <div className="flex flex-col gap-4 p-4 bg-[#FAF9F5] rounded-lg border border-[#E0D5C1]">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[#3D2E1F]">Edit Draft</h4>
                <button
                  onClick={() => setShowEdit(false)}
                  className="text-xs text-[#8B7355] hover:underline"
                >
                  Cancel
                </button>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-[#8B7355] mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#C15F3C]/30"
                />
              </div>

              {/* Article Type + Meta Description */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#8B7355] mb-1">Type</label>
                  <select
                    value={editArticleType}
                    onChange={(e) => setEditArticleType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#C15F3C]/30"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8B7355] mb-1">Meta Description</label>
                  <input
                    type="text"
                    value={editMetaDesc}
                    onChange={(e) => setEditMetaDesc(e.target.value)}
                    maxLength={160}
                    className="w-full px-3 py-2 bg-white border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#C15F3C]/30"
                  />
                </div>
              </div>

              {/* Content */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-[#8B7355]">Content (Markdown)</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      className="px-3 py-1 bg-[#C15F3C] text-white rounded text-xs font-medium hover:bg-[#A84E31] disabled:opacity-50"
                    >
                      {regenerating ? 'Generating...' : 'Regenerate with Claude'}
                    </button>
                    {editContent && (
                      <button
                        type="button"
                        onClick={() => setEditPreview(!editPreview)}
                        className="px-3 py-1 bg-white text-[#5C4A32] border border-[#E0D5C1] rounded text-xs font-medium hover:bg-[#F5F0E8]"
                      >
                        {editPreview ? 'Edit' : 'Preview'}
                      </button>
                    )}
                  </div>
                </div>

                {regenerating && (
                  <div className="text-center py-8 bg-white border border-[#E0D5C1] rounded-lg">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#C15F3C] border-t-transparent mb-2"></div>
                    <p className="text-xs text-[#8B7355]">Regenerating article with Claude...</p>
                  </div>
                )}

                {!regenerating && !editPreview && (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 bg-white border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#C15F3C]/30 font-mono resize-y"
                  />
                )}

                {!regenerating && editPreview && editContent && (
                  <div
                    className="w-full px-4 py-3 bg-white border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm prose prose-sm max-w-none overflow-y-auto"
                    style={{ maxHeight: '400px' }}
                    dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(editContent) }}
                  />
                )}
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={editLoading || !editContent.trim()}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setShowEdit(false)}
                  className="px-3 py-2 text-[#8B7355] text-sm hover:text-[#5C4A32]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!showReject && !showEdit && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={openEditor}
                disabled={loading}
                className="px-4 py-2 bg-[#C15F3C] text-white text-sm font-medium rounded-lg hover:bg-[#A84E31] disabled:opacity-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => handleAction('publish_site')}
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Publishing...' : 'Publish to Site'}
              </button>
              <button
                onClick={() => setShowReject(true)}
                disabled={loading}
                className="px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
            </div>
          )}

          {showReject && !showEdit && (
            <div className="flex flex-col gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <input
                type="text"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Rejection notes (optional)"
                className="text-xs border border-red-300 rounded-lg px-2 py-1.5 bg-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction('reject', { notes: rejectNotes })}
                  disabled={loading}
                  className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  Confirm Reject
                </button>
                <button
                  onClick={() => setShowReject(false)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Published: OG Image + Generate X Article Content */}
      {article.status === 'published' && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleGenerateXArticle}
              disabled={xArticleLoading}
              className="px-4 py-2 bg-[#1D9BF0] text-white text-sm font-medium rounded-lg hover:bg-[#1A8CD8] disabled:opacity-50 transition-colors"
            >
              {xArticleLoading ? 'Generating...' : 'Generate X Article Content'}
            </button>
            <a
              href={`/digest/${article.slug}/opengraph-image`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#5C4A32] text-white text-sm font-medium rounded-lg hover:bg-[#3D2E1F] transition-colors inline-flex items-center gap-1.5"
            >
              Download OG Image
            </a>
          </div>

          {xArticleContent && (
            <div className="flex flex-col gap-2 p-3 bg-sky-50 rounded-lg border border-sky-200">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-sky-800">
                  X Article Content ({xArticleContent.charCount} chars)
                </p>
                <button
                  onClick={copyXArticleContent}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    xArticleCopied
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-sky-600 text-white hover:bg-sky-700'
                  }`}
                >
                  {xArticleCopied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
              </div>
              <p className="text-[10px] text-sky-600">
                Lines marked [EMBED TWEET] = use + menu &gt; Tweet in X editor to embed
              </p>
              <pre className="text-xs text-[#3D2E1F] whitespace-pre-wrap font-sans leading-relaxed bg-white border border-sky-100 rounded-lg p-3 max-h-96 overflow-y-auto">
                {xArticleContent.content}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Published: Post Promo Tweet */}
      {article.status === 'published' && !article.thread_url && (
        <>
          {postResult ? (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-sm font-medium text-emerald-800">Promo tweet posted!</p>
              <a
                href={postResult.tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-700 hover:underline break-all"
              >
                {postResult.tweetUrl}
              </a>
            </div>
          ) : (
            <>
              {!showPromo ? (
                <button
                  onClick={() => setShowPromo(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors self-start"
                >
                  Post Promo Tweet
                </button>
              ) : (
                <div className="flex flex-col gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs font-medium text-blue-800">Promo Tweet</p>

                  {/* X Article URL input */}
                  <div>
                    <label className="text-[10px] text-blue-700 block mb-1">
                      X Article URL (optional, paste after publishing on X)
                    </label>
                    <input
                      type="url"
                      value={xArticleUrl}
                      onChange={(e) => setXArticleUrl(e.target.value)}
                      placeholder="https://x.com/i/article/..."
                      className="w-full text-xs border border-blue-300 rounded-lg px-2 py-1.5 bg-white"
                    />
                  </div>

                  {/* Preview button */}
                  <button
                    onClick={handlePromoPreview}
                    disabled={promoLoading}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 self-start"
                  >
                    {promoLoading ? 'Loading...' : 'Preview'}
                  </button>

                  {/* Preview card */}
                  {promoPreview && (
                    <div className="bg-white border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-medium text-blue-700">
                          {promoPreview.resourceCount} resources, {promoPreview.authors.length} creators
                        </span>
                        <span className="text-[10px] text-[#8B7355]">
                          {promoPreview.charCount} chars
                        </span>
                      </div>
                      <pre className="text-xs text-[#3D2E1F] whitespace-pre-wrap font-sans leading-relaxed">
                        {promoPreview.text}
                      </pre>
                      <p className="text-[10px] text-blue-600 mt-2">
                        OG image will be attached as media
                      </p>
                    </div>
                  )}

                  {/* Post + Cancel buttons */}
                  <div className="flex gap-2">
                    {promoPreview && (
                      <button
                        onClick={handlePromoPost}
                        disabled={promoLoading}
                        className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {promoLoading ? 'Posting...' : 'Post Promo Tweet'}
                      </button>
                    )}
                    <button
                      onClick={() => { setShowPromo(false); setPromoPreview(null); }}
                      className="text-xs text-blue-600 hover:underline self-center"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

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
    .replace(/^([^<].*)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[123]>)/g, '$1')
    .replace(/(<\/h[123]>)<\/p>/g, '$1')
    .replace(/<p>(<ul>)/g, '$1')
    .replace(/(<\/ul>)<\/p>/g, '$1');
}
