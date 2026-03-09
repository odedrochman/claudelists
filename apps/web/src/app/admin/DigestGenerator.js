'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DigestGenerator({ adminKey, unfeaturedCount }) {
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const router = useRouter();

  async function handleGenerate(type) {
    setLoading(true);
    setLoadingType(type);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`/api/admin/generate-digest?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, count: 5 }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult(data);
        setTimeout(() => router.refresh(), 2000);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  }

  async function handleSeedBackgrounds() {
    setSeedLoading(true);
    setSeedResult(null);
    try {
      const res = await fetch(`/api/admin/generate-og-background/seed?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 4 }),
      });
      const data = await res.json();
      if (res.ok) {
        const generated = Object.values(data.categories || {}).reduce((sum, c) => sum + (c.generated || 0), 0);
        const skipped = Object.values(data.categories || {}).filter(c => c.skipped).length;
        setSeedResult({
          success: true,
          message: `Generated ${generated} backgrounds, ${skipped} categories skipped, ${data.resourcesAssigned || 0} resources assigned`,
        });
      } else {
        setSeedResult({ success: false, message: data.error || 'Seed failed' });
      }
    } catch {
      setSeedResult({ success: false, message: 'Network error' });
    } finally {
      setSeedLoading(false);
    }
  }

  return (
    <div className="mb-6 bg-white rounded-xl border border-[#E0D5C1] p-5">
      <h3 className="text-sm font-semibold text-[#3D2E1F] mb-3">Generate Digest</h3>

      <div className="flex gap-3 flex-wrap items-center">
        <button
          onClick={() => handleGenerate('daily')}
          disabled={loading || unfeaturedCount < 2}
          className="px-4 py-2 bg-[#C15F3C] text-white text-sm font-medium rounded-lg hover:bg-[#A84E31] disabled:opacity-50 transition-colors"
        >
          {loadingType === 'daily' ? (
            <span className="flex items-center gap-2">
              <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
              Generating Daily...
            </span>
          ) : (
            'Generate Daily'
          )}
        </button>

        <button
          onClick={() => handleGenerate('weekly')}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {loadingType === 'weekly' ? (
            <span className="flex items-center gap-2">
              <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
              Generating Weekly...
            </span>
          ) : (
            'Generate Weekly'
          )}
        </button>

        <span className="text-xs text-[#8B7355]">
          {unfeaturedCount} unfeatured resource{unfeaturedCount !== 1 ? 's' : ''} available
        </span>
      </div>

      {/* Success */}
      {result && (
        <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          <p className="text-sm font-medium text-emerald-800">
            Draft created: {result.article.title}
          </p>
          <p className="text-xs text-emerald-600 mt-1">
            {result.resourceCount} resources included.
            {result.unfeaturedRemaining != null && ` ${result.unfeaturedRemaining} unfeatured remaining.`}
            {result.dailyCount && ` Compiled from ${result.dailyCount} daily articles.`}
          </p>
          <p className="text-xs text-emerald-500 mt-1">
            Refreshing page...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* OG Background Seeder */}
      <div className="mt-4 pt-4 border-t border-[#E0D5C1]">
        <h4 className="text-xs font-semibold text-[#8B7355] mb-2">OG Backgrounds</h4>
        <div className="flex gap-3 items-center flex-wrap">
          <button
            onClick={handleSeedBackgrounds}
            disabled={seedLoading}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {seedLoading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                Seeding Backgrounds...
              </span>
            ) : (
              'Seed Category Backgrounds'
            )}
          </button>
          <span className="text-[10px] text-[#8B7355]">
            Generates AI backgrounds for each category pool (one-time setup)
          </span>
        </div>
        {seedResult && (
          <div className={`mt-2 p-2 rounded-lg text-xs ${seedResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {seedResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
