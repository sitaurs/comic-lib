import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Title } from '../../db/types';
import { CoverCard } from './CoverCard';

/**
 * Grid cover — design §5-2 (mode Grid & Compact).
 * NFR-03: windowing sederhana (render bertahap saat scroll) agar 500+ judul
 * tetap responsif tanpa menambah dependensi virtualisasi.
 */
const PAGE = 60;

export function CoverGrid({
  titles,
  compact = false,
  selection,
  selectionMode = false,
  onQuickEdit,
  onToggleSelect,
  empty,
}: {
  titles: Title[];
  compact?: boolean;
  selection?: Set<string>;
  selectionMode?: boolean;
  onQuickEdit?: (t: Title) => void;
  onToggleSelect?: (t: Title) => void;
  empty?: ReactNode;
}) {
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement | null>(null);

  // reset saat daftar berubah (filter/sort)
  useEffect(() => setLimit(PAGE), [titles]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLimit((l) => Math.min(l + PAGE, titles.length));
        }
      },
      { rootMargin: '600px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [titles.length]);

  if (titles.length === 0) return <>{empty}</>;

  const cols = compact
    ? 'grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12'
    : 'grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8';

  return (
    <>
      <div className={`grid ${cols}`}>
        {titles.slice(0, limit).map((t) => (
          <CoverCard
            key={t.id}
            title={t}
            compact={compact}
            selected={selection?.has(t.id) ?? false}
            selectionMode={selectionMode}
            onQuickEdit={onQuickEdit}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
      {limit < titles.length && <div ref={sentinel} className="h-10" aria-hidden />}
    </>
  );
}
