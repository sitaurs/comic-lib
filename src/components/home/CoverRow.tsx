import { Link } from 'react-router-dom';
import type { Title } from '../../db/types';
import { SectionHeader } from '../layout/PageHeader';
import { CoverCard } from '../library/CoverCard';

/**
 * Baris cover scroll horizontal — design §5-1, req FR-23.
 * Header + link "View all" ke Library (memasang filter lewat onViewAll).
 * Baris kosong disembunyikan supaya Home tetap tenang.
 */
export function CoverRow({
  heading,
  titles,
  onViewAll,
  limit = 18,
}: {
  heading: string;
  titles: Title[];
  onViewAll?: () => void;
  limit?: number;
}) {
  if (titles.length === 0) return null;

  return (
    <section>
      <SectionHeader
        title={heading}
        aside={
          <Link
            to="/library"
            onClick={onViewAll}
            className="shrink-0 text-xs text-text-muted transition-colors hover:text-brand"
          >
            View all →
          </Link>
        }
      />
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {titles.slice(0, limit).map((t) => (
          <div key={t.id} className="w-[104px] shrink-0 md:w-[120px]">
            <CoverCard title={t} compact />
          </div>
        ))}
      </div>
    </section>
  );
}
