// ═══════════════════════════════════════════════════════════
// SETU — <BannerCard>
//
// Single source of truth for rendering a banner's *content* — used
// by both AdminBanners.jsx's live preview and CustomerHome.jsx's real
// carousel, so a preview can never drift from what customers actually
// see. Deliberately has no navigation of its own (no <Link> wrapper):
// the caller decides whether/how a banner is tappable.
//
// banner shape (matches the `banners` table):
//   title, subtitle, badge_text, cta_text,
//   bg_type: 'solid' | 'gradient' | 'image'
//   bg_color, gradient_to, image_url, overlay_opacity (0-100),
//   layout: 'text-only' | 'image-left' | 'image-right' | 'image-dominant'
//   foreground_image_url
// ═══════════════════════════════════════════════════════════
import React from 'react';
import Img from './Img';

function backgroundStyle(banner) {
  const color = banner.bg_color || '#F97316';
  if (banner.bg_type === 'gradient') {
    return { background: `linear-gradient(135deg, ${color}, ${banner.gradient_to || color})` };
  }
  if (banner.bg_type === 'image' && banner.image_url) {
    // The <img> below (not a CSS background-image) is what actually
    // loads/lazy-loads/falls back through the shared Img component —
    // this style is just the color that shows while it loads or if it
    // fails, so the banner never flashes transparent/white.
    return { backgroundColor: color };
  }
  return { backgroundColor: color };
}

export default function BannerCard({ banner, className = '', imageEager = false }) {
  if (!banner) return null;
  const {
    title, subtitle, badge_text: badge, cta_text: cta,
    bg_type: bgType = 'solid', image_url: imageUrl,
    overlay_opacity: overlay = 0,
    layout = 'text-only', foreground_image_url: fgImage,
  } = banner;

  const hasBgImage = bgType === 'image' && !!imageUrl;
  const isSplit    = (layout === 'image-left' || layout === 'image-right') && !!fgImage;
  const isDominant = layout === 'image-dominant' && (fgImage || imageUrl);

  const TextBlock = (
    <div className="relative z-10 min-w-0">
      {badge && (
        <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80 truncate">
          {badge}
        </p>
      )}
      <h2 className="text-lg font-bold mt-0.5 leading-tight line-clamp-2">{title}</h2>
      {subtitle && (
        <p className="text-xs opacity-90 mt-1 line-clamp-2">{subtitle}</p>
      )}
      {cta && (
        <span className="inline-block mt-3 bg-white/20 text-white text-xs font-medium px-4 py-1.5 rounded-lg backdrop-blur-sm">
          {cta} →
        </span>
      )}
    </div>
  );

  return (
    <div
      className={`relative overflow-hidden rounded-2xl text-white ${className}`}
      style={backgroundStyle(banner)}
    >
      {/* Full-bleed background image */}
      {hasBgImage && (
        <Img
          src={imageUrl}
          alt=""
          width={480}
          className="absolute inset-0 w-full h-full object-cover"
          fallback={<span />}
          {...(imageEager ? { loading: 'eager' } : {})}
        />
      )}
      {hasBgImage && overlay > 0 && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${Math.min(overlay, 100) / 100})` }}
          aria-hidden="true"
        />
      )}

      {/* image-dominant: text as a bottom scrim over the image.
          pr-16/pb-8 (vs. the other layouts' plain p-5) reserve room
          in the bottom-right corner so the carousel's indicator dots
          — added by the caller, positioned bottom-right over this
          same card — never sit on top of the CTA button or text. */}
      {isDominant ? (
        <div className="relative flex flex-col justify-end h-full pt-16 pl-5 pr-16 pb-8">
          {(fgImage || imageUrl) && !hasBgImage && (
            <Img
              src={fgImage || imageUrl}
              alt=""
              width={480}
              className="absolute inset-0 w-full h-full object-cover"
              fallback={<span />}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" aria-hidden="true" />
          {TextBlock}
        </div>
      ) : isSplit ? (
        <div className={`flex items-center h-full p-5 gap-3 ${layout === 'image-left' ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="flex-1 min-w-0">{TextBlock}</div>
          <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-white/10">
            <Img src={fgImage} alt="" width={80} height={80} className="w-full h-full object-cover" fallback={<span />} />
          </div>
        </div>
      ) : (
        <div className="p-5">{TextBlock}</div>
      )}
    </div>
  );
}
