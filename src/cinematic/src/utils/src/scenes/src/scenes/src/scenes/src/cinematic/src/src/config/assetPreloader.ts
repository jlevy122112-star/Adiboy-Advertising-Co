const loaded: Record<string, boolean> = {};

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (loaded[src]) return resolve();
    const img = new Image();
    img.onload = () => {
      loaded[src] = true;
      resolve();
    };
    img.onerror = reject;
    img.src = src;
  });
}

function preloadJson(src: string): Promise<void> {
  if (loaded[src]) return Promise.resolve();
  return fetch(src)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${src}`);
      return res.json();
    })
    .then(() => {
      loaded[src] = true;
    });
}

export async function preloadAssets() {
  const lottieFiles = [
    "/assets/lottie/vault_door_open.json",
    "/assets/lottie/scanner_idle.json",
    "/assets/lottie/scanner_success.json",
    "/assets/lottie/fog_idle.json",
  ];

  const images = [
    "/assets/img/vault_bg.png",
    "/assets/img/vault_panel.png",
  ];

  await Promise.all([
    ...lottieFiles.map(preloadJson),
    ...images.map(preloadImage),
  ]);

  console.log("[ASSETS] Preload complete");
}
