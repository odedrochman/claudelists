import { config } from 'dotenv';
config({ override: true });

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');

const BATCH_SIZE = 10;
const anthropic = new Anthropic();

const CATEGORIES = [
  'MCP Servers',
  'Prompts & Techniques',
  'CLAUDE.md & Config',
  'Workflows & Automation',
  'Skills & Agents',
  'Tools & Libraries',
  'Tutorials & Guides',
  'Projects & Showcases',
  'News & Announcements',
  'Discussion & Opinion',
];

function buildPrompt(bookmarks) {
  const items = bookmarks.map(b => ({
    id: b.id,
    text: (b.text || '').substring(0, 800),
    author: b.author,
    contentType: b._contentType,
    extractedContent: b._extractedContent,
    links: (b._expandedLinks || []).map(l => l.expanded),
    hasMarkdown: !!b._markdownContent,
  }));

  return `You are analyzing Twitter/X bookmarks about Claude, Anthropic, and AI tools for claudelists.com - a curated directory of Claude ecosystem resources.

For each bookmark below, return a JSON object with:
- "id": pass through the bookmark id exactly
- "title": short descriptive title (max 80 chars). For articles/repos use their title. For tweets, create one from content.
- "summary": 1-2 sentence summary useful for discovering Claude resources (max 200 chars)
- "category": exactly one of: ${CATEGORIES.map(c => `"${c}"`).join(', ')}
- "tags": array of 2-5 lowercase hyphenated tags relevant to the Claude ecosystem (e.g. ["claude-code", "mcp-server", "prompt-engineering", "agent-sdk", "claude-md"])
- IMPORTANT: If the tweet asks users to like, retweet, comment, or follow in order to receive something via DM (engagement-gated content), ALWAYS include the tag "engagement-required" in the tags array
- "ai_quality_score": integer 1-10 rating the resource's quality and usefulness to Claude/Anthropic developers:
  1-3: Low value — vague, promotional, no actionable content, just a link with no context
  4-5: Below average — common knowledge, thin content, or low-effort share
  6: Decent — useful but nothing special, standard tip or announcement
  7: Good — specific, actionable, teaches something concrete
  8: Very good — detailed, well-explained, covers a non-obvious topic
  9: Excellent — comprehensive guide, unique insight, or significant tool/project
  10: Exceptional — reference-quality resource that developers will bookmark and share

Category guidelines:
- "MCP Servers": Model Context Protocol servers, MCP integrations, MCP tools
- "Prompts & Techniques": System prompts, prompt engineering, jailbreaks, prompt patterns
- "CLAUDE.md & Config": CLAUDE.md files, project configs, rules files, agent system setups
- "Workflows & Automation": Pipelines, automation using Claude, CI/CD with AI, scheduled tasks
- "Skills & Agents": Claude skills, agent architectures, agent SDK, multi-agent systems
- "Tools & Libraries": SDKs, CLI tools, VS Code extensions, developer tooling for Claude
- "Tutorials & Guides": How-to content, walkthroughs, educational material
- "Projects & Showcases": Things people built with Claude, demos, case studies
- "News & Announcements": Anthropic releases, model updates, industry news
- "Discussion & Opinion": Community takes, debates, comparisons, reviews

Return ONLY a valid JSON array. No markdown fences, no explanation.

Bookmarks:
${JSON.stringify(items, null, 2)}`;
}

async function analyzeBatch(batch, retries = 2) {
  const prompt = buildPrompt(batch);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].text.trim();
      const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      const results = JSON.parse(json);

      if (!Array.isArray(results)) throw new Error('Expected array');
      return results;
    } catch (e) {
      if (attempt < retries) {
        const wait = Math.pow(2, attempt + 1) * 1000;
        console.warn(`  Batch analysis failed (attempt ${attempt + 1}), retrying in ${wait / 1000}s...`);
        await sleep(wait);
      } else {
        console.error(`  Batch analysis failed after ${retries + 1} attempts:`, e.message);
        return batch.map(b => ({
          id: b.id,
          title: (b.text || '').substring(0, 80),
          summary: 'Analysis failed - review manually',
          category: 'Discussion & Opinion',
          tags: [],
          ai_quality_score: 5,
        }));
      }
    }
  }
}

export async function analyzeBookmarks(enrichedBookmarks, options = {}) {
  const dataPath = resolve(DATA_DIR, 'analyzed-bookmarks.json');

  let analyzed = [];
  if (!options.force && existsSync(dataPath)) {
    analyzed = JSON.parse(readFileSync(dataPath, 'utf-8'));
  }
  const analyzedIds = new Set(analyzed.map(b => b.id));

  const remaining = enrichedBookmarks.filter(b => !analyzedIds.has(b.id));

  if (remaining.length === 0) {
    console.log('All bookmarks already analyzed. Use --force to re-analyze.');
    return analyzed;
  }

  console.log(`Analyzing ${remaining.length} bookmarks (${analyzedIds.size} already done)...`);

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(remaining.length / BATCH_SIZE);

    console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} bookmarks)...`);

    const results = await analyzeBatch(batch);

    for (const result of results) {
      const original = enrichedBookmarks.find(b => b.id === result.id);
      if (original) {
        analyzed.push({
          ...original,
          title: result.title,
          summary: result.summary,
          category: result.category,
          tags: result.tags || [],
          ai_quality_score: Math.min(10, Math.max(1, result.ai_quality_score || 5)),
        });
      }
    }

    writeFileSync(dataPath, JSON.stringify(analyzed, null, 2));

    if (i + BATCH_SIZE < remaining.length) {
      await sleep(1500);
    }
  }

  console.log(`Analysis complete: ${analyzed.length} bookmarks`);
  return analyzed;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
