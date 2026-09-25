import React, { useMemo, useState } from 'react';

/**
 * Lightweight fixed-row virtualizer for long mobile lists.
 * Keeps only the visible window + overscan mounted. Use for lists with
 * stable row heights; paginated/short lists should remain ordinary maps.
 */
export default function VirtualizedList({
  items = [],
  itemHeight = 120,
  height = '65vh',
  overscan = 5,
  renderItem,
  getKey = (_, index) => index,
  className = '',
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const range = useMemo(() => {
    const viewport = typeof height === 'number' ? height : 600;
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visible = Math.ceil(viewport / itemHeight) + overscan * 2;
    const end = Math.min(items.length, start + visible);
    return { start, end };
  }, [items.length, itemHeight, height, overscan, scrollTop]);

  if (items.length === 0) return null;

  return (
    <div
      className={`overflow-y-auto overscroll-contain ${className}`}
      style={{ height }}
      onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
      role="list"
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {items.slice(range.start, range.end).map((item, offset) => {
          const index = range.start + offset;
          return (
            <div
              key={getKey(item, index)}
              role="listitem"
              style={{
                position: 'absolute',
                top: index * itemHeight,
                left: 0,
                right: 0,
                height: itemHeight,
              }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
