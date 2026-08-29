import { useEffect, useMemo, useState } from 'react';
import type { Badge, ReadLink, Tier, Title, TitleType, WorkStatus } from '../../db/types';
import { TIER_ORDER } from '../../design/tokens';
import { useBadgeCategories, useBadges } from '../../hooks/useLibraryData';
import { makeReadLink } from '../../lib/readLinks';
import { Button, IconButton } from '../ui/Button';
import { Chip, TierChip } from '../ui/Chip';

/**
 * Form judul — req FR-13 (Manual Add) & dipakai ulang untuk Edit (FR-20).
 * Field: cover, judul, judul Korea, link baca 1..n, status, tier, favorit,
 * badge, work status, deskripsi.
 */
export interface TitleFormValue {
  title: string;
  titleKo: string;
  altTitlesText: string;
  readUrls: ReadLink[];
  readingStatus: Title['readingStatus'];
  tier: Tier;
  favorite: boolean;
  workStatus: WorkStatus;
  type: TitleType | '';
  yearOriginal: string;
  description: string;
  badgeIds: Set<string>;
  coverFile: File | null;
}

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  ongoing: 'Ongoing',
  complete: 'Complete',
  hiatus: 'Hiatus',
  dropped: 'Dropped',
  cancelled: 'Cancelled',
  unknown: 'Tidak diketahui',
};

export function emptyFormValue(): TitleFormValue {
  return {
    title: '',
    titleKo: '',
    altTitlesText: '',
    readUrls: [],
    readingStatus: 'belum_baca',
    tier: 'Unrated',
    favorite: false,
    workStatus: 'unknown',
    type: '',
    yearOriginal: '',
    description: '',
    badgeIds: new Set(),
    coverFile: null,
  };
}

export function formValueFromTitle(t: Title, badgeIds: Set<string>): TitleFormValue {
  return {
    title: t.title,
    titleKo: t.titleKo ?? '',
    altTitlesText: t.altTitles.join(', '),
    readUrls: [...t.readUrls],
    readingStatus: t.readingStatus,
    tier: t.tier,
    favorite: t.favorite,
    workStatus: t.workStatus,
    type: t.type ?? '',
    yearOriginal: t.yearOriginal ? String(t.yearOriginal) : '',
    description: t.description ?? '',
    badgeIds: new Set(badgeIds),
    coverFile: null,
  };
}

const fieldClass =
  'w-full rounded-xl border border-hairline bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand/50';
const labelClass = 'mb-1.5 block text-xs font-medium text-text-secondary';

export function TitleForm({
  value,
  onChange,
  existingCoverUrl,
}: {
  value: TitleFormValue;
  onChange: (v: TitleFormValue) => void;
  existingCoverUrl?: string | null;
}) {
  const badges = useBadges();
  const categories = useBadgeCategories();
  const [badgeQuery, setBadgeQuery] = useState('');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const patch = (p: Partial<TitleFormValue>) => onChange({ ...value, ...p });

  useEffect(() => {
    if (!value.coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(value.coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value.coverFile]);

  const grouped = useMemo(() => {
    const q = badgeQuery.trim().toLowerCase();
    const byCat = new Map<string, Badge[]>();
    for (const b of badges ?? []) {
      if (q && !b.name.toLowerCase().includes(q)) continue;
      const list = byCat.get(b.categoryId);
      if (list) list.push(b);
      else byCat.set(b.categoryId, [b]);
    }
    return byCat;
  }, [badges, badgeQuery]);

  const toggleBadge = (id: string) => {
    const next = new Set(value.badgeIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    patch({ badgeIds: next });
  };

  const setUrl = (idx: number, raw: string) => {
    const next = [...value.readUrls];
    const link = makeReadLink(raw);
    if (raw.trim()) next[idx] = link;
    else next.splice(idx, 1);
    patch({ readUrls: next });
  };

  return (
    <div className="space-y-4">
      {/* cover + judul */}
      <div className="flex gap-4">
        <div className="w-24 shrink-0">
          <label className={labelClass}>Cover</label>
          <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-hairline bg-bg">
            {coverPreview || existingCoverUrl ? (
              <img
                src={coverPreview ?? existingCoverUrl ?? ''}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="grid h-full place-items-center text-[10px] text-text-muted">
                Belum ada
              </span>
            )}
          </div>
          <label className="mt-2 block cursor-pointer rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-center text-[11px] text-text-secondary hover:text-text-primary">
            Pilih file
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => patch({ coverFile: e.target.files?.[0] ?? null })}
            />
          </label>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <label className={labelClass} htmlFor="f-title">
              Judul <span className="text-tier-d">*</span>
            </label>
            <input
              id="f-title"
              className={fieldClass}
              value={value.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="mis. Nano Machine"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="f-titleko">
              Judul Korea
            </label>
            <input
              id="f-titleko"
              className={fieldClass}
              value={value.titleKo}
              onChange={(e) => patch({ titleKo: e.target.value })}
              placeholder="나노마신"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="f-alt">
              Judul alternatif <span className="text-text-muted">(pisahkan dengan koma)</span>
            </label>
            <input
              id="f-alt"
              className={fieldClass}
              value={value.altTitlesText}
              onChange={(e) => patch({ altTitlesText: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* link baca jamak — req FR-22 */}
      <div>
        <label className={labelClass}>Link baca</label>
        <div className="space-y-2">
          {value.readUrls.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={fieldClass}
                value={link.url}
                onChange={(e) => setUrl(i, e.target.value)}
                placeholder="https://…"
              />
              <IconButton
                label="Hapus link"
                onClick={() => patch({ readUrls: value.readUrls.filter((_, j) => j !== i) })}
              >
                ×
              </IconButton>
            </div>
          ))}
          <Button
            size="sm"
            onClick={() => patch({ readUrls: [...value.readUrls, makeReadLink('')] })}
          >
            + Tambah link
          </Button>
          {value.readUrls.length === 0 && (
            <p className="text-xs text-text-muted">
              Belum ada link baca — bisa diisi nanti lewat import Merge.
            </p>
          )}
        </div>
      </div>

      {/* status / tier / favorit */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Status baca</label>
          <div className="flex gap-2">
            {(['belum_baca', 'pernah_baca'] as const).map((s) => (
              <Chip
                key={s}
                active={value.readingStatus === s}
                onClick={() => patch({ readingStatus: s })}
              >
                {s === 'pernah_baca' ? 'Pernah Baca' : 'Belum Baca'}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Favorit</label>
          <Chip active={value.favorite} onClick={() => patch({ favorite: !value.favorite })}>
            ♥ {value.favorite ? 'Favorit' : 'Bukan favorit'}
          </Chip>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Tier</label>
          <div className="flex flex-wrap gap-1.5">
            {TIER_ORDER.map((t) => (
              <button key={t} type="button" onClick={() => patch({ tier: t })}>
                <TierChip
                  tier={t}
                  solid={value.tier === t}
                  size="md"
                  className={value.tier === t ? '' : 'opacity-60'}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* metadata */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="f-ws">
            Work status
          </label>
          <select
            id="f-ws"
            className={fieldClass}
            value={value.workStatus}
            onChange={(e) => patch({ workStatus: e.target.value as WorkStatus })}
          >
            {Object.entries(WORK_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="f-type">
            Tipe
          </label>
          <select
            id="f-type"
            className={fieldClass}
            value={value.type}
            onChange={(e) => patch({ type: e.target.value as TitleType | '' })}
          >
            <option value="">—</option>
            <option value="Manhwa">Manhwa</option>
            <option value="Manhua">Manhua</option>
            <option value="Manga">Manga</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="f-year">
            Tahun asli
          </label>
          <input
            id="f-year"
            className={fieldClass}
            inputMode="numeric"
            value={value.yearOriginal}
            onChange={(e) => patch({ yearOriginal: e.target.value.replace(/\D/g, '') })}
            placeholder="2020"
          />
        </div>
      </div>

      {/* badge selector — req FR-07 */}
      <div>
        <label className={labelClass}>Badge</label>
        <input
          className={`${fieldClass} mb-2`}
          value={badgeQuery}
          onChange={(e) => setBadgeQuery(e.target.value)}
          placeholder="Cari badge…"
        />
        <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-hairline bg-bg/50 p-3">
          {(categories ?? []).map((cat) => {
            const list = grouped.get(cat.id) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={cat.id}>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-text-muted">
                  {cat.name}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((b) => (
                    <Chip
                      key={b.id}
                      active={value.badgeIds.has(b.id)}
                      onClick={() => toggleBadge(b.id)}
                    >
                      {b.name}
                    </Chip>
                  ))}
                </div>
              </div>
            );
          })}
          {(badges?.length ?? 0) === 0 && (
            <p className="text-xs text-text-muted">
              Belum ada badge. Buat di halaman Badges atau lewat import.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="f-desc">
          Deskripsi
        </label>
        <textarea
          id="f-desc"
          rows={4}
          className={fieldClass}
          value={value.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </div>
    </div>
  );
}
