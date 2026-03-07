'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminActions({ submissionId, adminKey }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const router = useRouter();

  async function handleAction(action) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}?key=${adminKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        setDone(action === 'approve' ? 'Approved' : 'Rejected');
        setTimeout(() => router.refresh(), 1000);
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
        done === 'Approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
      }`}>
        {done}
      </span>
    );
  }

  return (
    <div className="flex gap-2 shrink-0">
      <button
        onClick={() => handleAction('approve')}
        disabled={loading}
        className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        Approve
      </button>
      <button
        onClick={() => handleAction('reject')}
        disabled={loading}
        className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
      >
        Reject
      </button>
    </div>
  );
}
