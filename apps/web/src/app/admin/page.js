import { createServiceClient } from '../../lib/supabase';
import AdminActions from './AdminActions';
import ArticleActions from './ArticleActions';
import AddContent from './AddContent';
import DigestGenerator from './DigestGenerator';
import FirehoseReview from './FirehoseReview';

export const metadata = {
  title: 'Admin - ClaudeLists',
  robots: 'noindex, nofollow',
};

const TYPE_BADGE = {
  daily: 'bg-blue-50 text-blue-700',
  weekly: 'bg-purple-50 text-purple-700',
  monthly: 'bg-emerald-50 text-emerald-700',
};

const STATUS_BADGE = {
  draft: 'bg-yellow-50 text-yellow-700',
  scheduled: 'bg-blue-50 text-blue-700',
  published: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
};

export default async function AdminPage({ searchParams }) {
  const { key, status, tab } = await searchParams;

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

  const activeTab = tab || 'add-content';
  const supabase = createServiceClient();

  return (
    <div className="min-h-screen bg-[#FAF9F5]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Tab navigation */}
        <div className="flex items-center gap-4 mb-6 border-b border-[#E0D5C1]">
          {[
            { key: 'add-content', label: 'Add Content' },
            { key: 'firehose', label: 'Firehose' },
            { key: 'submissions', label: 'Submissions' },
            { key: 'digest', label: 'Digest' },
          ].map((t) => (
            <a
              key={t.key}
              href={`/admin?key=${key}&tab=${t.key}`}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === t.key
                  ? 'border-[#C15F3C] text-[#C15F3C]'
                  : 'border-transparent text-[#8B7355] hover:text-[#5C4A32]'
              }`}
            >
              {t.label}
            </a>
          ))}
        </div>

        {activeTab === 'add-content' && (
          <AddContent adminKey={key} />
        )}
        {activeTab === 'firehose' && (
          <FirehoseReview adminKey={key} />
        )}
        {activeTab === 'submissions' && (
          <SubmissionsTab supabase={supabase} filterStatus={status || 'pending'} adminKey={key} />
        )}
        {activeTab === 'digest' && (
          <ArticlesTab supabase={supabase} filterStatus={status || 'draft'} adminKey={key} />
        )}
      </div>
    </div>
  );
}

async function SubmissionsTab({ supabase, filterStatus, adminKey }) {
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
      <div className="text-center py-16">
        <p className="text-[#8B7355]">Failed to load submissions. Run migration 003_submissions_table.sql.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[#3D2E1F]">Submissions</h2>
        <div className="flex gap-2">
          {['pending', 'approved', 'rejected', 'all'].map((s) => (
            <a
              key={s}
              href={`/admin?key=${adminKey}&tab=submissions&status=${s}`}
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
                  <h3 className="text-lg font-semibold text-[#3D2E1F] truncate">{sub.title}</h3>
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
                  <AdminActions submissionId={sub.id} adminKey={adminKey} />
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
    </>
  );
}

async function ArticlesTab({ supabase, filterStatus, adminKey }) {
  // Count unfeatured resources for digest generator
  const { count: unfeaturedCount } = await supabase
    .from('resources')
    .select('id', { count: 'exact', head: true })
    .eq('featured_in_daily', false)
    .eq('status', 'published');

  let query = supabase
    .from('articles')
    .select(`
      id, slug, title, article_type, content, status,
      published_at, reviewer_notes, meta_description, og_quote, created_at,
      thread_url,
      article_resources ( resource_id )
    `)
    .order('created_at', { ascending: false });

  if (filterStatus !== 'all') {
    query = query.eq('status', filterStatus);
  }

  const { data: articles, error } = await query;

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-[#8B7355]">Failed to load digest. Run migration 004_articles_table.sql.</p>
      </div>
    );
  }

  return (
    <>
      <DigestGenerator adminKey={adminKey} unfeaturedCount={unfeaturedCount || 0} />

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[#3D2E1F]">Digest</h2>
        <div className="flex gap-2 flex-wrap">
          {['draft', 'scheduled', 'published', 'rejected', 'all'].map((s) => (
            <a
              key={s}
              href={`/admin?key=${adminKey}&tab=digest&status=${s}`}
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

      {(!articles || articles.length === 0) ? (
        <div className="text-center py-16">
          <p className="text-[#8B7355] text-lg">No {filterStatus === 'all' ? '' : filterStatus} articles.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => {
            const resourceCount = (article.article_resources || []).length;
            const preview = (article.content || '').slice(0, 200);

            return (
              <div key={article.id} className="bg-white rounded-xl border border-[#E0D5C1] p-5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Type badge + status */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_BADGE[article.article_type] || 'bg-gray-100 text-gray-700'}`}>
                        {article.article_type}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[article.status] || 'bg-gray-100 text-gray-700'}`}>
                        {article.status}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-[#3D2E1F]">{article.title}</h3>
                    {article.og_quote && (
                      <p className="text-sm text-[#C15F3C] mt-1 italic">&ldquo;{article.og_quote}&rdquo;</p>
                    )}

                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-[#8B7355]">
                      <span>{resourceCount} resource{resourceCount !== 1 ? 's' : ''}</span>
                      <span>{new Date(article.created_at).toLocaleDateString()}</span>
                      {article.published_at && (
                        <span className="text-emerald-600">
                          Published: {new Date(article.published_at).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Content preview */}
                    <p className="text-sm text-[#5C4A32] mt-3 line-clamp-3">{preview}...</p>

                    {/* Links for published articles */}
                    {article.status === 'published' && (
                      <div className="flex gap-3 mt-3 text-xs">
                        <a
                          href={`/digest/${article.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#C15F3C] hover:underline"
                        >
                          View digest
                        </a>
                        {article.thread_url && (
                          <a
                            href={article.thread_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#C15F3C] hover:underline"
                          >
                            View promo tweet
                          </a>
                        )}
                      </div>
                    )}

                    {article.reviewer_notes && (
                      <p className="text-xs text-[#A89070] mt-2 italic">Notes: {article.reviewer_notes}</p>
                    )}
                  </div>
                </div>

                {/* Actions below content for draft and published-without-tweets articles */}
                {(article.status === 'draft' || (article.status === 'published' && !article.thread_url)) && (
                  <ArticleActions article={article} adminKey={adminKey} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
