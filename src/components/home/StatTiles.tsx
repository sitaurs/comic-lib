import { useNavigate } from 'react-router-dom';
import { useFilterStore } from '../../stores/filterStore';

/**
 * Stat tile Bento — design §5-1, req FR-23 (L94–L95).
 * Empat tile: Total · Favorites · jumlah SS · Belum Baca. Angka besar editorial,
 * label tenang. Klik tile → Library dengan filter yang sesuai (filterStore).
 */
export function StatTiles({
  total,
  favorites,
  ss,
  unread,
}: {
  total: number;
  favorites: number;
  ss: number;
  unread: number;
}) {
  const navigate = useNavigate();
  const clear = useFilterStore((s) => s.clear);
  const setFavoriteOnly = useFilterStore((s) => s.setFavoriteOnly);
  const toggleTier = useFilterStore((s) => s.toggleTier);
  const toggleReadingStatus = useFilterStore((s) => s.toggleReadingStatus);

  // apply dijalankan setelah clear() supaya filter lama tidak menumpuk
  const tiles: {
    key: string;
    label: string;
    value: number;
    valueClass: string;
    dotClass?: string;
    apply: () => void;
  }[] = [
    {
      key: 'total',
      label: 'Total judul',
      value: total,
      valueClass: 'text-text-primary',
      apply: () => {},
    },
    {
      key: 'favorites',
      label: 'Favorites',
      value: favorites,
      valueClass: 'text-brand',
      apply: () => setFavoriteOnly(true),
    },
    {
      key: 'ss',
      label: 'Tier SS',
      value: ss,
      valueClass: 'text-tier-ss',
      apply: () => toggleTier('SS'),
    },
    {
      key: 'unread',
      label: 'Belum Baca',
      value: unread,
      valueClass: 'text-text-secondary',
      dotClass: 'bg-status-unread',
      apply: () => toggleReadingStatus('belum_baca'),
    },
  ];

  function go(apply: () => void) {
    clear();
    apply();
    navigate('/library');
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((tile) => (
        <button
          key={tile.key}
          type="button"
          onClick={() => go(tile.apply)}
          aria-label={`${tile.label}: ${tile.value} judul — buka di Library`}
          className="rounded-2xl border border-hairline bg-surface/50 p-4 text-left transition-colors duration-fast hover:border-brand/40 hover:bg-elevated/60"
        >
          <p
            className={`font-display text-3xl font-bold tabular-nums tracking-editorial md:text-4xl ${tile.valueClass}`}
          >
            {tile.value}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
            {tile.dotClass && (
              <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${tile.dotClass}`} />
            )}
            {tile.label}
          </p>
        </button>
      ))}
    </div>
  );
}
