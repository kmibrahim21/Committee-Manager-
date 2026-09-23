const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function run() {
  const sourceImage = path.join(__dirname, '../src/assets/images/app_icon_1790135029983.jpg');
  const publicDir = path.join(__dirname, '../public');

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Create clean vector SVG
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="50%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>
    <filter id="softGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#1E3A8A" flood-opacity="0.15"/>
    </filter>
  </defs>
  
  <!-- Clean white background -->
  <rect width="512" height="512" fill="#FFFFFF" rx="100"/>
  
  <g filter="url(#softGlow)">
    <!-- Central smooth fluid four-lobed geometry -->
    <path d="M 256 120
             C 285 120, 298 150, 305 185
             C 320 195, 345 200, 392 206
             C 420 210, 442 232, 442 256
             C 442 280, 420 302, 392 306
             C 345 312, 320 317, 305 327
             C 298 362, 285 392, 256 392
             C 227 392, 214 362, 207 327
             C 192 317, 167 312, 120 306
             C 92 302, 70 280, 70 256
             C 70 232, 92 210, 120 206
             C 167 200, 192 195, 207 185
             C 214 150, 227 120, 256 120 Z" 
          fill="url(#blueGrad)"/>

    <!-- 4 Circular Nodes -->
    <circle cx="256" cy="120" r="42" fill="url(#blueGrad)"/>
    <circle cx="442" cy="256" r="42" fill="url(#blueGrad)"/>
    <circle cx="256" cy="392" r="42" fill="url(#blueGrad)"/>
    <circle cx="70" cy="256" r="42" fill="url(#blueGrad)"/>

    <!-- Organic Pinwheel Swirl Accents -->
    <path d="M 256 186
             A 70 70 0 0 1 326 256
             C 326 270, 340 280, 360 280
             C 380 280, 395 268, 395 256
             C 395 210, 340 186, 256 186 Z"
          fill="#3B82F6" opacity="0.9"/>
          
    <path d="M 256 326
             A 70 70 0 0 1 186 256
             C 186 242, 172 232, 152 232
             C 132 232, 117 244, 117 256
             C 117 302, 172 326, 256 326 Z"
          fill="#1D4ED8" opacity="0.9"/>

    <!-- White Inner Ring Ring -->
    <circle cx="256" cy="256" r="62" fill="#FFFFFF"/>

    <!-- Dark Navy Inner Center Circle -->
    <circle cx="256" cy="256" r="40" fill="#0F172A"/>
  </g>
</svg>`;

  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);

  // If source image exists, process directly with sharp for maximum fidelity
  let basePipeline;
  if (fs.existsSync(sourceImage)) {
    console.log('Using generated source image:', sourceImage);
    basePipeline = sharp(sourceImage);
  } else {
    console.log('Using SVG vector');
    basePipeline = sharp(Buffer.from(svgContent));
  }

  // 1. 512x512 standard PNG
  await basePipeline.clone()
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'pwa-512x512.png'));

  // 2. 192x192 standard PNG
  await basePipeline.clone()
    .resize(192, 192)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'pwa-192x192.png'));

  // 3. Maskable 512x512 with safe zone padding
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
  .composite([{
    input: await basePipeline.clone().resize(410, 410).toBuffer(),
    gravity: 'center'
  }])
  .png({ quality: 100 })
  .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));

  // 4. Apple Touch Icon 180x180
  await basePipeline.clone()
    .resize(180, 180)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // 5. Favicons
  await basePipeline.clone()
    .resize(64, 64)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'favicon.png'));

  await basePipeline.clone()
    .resize(32, 32)
    .toFile(path.join(publicDir, 'favicon.ico'));

  // 6. Compatibility copies
  fs.copyFileSync(path.join(publicDir, 'pwa-192x192.png'), path.join(publicDir, 'icon-192.png'));
  fs.copyFileSync(path.join(publicDir, 'pwa-512x512.png'), path.join(publicDir, 'icon-512.png'));

  await basePipeline.clone()
    .resize(192, 192)
    .jpeg({ quality: 95 })
    .toFile(path.join(publicDir, 'icon-192.jpg'));

  await basePipeline.clone()
    .resize(512, 512)
    .jpeg({ quality: 95 })
    .toFile(path.join(publicDir, 'icon-512.jpg'));

  console.log('All icons generated successfully!');
}

run().catch(console.error);
