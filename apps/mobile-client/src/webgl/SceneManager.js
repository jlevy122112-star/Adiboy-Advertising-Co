
/**
 * SceneManager.js
 * DEV TICKET #2 — WebGL Bootstrap (Three.js)
 *
 * Supports multiple scenes: vault, reactor, presentation
 * Exposes: loadScene(name), playAnimation(name), setLighting(config)
 * Handles: resizing + cleanup
 */

let THREE = null;
let renderer = null;
let camera = null;
let activeScene = null;
let animationFrameId = null;
let scenes = {};

/**
 * Initialize the Three.js renderer and camera.
 * Must be called with a canvas container element.
 */
export async function initRenderer(container) {
  if (!THREE) {
    THREE = await import('three');
  }

  if (renderer) {
    destroyRenderer();
  }

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 1);

  container.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 5);

  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    if (!renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(container);

  // Store cleanup ref
  renderer._resizeObserver = resizeObserver;

  startRenderLoop();
}

function startRenderLoop() {
  function loop() {
    animationFrameId = requestAnimationFrame(loop);
    if (renderer && activeScene && camera) {
      renderer.render(activeScene, camera);
    }
  }
  loop();
}

/**
 * Load a named scene (vault | reactor | presentation).
 * Creates a basic Three.js Scene with scene-specific elements.
 */
export function loadScene(name) {
  if (!THREE) {
    console.warn('[SceneManager] THREE not initialized. Call initRenderer first.');
    return;
  }

  if (scenes[name]) {
    activeScene = scenes[name];
    return;
  }

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.05);

  // Scene-specific setup
  switch (name) {
    case 'vault':
      _buildVaultScene(scene);
      break;
    case 'reactor':
      _buildReactorScene(scene);
      break;
    case 'presentation':
      _buildPresentationScene(scene);
      break;
    default:
      console.warn(`[SceneManager] Unknown scene: ${name}`);
  }

  scenes[name] = scene;
  activeScene = scene;
  console.log(`[SceneManager] Scene loaded: ${name}`);
}

// ── Scene builders ───────────────────────────────────────────────────────────

function _buildVaultScene(scene) {
  // Cold blue ambient light
  const ambient = new THREE.AmbientLight(0x0a1628, 0.4);
  scene.add(ambient);

  // Directional — simulates cold backlight
  const backlight = new THREE.DirectionalLight(0x00aeef, 0.6);
  backlight.position.set(0, 2, -3);
  scene.add(backlight);

  // Fog plane placeholder (replaced by Lottie fog overlay in UI)
  scene.userData.name = 'vault';
}

function _buildReactorScene(scene) {
  // Dark ambient
  const ambient = new THREE.AmbientLight(0x050510, 0.3);
  scene.add(ambient);

  // Reactor core glow — reactor blue point light
  const reactorLight = new THREE.PointLight(0x00aeef, 1.5, 6);
  reactorLight.position.set(0, 0, 0);
  scene.add(reactorLight);
  scene.userData.reactorLight = reactorLight;

  scene.userData.name = 'reactor';
}

function _buildPresentationScene(scene) {
  // Pure black scene
  // Single spotlight on table
  const spotlight = new THREE.SpotLight(0xffffff, 2, 10, Math.PI / 6, 0.5, 1);
  spotlight.position.set(0, 5, 0);
  spotlight.target.position.set(0, 0, 0);
  scene.add(spotlight);
  scene.add(spotlight.target);
  scene.userData.spotlight = spotlight;
  scene.userData.name = 'presentation';
}

/**
 * Play a named animation within the active scene.
 */
export function playAnimation(name) {
  if (!activeScene) return;
  // Scene-specific animation triggers
  switch (name) {
    case 'reactorPulse':
      _pulseReactorLight();
      break;
    case 'spotlightActivate':
      _activateSpotlight();
      break;
    default:
      console.warn(`[SceneManager] No WebGL animation defined for: ${name}`);
  }
}

function _pulseReactorLight() {
  if (!activeScene?.userData?.reactorLight) return;
  const light = activeScene.userData.reactorLight;
  let t = 0;
  const pulse = () => {
    t += 0.05;
    light.intensity = 1.5 + Math.sin(t) * 0.8;
    if (t < Math.PI * 2) requestAnimationFrame(pulse);
    else light.intensity = 1.5;
  };
  pulse();
}

function _activateSpotlight() {
  if (!activeScene?.userData?.spotlight) return;
  const spotlight = activeScene.userData.spotlight;
  spotlight.intensity = 0;
  let t = 0;
  const fadeIn = () => {
    t += 0.08;
    spotlight.intensity = Math.min(t, 2);
    if (t < 2) requestAnimationFrame(fadeIn);
  };
  fadeIn();
}

/**
 * Set lighting configuration on the active scene.
 */
export function setLighting(config = {}) {
  if (!activeScene) return;
  if (config.ambientIntensity != null) {
    activeScene.children
      .filter((c) => c.isAmbientLight)
      .forEach((l) => { l.intensity = config.ambientIntensity; });
  }
}

/**
 * Destroy renderer and clean up.
 */
export function destroyRenderer() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (renderer) {
    renderer._resizeObserver?.disconnect();
    renderer.dispose();
    renderer.domElement?.parentNode?.removeChild(renderer.domElement);
    renderer = null;
  }
  camera = null;
  activeScene = null;
  scenes = {};
  animationFrameId = null;
}
