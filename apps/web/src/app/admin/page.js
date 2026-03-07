import { createServiceClient } from '../../lib/supabase';
import AdminActions from './AdminActions';

export const metadata = {
  title: 'Admin - ClaudeLists',
  robots: 'noindex, nofollow',
};

export default async function AdminPage({ searchParams }) {
  const { key, status } = await searchParams;

  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#3D2E1F] mb-2">Access Denied</h1>
          <p className="text-[#8B7355]">Invalid or missing admin key.</p>
        </div>
      </div>
    );
  }

  const supabase = createServiceClient();
  const filterStatus = status || 'pending';

  let query = supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false });

  if (filterStatus !== 'all') {
    query = query.eq('status', filterStatus);
  }

  const { data: submissions, error } = await query;

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#3D2E1F] mb-2">Error</h1>
          <p className="text-[#8B7355]">Failed to load submissions. Make sure the submissions table exists.</p>
          <p className="text-sm text-[#A89070] mt-2">Run migration 003_submissions_table.sql in Supabase.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#3D2E1F]">Submission Review</h1>
          <div className="flex gap-2">
            {['pending', 'approved', 'rejected', 'all'].map((s) => (
              <a
                key={s}
                href={`/admin?key=${key}&status=${s}`}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterStatus === s
                    ? 'bg-[#C15F3C] text-white'
                    : 'bg-white text-[#5C4A32] border border-[#E0D5C1] hover:bg-[#F5F0E8]'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </a>
            ))}
          </div>
        </div>

        {(!submissions || submissions.length === 0) ? (
          <div className="text-center py-16">
            <p className="text-[#8B7355] text-lg">No {filterStatus === 'all' ? '' : filterStatus} submissions.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((sub) => (
              <div key={sub.id} className="bg-white rounded-xl border border-[#E0D5C1] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-[#3D2E1F] truncate">{sub.title}</h2>
                    <a
                      href={sub.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#C15F3C] hover:underline break-all"
                    >
                      {sub.url}
                    </a>
                    {sub.description && (
                      <p className="text-sm text-[#5C4A32] mt-2">{sub.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-[#8B7355]">
                      {sub.resource_type && <span className="bg-[#F5F0E8] px-2 py-0.5 rounded">{sub.resource_type}</span>}
                      {sub.submitter_name && <span>By: {sub.submitter_name}</span>}
                      {sub.submitter_twitter && <span>@{sub.submitter_twitter}</span>}
                      <span>{new Date(sub.created_at).toLocaleDateString()}</span>
                    </div>
                    {sub.reviewer_notes && (
                      <p className="text-xs text-[#A89070] mt-2 italic">Notes: {sub.reviewer_notes}</p>
                    )}
                  </div>
                  {sub.status === 'pending' && (
                    <AdminActions submissionId={sub.id} adminKey={key} />
                  )}
                  {sub.status !== 'pending' && (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      sub.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {sub.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
