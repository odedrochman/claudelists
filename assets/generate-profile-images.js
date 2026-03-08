import sharp from 'sharp';

// ── Profile Image (400x400) ──────────────────────────────────
const profileSvg = `
<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="400" fill="#C15F3C"/>
  <text x="200" y="235" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-weight="800" font-size="160" fill="#FAF9F5" letter-spacing="-5">CL</text>
</svg>`;

await sharp(Buffer.from(profileSvg))
  .png()
  .toFile('assets/profile-400x400.png');
console.log('Created: assets/profile-400x400.png (400x400)');

// ── Banner Image (1500x500) ──────────────────────────────────
const bannerSvg = `
<svg width="1500" height="500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="blob1" cx="85%" cy="15%" r="25%">
      <stop offset="0%" stop-color="#C15F3C" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#C15F3C" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blob2" cx="10%" cy="90%" r="22%">
      <stop offset="0%" stop-color="#D97757" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#D97757" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blob3" cx="40%" cy="30%" r="15%">
      <stop offset="0%" stop-color="#C15F3C" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#C15F3C" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="stripe" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#C15F3C"/>
      <stop offset="50%" stop-color="#D97757"/>
      <stop offset="100%" stop-color="#E8926E"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1500" height="500" fill="#1A1008"/>

  <!-- Blobs -->
  <rect width="1500" height="500" fill="url(#blob1)"/>
  <rect width="1500" height="500" fill="url(#blob2)"/>
  <rect width="1500" height="500" fill="url(#blob3)"/>

  <!-- Top stripe -->
  <rect x="0" y="0" width="1500" height="4" fill="url(#stripe)"/>

  <!-- Dots -->
  <circle cx="1250" cy="90" r="4" fill="#C15F3C" opacity="0.5"/>
  <circle cx="1150" cy="160" r="3" fill="#D97757" opacity="0.35"/>
  <circle cx="1320" cy="380" r="5" fill="#C15F3C" opacity="0.25"/>
  <circle cx="180" cy="110" r="3.5" fill="#E8926E" opacity="0.3"/>
  <circle cx="350" cy="400" r="4.5" fill="#C15F3C" opacity="0.2"/>

  <!-- Logo box -->
  <rect x="440" y="145" width="72" height="72" rx="18" fill="#C15F3C"/>
  <text x="476" y="195" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-weight="800" font-size="32" fill="#FAF9F5">CL</text>

  <!-- Brand name -->
  <text x="540" y="195" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-weight="700" font-size="52" letter-spacing="-1">
    <tspan fill="#D97757">Claude</tspan><tspan fill="#FAF9F5">Lists</tspan>
  </text>

  <!-- Tagline -->
  <text x="443" y="252" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-weight="400" font-size="21" fill="#B8A99A">Community-curated Claude ecosystem resources</text>

  <!-- Category pills -->
  <rect x="443" y="282" width="112" height="32" rx="16" fill="none" stroke="rgba(193,95,60,0.3)" stroke-width="1.5"/>
  <text x="499" y="303" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="13" fill="#B8A99A">MCP Servers</text>

  <rect x="567" y="282" width="85" height="32" rx="16" fill="none" stroke="rgba(193,95,60,0.3)" stroke-width="1.5"/>
  <text x="610" y="303" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="13" fill="#B8A99A">Prompts</text>

  <rect x="664" y="282" width="100" height="32" rx="16" fill="none" stroke="rgba(193,95,60,0.3)" stroke-width="1.5"/>
  <text x="714" y="303" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="13" fill="#B8A99A">CLAUDE.md</text>

  <rect x="776" y="282" width="100" height="32" rx="16" fill="none" stroke="rgba(193,95,60,0.3)" stroke-width="1.5"/>
  <text x="826" y="303" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="13" fill="#B8A99A">Workflows</text>

  <rect x="888" y="282" width="72" height="32" rx="16" fill="none" stroke="rgba(193,95,60,0.3)" stroke-width="1.5"/>
  <text x="924" y="303" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="13" fill="#B8A99A">Tools</text>

  <!-- URL bottom right -->
  <text x="1050" y="470" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="16" fill="#8C7B6B" font-weight="500">claudelists.com</text>
</svg>`;

await sharp(Buffer.from(bannerSvg))
  .png()
  .toFile('assets/banner-1500x500.png');
console.log('Created: assets/banner-1500x500.png (1500x500)');
