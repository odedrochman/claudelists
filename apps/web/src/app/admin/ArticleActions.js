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
      {/* Preview toggle */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShowContent(!showContent)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E0D5C1] text-[#5C4A32] hover:bg-[#F5F0E8] transition-colors"
        >
          {showContent ? 'Hide Article' : 'Preview Article'}
        </button>
      </div>

      {/* Article content preview */}
      {showContent && (
        <div className="bg-[#FAF9F5] border border-[#E0D5C1] rounded-lg p-4 max-h-96 overflow-y-auto">
          <pre className="text-xs text-[#3D2E1F] whitespace-pre-wrap font-sans leading-relaxed">
            {article.content}
          </pre>
        </div>
      )}

      {/* Draft actions: Publish to Site / Reject */}
      {article.status === 'draft' && (
        <>
          {!showReject && (
            <div className="flex gap-2 flex-wrap">
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

          {showReject && (
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
