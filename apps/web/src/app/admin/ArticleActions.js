'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ArticleActions({ article, adminKey }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showContent, setShowContent] = useState(false);
  const [showTweets, setShowTweets] = useState(false);
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
        const data = await res.json();
        if (action === 'publish_site') {
          setDone('Published on site');
        } else if (action === 'schedule_tweets') {
          setDone(`Tweets scheduled: ${new Date(data.scheduled_for).toLocaleString()}`);
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

  if (done) {
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
        done.includes('Rejected') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
      }`}>
        {done}
      </span>
    );
  }

  // Parse tweet thread from article
  const tweetThread = (() => {
    try {
      if (typeof article.tweet_thread === 'string') return JSON.parse(article.tweet_thread);
      return article.tweet_thread || [];
    } catch { return []; }
  })();
  const promoTweet = article.promo_tweet || '';

  return (
    <div className="flex flex-col gap-3 w-full mt-4 border-t border-[#E0D5C1] pt-4">
      {/* Preview toggles */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setShowContent(!showContent); setShowTweets(false); }}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E0D5C1] text-[#5C4A32] hover:bg-[#F5F0E8] transition-colors"
        >
          {showContent ? 'Hide Article' : 'Preview Article'}
        </button>
        <button
          onClick={() => { setShowTweets(!showTweets); setShowContent(false); }}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E0D5C1] text-[#5C4A32] hover:bg-[#F5F0E8] transition-colors"
        >
          {showTweets ? 'Hide Tweets' : 'Preview Tweets'} ({tweetThread.length} tweets)
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

      {/* Tweet thread preview */}
      {showTweets && (
        <div className="bg-[#FAF9F5] border border-[#E0D5C1] rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-[#3D2E1F] mb-2">Tweet Thread ({tweetThread.length} tweets):</p>
          {tweetThread.map((tweet, i) => (
            <div key={i} className="bg-white border border-[#E0D5C1] rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-[#8B7355]">Tweet {i + 1}</span>
                <span className={`text-[10px] ${tweet.length > 280 ? 'text-red-500 font-bold' : 'text-[#8B7355]'}`}>
                  {tweet.length}/280
                </span>
              </div>
              <p className="text-xs text-[#3D2E1F] whitespace-pre-wrap">{tweet}</p>
            </div>
          ))}

          {promoTweet && (
            <>
              <p className="text-xs font-semibold text-[#3D2E1F] mt-4 mb-2">Promo Tweet (standalone):</p>
              <div className="bg-white border border-[#E0D5C1] rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-[#8B7355]">Promo</span>
                  <span className={`text-[10px] ${promoTweet.length > 280 ? 'text-red-500 font-bold' : 'text-[#8B7355]'}`}>
                    {promoTweet.length}/280
                  </span>
                </div>
                <p className="text-xs text-[#3D2E1F] whitespace-pre-wrap">{promoTweet}</p>
              </div>
            </>
          )}

          <p className="text-[10px] text-[#A89070] mt-2">
            Note: {'{{ARTICLE_URL}}'} will be replaced with the real article link after publishing on the site.
          </p>
        </div>
      )}

      {/* Actions */}
      {article.status === 'draft' && (
        <>
          {!showSchedule && !showReject && (
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

      {/* Published on site but tweets not yet scheduled */}
      {article.status === 'published' && !article.thread_url && (
        <>
          {!showSchedule ? (
            <button
              onClick={() => setShowSchedule(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors self-start"
            >
              Schedule Tweets
            </button>
          ) : (
            <div className="flex flex-col gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-medium text-blue-800 mb-1">Schedule tweets for:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleAction('schedule_tweets', { slot: 'now' })}
                  disabled={loading}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Now
                </button>
                <button
                  onClick={() => handleAction('schedule_tweets', { slot: 'morning' })}
                  disabled={loading}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Morning (9 AM)
                </button>
                <button
                  onClick={() => handleAction('schedule_tweets', { slot: 'evening' })}
                  disabled={loading}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Evening (5 PM)
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="datetime-local"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="text-xs border border-blue-300 rounded-lg px-2 py-1.5 bg-white"
                />
                <button
                  onClick={() => handleAction('schedule_tweets', { scheduledFor: customDate })}
                  disabled={loading || !customDate}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Custom
                </button>
              </div>
              <button
                onClick={() => setShowSchedule(false)}
                className="text-xs text-blue-600 hover:underline self-start"
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
