import { createServiceClient } from './supabase';

// Category-specific prompt themes
const CATEGORY_PROMPTS = {
  'mcp-servers': 'Abstract digital network with connected nodes, circuit-like patterns, flowing data streams between geometric shapes',
  'prompts': 'Flowing conversation-like abstract patterns, speech bubble shapes dissolving into particles, layered translucent waves',
  'claude-config': 'Geometric code blocks, structured grid patterns, neat aligned rectangles with subtle glow effects',
  'workflows': 'Flowing pipeline streams, smooth connected pathways, abstract assembly line with glowing junction points',
  'skills-agents': 'Abstract robotic neural patterns, interconnected brain-like nodes, digital synapses with energy pulses',
  'tools': 'Mechanical abstract shapes, interlocking gears and components, precision engineering patterns',
  'tutorials': 'Abstract stepping stones path, gradient progression from simple to complex shapes, learning journey visualization',
  'showcases': 'Rocket launch energy trails, upward momentum abstract, dynamic particle burst patterns',
  'news': 'Dynamic breaking wave patterns, sharp geometric shards, bold intersecting planes with energy',
  'discussion': 'Overlapping translucent circles, thought cloud formations, layered abstract conversation shapes',
};

const ARTICLE_TYPE_PROMPTS = {
  daily: 'Warm sunrise energy, dynamic brushstrokes, golden amber flowing forms, morning light rays',
  weekly: 'Cool panoramic expansive horizon, layered mountain silhouettes, deep blue and purple gradient forms',
  monthly: 'Grand cosmic galaxy abstract, sweeping stellar clouds, deep space nebula with scattered light points',
  quick: 'Sharp lightning spark burst, focused electric energy, bright concentrated flash patterns',
};

/**
 * Generate abstract background image via Gemini
 */
async function callGeminiImageGen(prompt, accentColor) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp-image-generation' });

  const fullPrompt = `Generate an abstract artistic background image suitable as an OG social media card background (1200x630 pixels, landscape orientation).

Style: ${prompt}

FOCAL ELEMENT: Include a stylized Claude AI sparkle/asterisk shape (a 6 or 8-pointed star with rounded teardrop petals radiating from a glowing center). Position this sparkle in the CENTER-LEFT area of the image (roughly 25-35% from left, vertically centered). The sparkle should be the main focal point, rendered in ${accentColor} with a soft glow emanating from it. Make it large and prominent (roughly 30-40% of the image height).

Color palette: Use ${accentColor} as the primary accent color. Dark background tones (near black, deep charcoal). The accent color should appear in the sparkle focal point and as subtle secondary highlights, streaks, or ambient glow.

CRITICAL requirements:
- NO text, NO words, NO letters, NO numbers anywhere in the image
- NO faces, NO people, NO recognizable brand logos
- The sparkle/asterisk is the ONLY representational element, everything else is abstract
- Dark overall tone (the image will have white text overlaid on top)
- The RIGHT 30% of the image should be especially dark and minimal (UI elements will overlay there)
- High contrast between dark areas and accent color highlights
- Slight vignette or darker edges for text readability
- Modern, sleek, tech-inspired aesthetic`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: {
      responseModalities: ['image', 'text'],
    },
  });

  const response = result.response;
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }

  throw new Error('No image returned from Gemini');
}

/**
 * Resize image to 1200x630 and apply dark overlay for text readability
 */
async function processBackground(imageBuffer) {
  const sharp = (await import('sharp')).default;

  // Resize to OG dimensions with cover crop
  const resized = await sharp(imageBuffer)
    .resize(1200, 630, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer();

  // Apply dark overlay (darken ~35%) for text readability
  const darkOverlay = Buffer.from(
    `<svg width="1200" height="630">
      <rect width="1200" height="630" fill="black" opacity="0.35"/>
    </svg>`
  );

  const final = await sharp(resized)
    .composite([{ input: darkOverlay, blend: 'over' }])
    .png({ quality: 85 })
    .toBuffer();

  return final;
}

/**
 * Upload image to Supabase Storage
 */
async function uploadToStorage(supabase, path, imageBuffer) {
  const { data, error } = await supabase.storage
    .from('og-backgrounds')
    .upload(path, imageBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from('og-backgrounds')
    .getPublicUrl(path);

  return urlData.publicUrl;
}

/**
 * Generate backgrounds for a category pool
 * @param {string} categorySlug - Category slug from categories.js
 * @param {string} accentColor - Hex color for the category
 * @param {number} count - Number of backgrounds to generate (default 4)
 * @returns {string[]} Array of public URLs
 */
export async function generateCategoryBackgrounds(categorySlug, accentColor, count = 4) {
  const supabase = createServiceClient();
  const prompt = CATEGORY_PROMPTS[categorySlug] || CATEGORY_PROMPTS['discussion'];
  const urls = [];

  for (let i = 0; i < count; i++) {
    const rawImage = await callGeminiImageGen(prompt, accentColor);
    const processed = await processBackground(rawImage);
    const path = `categories/${categorySlug}/${Date.now()}-${i}.png`;
    const url = await uploadToStorage(supabase, path, processed);

    // Save to pool table
    await supabase.from('og_background_pools').insert({
      category_slug: categorySlug,
      image_url: url,
    });

    urls.push(url);
  }

  return urls;
}

/**
 * Generate a unique background for an article
 * @param {string} articleType - daily, weekly, monthly, quick
 * @param {string} title - Article title for context
 * @param {string} articleId - Article UUID for storage path
 * @returns {string} Public URL of the generated background
 */
export async function generateArticleBackground(articleType, title, articleId) {
  const supabase = createServiceClient();
  const typePrompt = ARTICLE_TYPE_PROMPTS[articleType] || ARTICLE_TYPE_PROMPTS.daily;

  // Extract a few keywords from title for variation
  const keywords = title
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 3)
    .join(', ');

  const prompt = `${typePrompt}. Subtle thematic hints of: ${keywords}`;

  // Use article type accent colors
  const accentColors = {
    daily: '#E8926E',
    weekly: '#A78BFA',
    monthly: '#34D399',
    quick: '#F97316',
  };

  const rawImage = await callGeminiImageGen(prompt, accentColors[articleType] || '#E8926E');
  const processed = await processBackground(rawImage);
  const path = `articles/${articleId}.png`;
  const url = await uploadToStorage(supabase, path, processed);

  // Save URL to article
  await supabase
    .from('articles')
    .update({ og_background_url: url })
    .eq('id', articleId);

  return url;
}

/**
 * Assign a random background from the category pool to a resource
 * @param {string} categorySlug - Category slug
 * @param {string} resourceId - Resource UUID
 * @returns {string|null} URL of assigned background, or null if no pool exists
 */
export async function assignResourceBackground(categorySlug, resourceId) {
  const supabase = createServiceClient();

  // Get random background from pool
  const { data: pools } = await supabase
    .from('og_background_pools')
    .select('image_url')
    .eq('category_slug', categorySlug);

  if (!pools || pools.length === 0) return null;

  const randomUrl = pools[Math.floor(Math.random() * pools.length)].image_url;

  // Save to resource
  await supabase
    .from('resources')
    .update({ og_background_url: randomUrl })
    .eq('id', resourceId);

  return randomUrl;
}
