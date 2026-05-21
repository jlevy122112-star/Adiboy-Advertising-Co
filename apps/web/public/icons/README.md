# App Icons

Required before store submission. All icons must be generated from the master 1024×1024 source.

| File | Size | Used by |
|------|------|---------|
| `icon-192.png` | 192×192 | PWA manifest, Android |
| `icon-512.png` | 512×512 | PWA manifest, Android |
| `icon-1024.png` | 1024×1024 | Apple App Store (no rounded corners — Apple applies masking) |

## Generation

Use the master SVG at `/favicon.svg` as the source. Export at each size with:
- No transparency on the 1024 version (Apple requires opaque background)
- `maskable` intent: keep logo centered in the safe zone (inner 80% of canvas)

Recommended tool: https://maskable.app for previewing maskable icons.
