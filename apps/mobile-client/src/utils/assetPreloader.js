/**
 * assetPreloader.js
 * DEV TICKET #2 — Asset Preloader
 *
 * Supports: PNG/WebP, SVG, Lottie JSON, MP4 (optional).
 * Preloads all 12 cinematic assets defined in the build document.
 */

const cache = {};

// Full asset list from the build document
const CINEMATIC_ASSETS = [
  { name: 'vaultDoor',        src: '/assets/images/vault_door.webp',        type: 'image' },
  { name: 'biometricScanner', src: '/assets/images/biometric_scanner.webp', type: 'image' },
  { name: 'switches',         src: '/assets/images/switches.webp',          type: 'image' },
  { name: 'lever',            src: '/assets/images/lever.webp',             type: 'image' },
  { name: 'reactorCore',      src: '/assets/images/reactor_core.webp',      type: 'image' },
  { name: 'fogBurst',         src: '/assets/lottie/fog_burst.json',         type: 'lottie' },
  { name: 'spotlight',        src: '/assets/images/spotlight.webp',         type: 'image' },
  { name: 'metalTable',       src: '/assets/images/metal_table.webp',       type: 'image' },
  { name: 'briefcase',        src: '/assets/images/briefcase.webp',         type: 'image' },
  { name: 'stampDeclas',      src: '/assets/lottie/stamp_declas.json',      type: 'lottie' },
  { name: 'artifactCard',     src: '/assets/images/artifact_card.webp',     type: 'image' },
  { name: 'backgroundFog',    src: '/assets/images/background_fog.webp',    type: 'image' },
];

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Non-fatal: resolve anyway so engine is not blocked
      console.warn(`[ASSET_PRELOADER] Image failed to load: ${src}`);
      resolve(null);
    };
    img.src = src;
  });
}

async function loadLottie(src) {
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json;
  } catch (err) {
    console.warn(`[ASSET_PRELOADER] Lottie failed to load: ${src}`, err);
    return null;
  }
}

/**
 * Preload all cinematic assets.
 * Returns a map of { name: loadedAsset }.
 * Non-fatal: missing assets log a warning but do not block the engine.
 */
export async function preloadCinematicAssets() {
  const results = await Promise.all(
    CINEMATIC_ASSETS.map(async (asset) => {
      if (cache[asset.name]) return { name: asset.name, data: cache[asset.name] };

      let data = null;
      if (asset.type === 'image') {
        data = await loadImage(asset.src);
      } else if (asset.type === 'lottie') {
        data = await loadLottie(asset.src);
      }

      cache[asset.name] = data;
      console.log(`[ASSET_PRELOADER] Loaded: ${asset.name}`);
      return { name: asset.name, data };
    })
  );

  const assetMap = {};
  results.forEach(({ name, data }) => {
    assetMap[name] = data;
  });

  return assetMap;
}

/**
 * Get a previously loaded asset by name.
 */
export function getAsset(name) {
  return cache[name] || null;
}
