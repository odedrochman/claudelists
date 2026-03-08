/**
 * Article quality checker.
 * Runs a comprehensive checklist on every generated article before saving.
 * Returns { passed, issues, warnings } where issues are blockers and warnings are advisory.
 */

const BANNED_WORDS = [
  'leveraging', 'harnessing', 'ai-powered', 'game-changer', 'revolutionary',
  'cutting-edge', 'unlock', 'empower', 'delve', 'tapestry', 'robust',
  'seamless', 'streamline', 'landscape', 'paradigm',
];

const EM_DASH_PATTERNS = [
  /\u2014/g,    // — (em dash unicode)
  /\u2013/g,    // – (en dash unicode)
  /(?<!-)-{3}(?!-)/g,  // triple hyphen (not markdown HR which is on its own line)
  /&mdash;/g,   // HTML entity
  /&ndash;/g,   // HTML entity
];

/**
 * Validate article content quality.
 * @param {object} article - The generated article object
 * @param {object[]} resources - The source resources used to generate the article
 * @returns {{ passed: boolean, issues: string[], warnings: string[] }}
 */
export function validateArticle(article, resources) {
  const issues = [];
  const warnings = [];
  const content = article.content || '';
  const contentLower = content.toLowerCase();

  // ── Structure checks ──────────────────────────────────────────

  // 1. Has title
  if (!article.title || article.title.trim().length === 0) {
    issues.push('MISSING: Article has no title');
  } else if (article.title.length > 80) {
    warnings.push(`TITLE_LENGTH: Title is ${article.title.length} chars (max 80)`);
  }

  // 2. Has content
  if (!content || content.trim().length === 0) {
    issues.push('MISSING: Article has no content');
  }

  // 3. Word count check (concise format: ~50-80 words per resource + intro/outro)
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
  const minWords = Math.max(150, resources.length * 60);
  if (wordCount < minWords * 0.7) {
    issues.push(`WORD_COUNT: Article is ${wordCount} words (minimum ~${minWords}). Too short.`);
  } else if (wordCount < minWords) {
    warnings.push(`WORD_COUNT: Article is ${wordCount} words (target ~${minWords}). Slightly under.`);
  }

  // 4. Each resource has a dedicated section (H2 heading)
  const h2Headings = content.match(/^## .+$/gm) || [];
  if (h2Headings.length < resources.length) {
    issues.push(`SECTIONS: Found ${h2Headings.length} H2 sections but expected ${resources.length} (one per resource)`);
  }

  // ── Handle tagging checks ─────────────────────────────────────

  // 5. Every resource with an author_handle must be tagged in content
  const missingHandles = [];
  for (const r of resources) {
    if (r.author_handle) {
      const handle = r.author_handle.replace(/^@/, '');
      if (!content.includes(`@${handle}`)) {
        missingHandles.push(`@${handle} (from "${r.title}")`);
      }
    }
  }
  if (missingHandles.length > 0) {
    issues.push(`HANDLES_MISSING: These @handles are not tagged in the article: ${missingHandles.join(', ')}`);
  }

  // 6. Check handles in tweet thread too
  if (article.tweetThread && Array.isArray(article.tweetThread)) {
    const threadText = article.tweetThread.join(' ');
    const missingInThread = [];
    for (const r of resources) {
      if (r.author_handle) {
        const handle = r.author_handle.replace(/^@/, '');
        if (!threadText.includes(`@${handle}`)) {
          missingInThread.push(`@${handle}`);
        }
      }
    }
    if (missingInThread.length > 0) {
      warnings.push(`HANDLES_THREAD: These @handles missing from tweet thread: ${missingInThread.join(', ')}`);
    }
  }

  // ── Writing style checks ──────────────────────────────────────

  // 7. No em dashes (strip markdown horizontal rules before checking)
  const contentNoHR = content.replace(/^\s*---+\s*$/gm, '');
  for (const pattern of EM_DASH_PATTERNS) {
    if (pattern.test(contentNoHR)) {
      issues.push(`EM_DASH: Found em dash or en dash in content. Replace with periods, commas, or parentheses.`);
      break;
    }
  }

  // 8. No banned AI-sounding words
  const foundBanned = [];
  for (const word of BANNED_WORDS) {
    if (contentLower.includes(word)) {
      foundBanned.push(word);
    }
  }
  if (foundBanned.length > 0) {
    issues.push(`BANNED_WORDS: Found prohibited words: ${foundBanned.join(', ')}`);
  }

  // 9. Check for generic/filler phrases
  const fillerPhrases = [
    'in today\'s rapidly',
    'in this article we',
    'without further ado',
    'let\'s dive in',
    'let\'s get started',
    'in conclusion',
    'to sum up',
    'all in all',
  ];
  const foundFiller = [];
  for (const phrase of fillerPhrases) {
    if (contentLower.includes(phrase)) {
      foundFiller.push(phrase);
    }
  }
  if (foundFiller.length > 0) {
    warnings.push(`FILLER: Found generic filler phrases: "${foundFiller.join('", "')}"`);
  }

  // ── Tweet checks ──────────────────────────────────────────────

  // 10. Has tweet thread
  if (!article.tweetThread || !Array.isArray(article.tweetThread) || article.tweetThread.length === 0) {
    issues.push('MISSING: No tweet thread generated');
  } else {
    // Check tweet lengths
    const longTweets = article.tweetThread
      .map((t, i) => ({ index: i + 1, length: t.length }))
      .filter(t => t.length > 280);
    if (longTweets.length > 0) {
      issues.push(`TWEET_LENGTH: Tweets exceed 280 chars: ${longTweets.map(t => `#${t.index} (${t.length})`).join(', ')}`);
    }

    // Check first tweet has article URL placeholder
    if (!article.tweetThread[0].includes('{{ARTICLE_URL}}')) {
      warnings.push('TWEET_URL: First tweet missing {{ARTICLE_URL}} placeholder');
    }

    // Check @claudelists tag in thread
    const threadText = article.tweetThread.join(' ');
    if (!threadText.includes('@claudelists')) {
      issues.push('TWEET_BRAND: Tweet thread does not tag @claudelists');
    }
  }

  // 11. Has promo tweet
  if (!article.promoTweet || article.promoTweet.trim().length === 0) {
    issues.push('MISSING: No promo tweet generated');
  } else {
    if (article.promoTweet.length > 280) {
      issues.push(`PROMO_LENGTH: Promo tweet is ${article.promoTweet.length} chars (max 280)`);
    }
    if (!article.promoTweet.includes('{{ARTICLE_URL}}')) {
      warnings.push('PROMO_URL: Promo tweet missing {{ARTICLE_URL}} placeholder');
    }
    if (!article.promoTweet.includes('@claudelists')) {
      warnings.push('PROMO_BRAND: Promo tweet does not tag @claudelists');
    }
  }

  // ── SEO checks ────────────────────────────────────────────────

  // 12. Meta description
  if (!article.metaDescription || article.metaDescription.trim().length === 0) {
    warnings.push('MISSING: No meta description');
  } else if (article.metaDescription.length > 160) {
    warnings.push(`META_LENGTH: Meta description is ${article.metaDescription.length} chars (max 160)`);
  }

  // 13. OG title
  if (!article.ogTitle || article.ogTitle.trim().length === 0) {
    warnings.push('MISSING: No OG title');
  } else if (article.ogTitle.length > 60) {
    warnings.push(`OG_LENGTH: OG title is ${article.ogTitle.length} chars (max 60)`);
  }

  // ── Resource coverage checks ──────────────────────────────────

  // 14. Each resource URL should appear in the content
  const missingUrls = [];
  for (const r of resources) {
    const url = r.primary_url || r.tweet_url;
    if (url && !content.includes(url)) {
      missingUrls.push(`"${r.title}" (${url})`);
    }
  }
  if (missingUrls.length > 0) {
    warnings.push(`URLS_MISSING: These resource URLs not linked in article: ${missingUrls.join(', ')}`);
  }

  // ── CTA check ─────────────────────────────────────────────────

  // 15. Article should mention tagging @claudelists or submitting
  if (!content.includes('@claudelists') && !contentLower.includes('claudelists.com/submit')) {
    warnings.push('CTA_MISSING: Article does not include CTA to tag @claudelists or submit resources');
  }

  // ── Verdict ───────────────────────────────────────────────────

  return {
    passed: issues.length === 0,
    issues,
    warnings,
    stats: {
      wordCount,
      h2Sections: h2Headings.length,
      tweetCount: article.tweetThread?.length || 0,
      handlesTagged: resources.filter(r => r.author_handle && content.includes(`@${r.author_handle.replace(/^@/, '')}`)).length,
      handlesTotal: resources.filter(r => r.author_handle).length,
    },
  };
}

/**
 * Print validation results to console.
 */
export function printValidation(result) {
  console.log('\n=== Article Quality Check ===');
  console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Words: ${result.stats.wordCount} | Sections: ${result.stats.h2Sections} | Tweets: ${result.stats.tweetCount}`);
  console.log(`Handles: ${result.stats.handlesTagged}/${result.stats.handlesTotal} tagged`);

  if (result.issues.length > 0) {
    console.log('\n❌ ISSUES (must fix):');
    for (const issue of result.issues) {
      console.log(`  - ${issue}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS (review):');
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (result.passed && result.warnings.length === 0) {
    console.log('\nAll checks passed. Article is ready for review.');
  }

  console.log('');
}
