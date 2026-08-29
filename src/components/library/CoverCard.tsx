import { Link } from 'react-router-dom';
import type { Title } from '../../db/types';
import { useCoverUrl } from '../../hooks/useCoverUrl';
import { StatusDot, TierChip } from '../ui/Chip';

/**
 * Kartu cover — design §5-2 & §8.
 * Hover: zoom lembut (scale 1.03) + gradient overlay + tombol ••• Quick Edit.
 * Cover lazy-load (NFR-03); tier chip + dot status selalu tampil (req L26).
 */
export function CoverCard({
  title,
  compact = false,
  selected = false,
  selectionMode = false,
  onQuickEdit,
  onToggleSelect,
}: {
  title: Title;
  compact?: boolean;
  selected?: boolean;
  selectionMode?: boolean;
  onQuickEdit?: (t: Title) => void;
  onToggleSelect?: (t: Title) => void;
}) {
  const url = useCoverUrl(title.coverId);

  const body = (
    <>
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface">
        {url ? (
          <img
            src={url}
            alt={title.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-base group-hover:scale-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center px-2 text-center text-[11px] text-text-muted">
            {title.title || 'Tanpa cover'}
          </div>
        )}

        {/* gradient overlay untuk keterbacaan judul — design §8 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 to-transparent opacity-0 transition-opacity duration-base group-hover:opacity-100" />

        <div className="absolute left-1.5 top-1.5">
          <TierChip tier={title.tier} size={compact ? 'xs' : 'sm'} solid />
        </div>

        <div className="absolute right-1.5 top-1.5 flex items-center gap-1.5">
          {title.favorite && (
            <span aria-label="Favorit" title="Favorit" className="text-sm leading-none text-brand">
              ♥
            </span>
          )}
          <StatusDot status={title.readingStatus} />
        </div>

        {onQuickEdit && !selectionMode && (
          <button
            type="button"
            aria-label={`Quick Edit ${title.title}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickEdit(title);
            }}
            className="absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-lg bg-bg/80 text-text-primary opacity-0 backdrop-blur-sm transition-opacity duration-fast hover:bg-elevated focus-visible:opacity-100 group-hover:opacity-100"
          >
            •••
          </button>
        )}

        {selectionMode && (
          <span
            aria-hidden
            className={`absolute inset-0 rounded-xl ring-2 transition-colors ${
              selected ? 'ring-brand bg-brand/10' : 'ring-transparent'
            }`}
          />
        )}
      </div>

      <div className="mt-1.5 px-0.5">
        <p
          className={`line-clamp-2 font-medium leading-snug tracking-editorial ${
            compact ? 'text-[11px]' : 'text-xs'
          }`}
          title={title.title}
        >
          {title.title}
        </p>
        {!compact && title.yearOriginal && (
          <p className="mt-0.5 text-[10px] text-text-muted">{title.yearOriginal}</p>
        )}
      </div>
    </>
  );

  // Mode seleksi: klik kartu = pilih, bukan navigasi (req FR-18)
  if (selectionMode) {
    return (
      <button
        type="button"
        onClick={() => onToggleSelect?.(title)}
        aria-pressed={selected}
        className="group block w-full text-left active:scale-[0.98] transition-transform duration-fast"
      >
        {body}
      </button>
    );
  }

  return (
    <Link
      to={`/title/${title.id}`}
      className="group block active:scale-[0.98] transition-transform duration-fast"
    >
      {body}
    </Link>
  );
}
