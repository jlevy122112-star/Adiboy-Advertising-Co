export function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid payload" };

  const { brand, audience, tone, platform } = payload;

  if (!brand || typeof brand !== "string" || brand.length > 200)
    return { ok: false, error: "Invalid brand" };

  if (!audience || typeof audience !== "string" || audience.length > 200)
    return { ok: false, error: "Invalid audience" };

  if (!tone || typeof tone !== "string" || tone.length > 100)
    return { ok: false, error: "Invalid tone" };

  if (!Array.isArray(platform) || platform.length === 0)
    return { ok: false, error: "Invalid platform" };

  return { ok: true };
}
