'use client';

import { useState, useEffect } from 'react';

const SCORE_STYLE = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  mid: 'bg-blue-50 text-blue-700 border-blue-200',
  low: 'bg-gray-50 text-gray-600 border-gray-200',
};

function getScoreClass(score) {
  if (score >= 8) return SCORE_STYLE.high;
  if (score >= 6) return SCORE_STYLE.mid;
  return SCORE_STYLE.low;
}

export default function FirehoseReview({ adminKey }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [error, setError] = useState(null);

  // Per-resource tweet state: { [resourceId]: { tweets, type, generating, posting, edited, posted, tweetUrl, skipping, skipped } }
  const [tweetState, setTweetState] = useState({});

  async function fetchResources() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/admin/firehose?key=${adminKey}&filter=${filter}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setResources(data.resources || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchResources();
  }, [filter]);

  function updateTweetState(resourceId, updates) {
    setTweetState(prev => ({
      ...prev,
      [resourceId]: { ...prev[resourceId], ...updates },
    }));
  }

  async function handleGenerateTweet(resourceId) {
    updateTweetState(resourceId, { generating: true });
    try {
      const resp = await fetch(`/api/admin/firehose?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-tweet', resourceId }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      updateTweetState(resourceId, {
        tweets: data.tweets,
        type: data.type,
        generating: false,
        edited: false,
      });
    } catch (e) {
      updateTweetState(resourceId, { generating: false });
      setError(e.message);
    }
  }

  async function handlePostTweet(resourceId) {
    const state = tweetState[resourceId];
    if (!state?.tweets) return;

    updateTweetState(resourceId, { posting: true });
    try {
      const tweetText = state.type === 'thread' ? state.tweets : state.tweets[0];
      const resp = await fetch(`/api/admin/firehose?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post-tweet', resourceId, tweetText }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      updateTweetState(resourceId, {
        posting: false,
        posted: true,
        tweetUrl: data.tweetUrl,
      });
    } catch (e) {
      updateTweetState(resourceId, { posting: false });
      setError(e.message);
    }
  }

  function handleEditTweet(resourceId, index, value) {
    const state = tweetState[resourceId];
    if (!state?.tweets) return;
    const newTweets = [...state.tweets];
    newTweets[index] = value;
    updateTweetState(resourceId, { tweets: newTweets, edited: true });
  }

  function handleSwitchType(resourceId) {
    const state = tweetState[resourceId];
    if (!state?.tweets) return;
    if (state.type === 'thread') {
      // Collapse to single
      updateTweetState(resourceId, { type: 'single', tweets: [state.tweets.join('\n\n')], edited: true });
    } else {
      // Split single into thread (by double newline or just keep as one)
      const parts = state.tweets[0].split(/\n\n+/).filter(Boolean);
      updateTweetState(resourceId, { type: 'thread', tweets: parts.length > 1 ? parts : [state.tweets[0]], edited: true });
    }
  }

  function handleAddTweet(resourceId) {
    const state = tweetState[resourceId];
    if (!state?.tweets) return;
    updateTweetState(resourceId, { tweets: [...state.tweets, ''], edited: true });
  }

  function handleRemoveTweet(resourceId, index) {
    const state = tweetState[resourceId];
    if (!state?.tweets || state.tweets.length <= 1) return;
    const newTweets = state.tweets.filter((_, i) => i !== index);
    updateTweetState(resourceId, { tweets: newTweets, edited: true });
  }

  async function handleSkipTweet(resourceId) {
    updateTweetState(resourceId, { skipping: true });
    try {
      const resp = await fetch(`/api/admin/firehose?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip-tweet', resourceId }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      updateTweetState(resourceId, { skipping: false, skipped: true });
    } catch (e) {
      updateTweetState(resourceId, { skipping: false });
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[#3D2E1F]">Firehose Review</h2>
        <div className="flex gap-2">
          {['pending', 'tweeted', 'skipped', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-[#C15F3C] text-white'
                  : 'bg-white text-[#5C4A32] border border-[#E0D5C1] hover:bg-[#F5F0E8]'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-xs text-red-500 hover:underline mt-1">Dismiss</button>
        </div>
      )}

      {loading && (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#C15F3C] border-t-transparent mb-3"></div>
          <p className="text-[#8B7355]">Loading firehose resources...</p>
        </div>
      )}

      {!loading && resources.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[#8B7355] text-lg">
            {filter === 'pending' ? 'No untweeted firehose resources yet.' : 'No firehose resources found.'}
          </p>
          <p className="text-[#B8A990] text-sm mt-2">
            Resources will appear here as the Firehose pipeline discovers Claude content from the web.
          </p>
        </div>
      )}

      {!loading && resources.length > 0 && (
        <div className="space-y-4">
          {resources.map((resource) => {
            const state = tweetState[resource.id] || {};
            const tags = (resource.resource_tags || []).map(rt => rt.tags?.name).filter(Boolean);
            const categoryName = resource.categories?.name || 'Unknown';

            return (
              <div key={resource.id} className="bg-white rounded-xl border border-[#E0D5C1] p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getScoreClass(resource.ai_quality_score)}`}>
                        {resource.ai_quality_score}/10
                      </span>
                      <span className="px-2 py-0.5 bg-[#F5F0E8] text-[#5C4A32] rounded text-xs font-medium">
                        {categoryName}
                      </span>
                      {resource.posted_to_twitter && resource.tweet_url && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">
                          Tweeted
                        </span>
                      )}
                      {resource.posted_to_twitter && !resource.tweet_url && (
                        <span className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded text-xs font-medium">
                          Skipped
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-[#3D2E1F]">{resource.title}</h3>
                    <p className="text-sm text-[#5C4A32] mt-1">{resource.summary}</p>

                    <div className="flex flex-wrap gap-2 mt-2">
                      {tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-[#FAF9F5] text-[#8B7355] rounded text-xs border border-[#E0D5C1]">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-xs text-[#8B7355]">
                      <a href={resource.primary_url} target="_blank" rel="noopener noreferrer" className="text-[#C15F3C] hover:underline truncate max-w-xs">
                        {resource.primary_url}
                      </a>
                      <span>{new Date(resource.created_at).toLocaleDateString()}</span>
                      {resource.author_handle && <span>via {resource.author_handle}</span>}
                    </div>
                  </div>
                </div>

                {/* Tweet section */}
                {!resource.posted_to_twitter && !state.posted && !state.skipped && (
                  <div className="mt-4 pt-4 border-t border-[#E0D5C1]">
                    {/* No tweet generated yet */}
                    {!state.tweets && !state.generating && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleGenerateTweet(resource.id)}
                          className="px-4 py-2 bg-[#C15F3C] text-white rounded-lg text-sm font-medium hover:bg-[#A84E31]"
                        >
                          Generate Tweet
                        </button>
                        <button
                          onClick={() => handleSkipTweet(resource.id)}
                          disabled={state.skipping}
                          className="px-4 py-2 bg-white text-[#8B7355] border border-[#E0D5C1] rounded-lg text-sm font-medium hover:bg-[#F5F0E8] disabled:opacity-50"
                        >
                          {state.skipping ? 'Skipping...' : 'No Tweet Needed'}
                        </button>
                      </div>
                    )}

                    {/* Generating */}
                    {state.generating && (
                      <div className="flex items-center gap-2 py-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#C15F3C] border-t-transparent"></div>
                        <span className="text-sm text-[#8B7355]">Generating tweet with Claude...</span>
                      </div>
                    )}

                    {/* Tweet editor */}
                    {state.tweets && !state.generating && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-[#8B7355]">
                            {state.type === 'thread' ? `Thread (${state.tweets.length} tweets)` : 'Single tweet'}
                          </span>
                          <button
                            onClick={() => handleSwitchType(resource.id)}
                            className="text-xs text-[#C15F3C] hover:underline"
                          >
                            Switch to {state.type === 'thread' ? 'single' : 'thread'}
                          </button>
                          <button
                            onClick={() => handleGenerateTweet(resource.id)}
                            className="text-xs text-[#8B7355] hover:text-[#C15F3C] hover:underline ml-auto"
                          >
                            Regenerate
                          </button>
                        </div>

                        {state.tweets.map((tweet, i) => (
                          <div key={i} className="relative">
                            {state.type === 'thread' && (
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-medium text-[#B8A990] uppercase">
                                  {i === 0 ? 'Hook' : i === state.tweets.length - 1 ? 'Closer' : `Tweet ${i + 1}`}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] ${tweet.length > 280 ? 'text-red-600 font-semibold' : 'text-[#B8A990]'}`}>
                                    {tweet.length}/280
                                  </span>
                                  {state.tweets.length > 1 && (
                                    <button
                                      onClick={() => handleRemoveTweet(resource.id, i)}
                                      className="text-[10px] text-red-400 hover:text-red-600"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                            {state.type === 'single' && (
                              <div className="flex justify-end mb-1">
                                <span className={`text-[10px] ${tweet.length > 4000 ? 'text-red-600 font-semibold' : 'text-[#B8A990]'}`}>
                                  {tweet.length} chars
                                </span>
                              </div>
                            )}
                            <textarea
                              value={tweet}
                              onChange={(e) => handleEditTweet(resource.id, i, e.target.value)}
                              rows={state.type === 'thread' ? 3 : 5}
                              className="w-full px-3 py-2 bg-[#FAF9F5] border border-[#E0D5C1] rounded-lg text-[#3D2E1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#C15F3C]/30 resize-none font-mono"
                            />
                          </div>
                        ))}

                        {state.type === 'thread' && (
                          <button
                            onClick={() => handleAddTweet(resource.id)}
                            className="text-xs text-[#C15F3C] hover:underline"
                          >
                            + Add tweet to thread
                          </button>
                        )}

                        {/* Post button */}
                        <div className="flex items-center gap-3 pt-2">
                          <button
                            onClick={() => handlePostTweet(resource.id)}
                            disabled={state.posting}
                            className="px-5 py-2 bg-[#C15F3C] text-white rounded-lg text-sm font-medium hover:bg-[#A84E31] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {state.posting
                              ? 'Posting...'
                              : state.type === 'thread'
                                ? `Post Thread (${state.tweets.length} tweets)`
                                : 'Post Tweet'
                            }
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Already posted */}
                {(resource.posted_to_twitter && resource.tweet_url) || state.posted ? (
                  <div className="mt-4 pt-4 border-t border-[#E0D5C1]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-600 font-medium">Posted</span>
                      {(state.tweetUrl || resource.tweet_url) && (
                        <a
                          href={state.tweetUrl || resource.tweet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#C15F3C] hover:underline"
                        >
                          View tweet
                        </a>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Skipped */}
                {((resource.posted_to_twitter && !resource.tweet_url) || state.skipped) && (
                  <div className="mt-4 pt-4 border-t border-[#E0D5C1]">
                    <span className="text-xs text-gray-500 font-medium">No tweet needed</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
