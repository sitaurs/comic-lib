import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { TIER_ORDER } from '../design/tokens';
import { useCoverUrl } from '../hooks/useCoverUrl';
import {
  useTitle,
  useTitleBadges,
  useTitleCollections,
} from '../hooks/useLibraryData';
import { readLinkLabel } from '../lib/readLinks';
import { useFilterStore } from '../stores/filterStore';
import { useLibraryStore } from '../stores/libraryStore';
import { useUIStore } from '../stores/uiStore';
import { Button, IconButton } from '../components/ui/Button';
import { Chip, ReadingStatusPill, TierChip } from '../components/ui/Chip';
import { EmptyState } from '../components/layout/PageHeader';
import { WORK_STATUS_LABELS } from '../components/library/TitleForm';
import { EditTitleDialog } from '../components/library/EditTitleDialog';

/**
 * Detail page — req FR-20, design §5-4.
 * Cover besar di kiri; kanan: judul (+ judul Korea), tier/♥/status/work status,
 * Read ↗ per sumber (disembunyikan bila kosong) & Edit.
 * Tab: Description · Collections · Badges · Metadata (tanpa Reading Progress/History).
 */
const TABS = ['Description', 'Collections', 'Badges', 'Metadata'] as const;
type Tab = (typeof TABS)[number];

export function TitleDetailPage() {
  const { id } = useParams();
  const title = useTitle(id);
  const badges = useTitleBadges(id);
  const collections = useTitleCollections(id);
  const coverUrl = useCoverUrl(title?.coverId ?? null);
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('Description');
  const [editOpen, setEditOpen] = useState(false);

  const { toggleFavorite, toggleReadingStatus, setTier, deleteTitle } = useLibraryStore();
  const filterByBadge = useFilterStore((s) => s.filterByBadge);
  const toast = useUIStore((s) => s.toast);

  if (title === undefined) {
    return <p className="py-16 text-center text-sm text-text-muted">Memuat…</p>;
  }
  if (title === null || !title) {
    return (
      <EmptyState
        icon="⌕"
        title="Judul tidak ditemukan"
        action={
          <Link to="/library">
            <Button variant="primary">Ke Library</Button>
          </Link>
        }
      />
    );
  }

  const onDelete = async () => {
    if (!window.confirm(`Hapus "${title.title}" dari library?`)) return;
    await deleteTitle(title.id);
    toast('Judul dihapus');
    navigate('/library');
  };

  return (
    <>
      <div className="mb-4">
        <Link to="/library" className="text-sm text-text-secondary hover:text-text-primary">
          ← Library
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(200px,280px)_1fr]">
        {/* cover besar */}
        <div>
          <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
            {coverUrl ? (
              <img src={coverUrl} alt={title.title} className="aspect-[2/3] w-full object-cover" />
            ) : (
              <div className="grid aspect-[2/3] place-items-center text-xs text-text-muted">
                Tanpa cover
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-editorial md:text-3xl">
            {title.title}
          </h1>
          {title.titleKo && (
            <p className="mt-1 text-sm text-text-secondary">{title.titleKo}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TierChip tier={title.tier} size="md" solid />
            <IconButton
              label={title.favorite ? 'Lepas favorit' : 'Tandai favorit'}
              variant={title.favorite ? 'primary' : 'secondary'}
              onClick={() => void toggleFavorite(title.id)}
            >
              ♥
            </IconButton>
            <button type="button" onClick={() => void toggleReadingStatus(title.id)}>
              <ReadingStatusPill status={title.readingStatus} />
            </button>
            <span className="rounded-full border border-hairline bg-elevated px-2.5 py-1 text-xs uppercase tracking-wide text-text-secondary">
              {WORK_STATUS_LABELS[title.workStatus]}
            </span>
            {title.type && (
              <span className="text-xs text-text-muted">
                {title.type}
                {title.yearOriginal ? ` · ${title.yearOriginal}` : ''}
              </span>
            )}
          </div>

          {/* Read ↗ per sumber — req FR-22, design §4 (empty state bila kosong) */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {title.readUrls.length > 0 ? (
              title.readUrls.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noreferrer noopener">
                  <Button variant="secondary">Read ↗ {readLinkLabel(link)}</Button>
                </a>
              ))
            ) : (
              <p className="text-xs text-text-muted">Belum ada link baca</p>
            )}
            <Button variant="primary" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="danger" onClick={onDelete}>
              Hapus
            </Button>
          </div>

          {/* set tier cepat */}
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-text-secondary">Tier</p>
            <div className="flex flex-wrap gap-1.5">
              {TIER_ORDER.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={async () => {
                    await setTier(title.id, t);
                    toast(`Tier di-set ${t}`);
                  }}
                >
                  <TierChip
                    tier={t}
                    solid={title.tier === t}
                    className={title.tier === t ? '' : 'opacity-60'}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* tabs — NFR-06: pola tablist ARIA + navigasi ←/→ */}
          <div className="mt-6 border-b border-hairline">
            <div role="tablist" aria-label="Detail judul" className="flex gap-1 overflow-x-auto no-scrollbar">
              {TABS.map((t, i) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`tab-${t}`}
                  aria-selected={tab === t}
                  aria-controls={`panel-${t}`}
                  tabIndex={tab === t ? 0 : -1}
                  onClick={() => setTab(t)}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                    e.preventDefault();
                    const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
                    setTab(TABS[next]!);
                    document.getElementById(`tab-${TABS[next]!}`)?.focus();
                  }}
                  className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors duration-fast ${
                    tab === t
                      ? 'border-brand text-text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="py-4" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'Description' && (
              <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
                {title.description && <p className="whitespace-pre-wrap">{title.description}</p>}
                {title.synopsisId && (
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide text-text-muted">
                      Sinopsis (ID)
                    </p>
                    <p className="whitespace-pre-wrap">{title.synopsisId}</p>
                  </div>
                )}
                {title.synopsisEn && (
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide text-text-muted">
                      Synopsis (EN)
                    </p>
                    <p className="whitespace-pre-wrap">{title.synopsisEn}</p>
                  </div>
                )}
                {!title.description && !title.synopsisId && !title.synopsisEn && (
                  <p className="text-text-muted">Belum ada deskripsi.</p>
                )}
              </div>
            )}

            {tab === 'Collections' && (
              <div className="flex flex-wrap gap-1.5">
                {collections.length > 0 ? (
                  collections.map((c) => (
                    <Link key={c.id} to="/collections">
                      <Chip>{c.name}</Chip>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-text-muted">Belum masuk collection mana pun.</p>
                )}
              </div>
            )}

            {tab === 'Badges' && (
              <div className="flex flex-wrap gap-1.5">
                {badges.length > 0 ? (
                  badges.map((b) => (
                    // klik badge → filter library (req FR-11)
                    <Chip
                      key={b.id}
                      onClick={() => {
                        filterByBadge(b.id);
                        navigate('/library');
                      }}
                    >
                      {b.name}
                    </Chip>
                  ))
                ) : (
                  <p className="text-sm text-text-muted">Belum ada badge.</p>
                )}
              </div>
            )}

            {tab === 'Metadata' && <MetadataTable title={title} />}
          </div>
        </div>
      </div>

      <EditTitleDialog title={title} open={editOpen} onClose={() => setEditOpen(false)} />
    </>
  );
}

function MetadataTable({ title }: { title: NonNullable<ReturnType<typeof useTitle>> }) {
  const rows: [string, string][] = [
    ['Judul Korea', title.titleKo ?? '—'],
    ['Judul alternatif', title.altTitles.join(', ') || '—'],
    ['Tipe', title.type ?? '—'],
    ['Tahun asli', title.yearOriginal ? String(title.yearOriginal) : '—'],
    ['Tahun Indo', title.yearIndo ? String(title.yearIndo) : '—'],
    ['Author', title.authors.join(', ') || '—'],
    ['Skor AniList', title.scoreAnilist !== null ? `${title.scoreAnilist}/100` : '—'],
    [
      'Skor MangaUpdates',
      title.scoreMangaupdates !== null ? `${title.scoreMangaupdates}/10` : '—',
    ],
    ['Status mentah', title.statusRaw ?? '—'],
    ['Chapter Indo', title.indoChapters !== null ? `${title.indoChapters}ch` : '—'],
    ['Status Indo', title.indoStatus ?? '—'],
    ['Link baca', title.readUrls.length ? `${title.readUrls.length} sumber` : '—'],
    ['Ditambahkan', new Date(title.createdAt).toLocaleString('id-ID')],
    ['Diubah', new Date(title.updatedAt).toLocaleString('id-ID')],
  ];

  return (
    <dl className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(110px,32%)_1fr] gap-3 px-3 py-2 text-sm">
          <dt className="text-text-muted">{k}</dt>
          <dd className="min-w-0 break-words text-text-secondary">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
