// ═══════════════════════════════════════════════════════════
// SETU — useInView
// Minimal IntersectionObserver hook. Used to defer network
// requests (e.g. per-category product shelves on the Categories
// page) until the section is actually about to scroll into view,
// instead of firing every request up front — important on the
// 2G/low-end-Android connections this app targets.
// ═══════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';

/**
 * @param {Object} opts
 * @param {string}  opts.rootMargin  - grow the trigger area so content is
 *                                     ready slightly before it's visible
 * @param {boolean} opts.triggerOnce - stop observing after first entry
 * @returns {[React.RefObject, boolean]} [ref to attach, isInView]
 */
export function useInView({ rootMargin = '300px 0px', triggerOnce = true } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || (triggerOnce && inView)) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      // Very old WebView fallback — just load it.
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (triggerOnce) observer.disconnect();
        } else if (!triggerOnce) {
          setInView(false);
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, triggerOnce, inView]);

  return [ref, inView];
}
