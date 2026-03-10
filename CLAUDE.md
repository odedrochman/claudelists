# ClaudeLists.com

Curated directory of Claude ecosystem resources. MCP servers, prompts, workflows, tools, and daily digests.

## Stack
- **Monorepo**: npm workspaces
- **Web**: `apps/web` - Next.js 15 (App Router), Tailwind CSS, deployed on Vercel
- **Pipeline**: `packages/pipeline` - Twitter bookmark ingestion, Claude analysis, Supabase push
- **Database**: Supabase (PostgreSQL) with RLS
- **APIs**: Twitter API v2, YouTube Data API v3, Anthropic Claude Sonnet 4, Gemini image gen

## Commands
```bash
npm run dev                                          # Dev server (from root)
node packages/pipeline/src/index.js --skip-post      # Run pipeline (from root)
vercel deploy --prod --yes                           # Deploy (from root, NOT apps/web)
```

## Rules
- **No em dashes.** Ever. Use periods, commas, or parentheses. No `&mdash;` either.
- **Deploy from repo root.** Never from `apps/web`. Verify `apps/web/.vercel/project.json` has project ID `prj_djFdBNlXhKB1rDJnMWsRmMk0Zblc`.
- **Server components can't pass functions as props.** Use pre-computed href objects for links/sorting.
- **Never post to Twitter without user approval.** Draft first, show it, wait for explicit confirmation.
- **Article-then-tweet.** Create article on site first, publish it, then tweet. Never reverse this.
- **Pipeline runs from root.** `node packages/pipeline/src/index.js`, not via npm workspace.
- **Summary, not description.** The resources table column is `summary`, not `description`.
- **Fallback category is Community Showcase.** Not "Discussion & Opinion" (old taxonomy).

## Key Patterns
- **View toggle**: `?view=list`/`?view=cards`. Default list. Mobile always cards.
- **Sort**: Default "newest". All table columns sortable with pre-computed sortHrefs.
- **OG images**: Keep elements 72px+ from bottom (X crops). Download via `/digest/{slug}/opengraph-image`.
- **Heading parsing**: Handle both `## Title` and `## [Title](url)` formats.
- **X Article detection**: Check before thread detection (bird CLI's isThread is unreliable).
- **Supabase clients**: `createServerClient()` (anon), `createServiceClient()` (service_role), `createBrowserClient()` (anon).

## Project Structure
```
apps/web/src/
  app/
    admin/          # Admin page (submissions, articles, add content, digest)
    api/admin/      # Admin API routes (add-content, articles, generate-digest)
    browse/         # Browse page with filters
    digest/         # Article list + detail pages
    resource/       # Resource detail page
  components/       # ResourceCard, ResourceTable, SearchBar, ViewToggle
  lib/              # supabase.js, categories.js, resource-utils.js, twitter.js, og-background.js
packages/pipeline/src/
  index.js          # Pipeline entry point
  analyze.js        # Claude categorization/scoring
  extract-url.js    # URL extraction + Claude analysis
  push-to-supabase.js  # DB insertion
  promo-tweet.js    # Shared promo tweet logic
  publish-long-tweet.js  # X Article content + promo CLI
```
