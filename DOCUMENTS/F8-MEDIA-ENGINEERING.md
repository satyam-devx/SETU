# F8 — Media Engineering

## Objective
Reduce image and asset bytes without sacrificing required visual quality, while keeping GitHub Pages, custom domains and Capacitor paths correct.

## Implemented
- Central `src/lib/media.js` for image transformation and asset URL handling.
- Optional `VITE_IMAGE_CDN_URL` strategy with width/quality/format parameters.
- Supabase Storage render endpoint support for responsive transformations.
- AVIF/WebP source negotiation with browser fallback.
- Responsive `srcset` generation at device-appropriate widths.
- Shared `Img` component now emits `<picture>`, modern formats, `srcset`, `sizes`, lazy loading and explicit dimensions.
- Preserved original URL fallback when transformation fails.
- Customer/vendor/admin/anchor remote image consumers migrated where the change is low-risk.
- Splash background/logo/signature now ship AVIF/WebP fallbacks with original JPEG/PNG fallback.
- Base-path-safe `assetUrl()` for GitHub Pages `/SETU/` and custom-domain deployments.
- Splash assets use the Vite base path rather than root-relative URLs.
- Added long-lived cache headers for release media on hosts that honor `_headers`.
- Preserved original PNG assets needed by native/icon tooling.

## Asset results
Generated modern variants:
- splash background: JPG 588K → WebP 44K / AVIF 44K
- splash logo: PNG 500K → WebP 124K / AVIF 72K
- signature: PNG 16K → WebP 8K / AVIF 8K

The native PNG sources remain available; web delivery can negotiate the smaller modern formats.

## Asset-path audit
- `SplashScreen` no longer assumes `/splash-*.png|jpg` at the domain root.
- Auth/role icon references use the shared base-path helper.
- Vite `base` remains environment-aware: `VITE_BASE_PATH`, production `/SETU/`, development `/`.
- GitHub Pages cannot honor `_headers`; CDN/cache headers therefore remain host-dependent.

## Verification
- JavaScript syntax check should be run after this phase.
- Runtime build remains subject to dependency availability (`node_modules` was previously absent in the audit environment).
- External image hosts that do not expose a transform API continue to receive lazy loading, responsive markup where possible, and explicit dimensions; the optional image CDN is the path for universal transformation.
