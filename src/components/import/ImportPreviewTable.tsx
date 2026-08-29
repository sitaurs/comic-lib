import { useMemo, useState } from 'react';
import type { DupeAction, PreviewRow } from '../../import/dedupe';
import { Button } from '../ui/Button';

/**
 * Import Preview — req FR-15 (L70–L71), spec L154–L155.
 * Menampilkan detected / valid / duplicates / needs review dan aksi per baris
 * (Skip / Replace / Merge) plus aksi massal untuk seluruh duplikat.
 * design §4: chip pill `elevated`, tabel quiet, tombol utama amber.
 */
export type RowFilter = 'all' | 'valid' | 'duplicate' | 'needsReview';

const ACTIONS: DupeAction[] = ['merge', 'replace', 'skip'];
const ACTION_LABEL: Record<DupeAction, string> = {
  merge: 'Merge',
  replace: 'Replace',
  skip: 'Skip',
};

const STATUS_LABEL: Record<PreviewRow['status'], string> = {
  valid: 'Baru',
  duplicate: 'Duplikat',
  needsReview: 'Perlu Ditinjau',
};

const STATUS_CLASS: Record<PreviewRow['status'], string> = {
  valid: 'text-status-read border-status-read/30 bg-status-read/10',
  duplicate: 'text-tier-ss border-tier-ss/30 bg-tier-ss/10',
  needsReview: 'text-tier-d border-tier-d/30 bg-tier-d/10',
};

export function ImportPreviewTable({
  rows,
  onChangeAction,
  onBulkAction,
}: {
  rows: PreviewRow[];
  onChangeAction: (index: number, action: DupeAction) => void;
  onBulkAction: (action: DupeAction) => void;
}) {
  const [filter, setFilter] = useState<RowFilter>('all');
  const [limit, setLimit] = useState(40);

  const visible = useMemo(() => {
    const list = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => filter === 'all' || row.status === filter);
    return list;
  }, [rows, filter]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      valid: rows.filter((r) => r.status === 'valid').length,
      duplicate: rows.filter((r) => r.status === 'duplicate').length,
      needsReview: rows.filter((r) => r.status === 'needsReview').length,
    }),
    [rows],
  );

  const hasDuplicates = counts.duplicate > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'valid', 'duplicate', 'needsReview'] as RowFilter[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFilter(key);
              setLimit(40);
            }}
            className={`rounded-full border px-3 py-1 text-xs transition-colors duration-fast ${
              filter === key
                ? 'border-brand/40 bg-brand/15 text-brand'
                : 'border-hairline bg-elevated text-text-secondary hover:text-text-primary'
            }`}
          >
            {key === 'all' ? 'Semua' : STATUS_LABEL[key]}{' '}
            <span className="text-text-muted">{counts[key]}</span>
          </button>
        ))}

        {hasDuplicates && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-text-muted">Semua duplikat:</span>
            {ACTIONS.map((action) => (
              <Button key={action} size="sm" onClick={() => onBulkAction(action)}>
                {ACTION_LABEL[action]}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-hairline">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-secondary text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Judul</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Status</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Catatan</th>
              <th className="px-3 py-2 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, limit).map(({ row, index }) => (
              <tr key={index} className="border-t border-hairline align-top">
                <td className="px-3 py-2">
                  <div className="font-medium text-text-primary">
                    {row.parsed.title || <span className="text-text-muted">(tanpa judul)</span>}
                  </div>
                  {row.parsed.titleKo && (
                    <div className="text-xs text-text-muted">{row.parsed.titleKo}</div>
                  )}
                  <div className="mt-0.5 text-xs text-text-muted">
                    {row.parsed.readUrls.length} link · {row.parsed.sourceRef}
                  </div>
                </td>
                <td className="hidden px-3 py-2 sm:table-cell">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-xs ${STATUS_CLASS[row.status]}`}
                  >
                    {STATUS_LABEL[row.status]}
                  </span>
                </td>
                <td className="hidden max-w-xs px-3 py-2 text-xs text-text-secondary md:table-cell">
                  {row.parsed.issues.length > 0 && <div>{row.parsed.issues.join('; ')}</div>}
                  {row.existing && (
                    <div>
                      cocok dengan <span className="text-text-primary">{row.existing.title}</span>
                      {row.matchKind === 'weak' && ' (lewat alt title — periksa dulu)'}
                    </div>
                  )}
                  {row.batchDuplicateOf !== null && (
                    <div>duplikat baris #{row.batchDuplicateOf + 1} di file ini</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.status === 'needsReview' ? (
                    <span className="text-xs text-text-muted">dilewati</span>
                  ) : row.status === 'valid' ? (
                    <span className="text-xs text-text-muted">import</span>
                  ) : (
                    <div className="flex gap-1">
                      {ACTIONS.map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => onChangeAction(index, action)}
                          className={`rounded-lg border px-2 py-1 text-xs transition-colors duration-fast ${
                            row.action === action
                              ? 'border-brand/40 bg-brand/15 text-brand'
                              : 'border-hairline text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {ACTION_LABEL[action]}
                        </button>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible.length > limit && (
        <div className="text-center">
          <Button size="sm" onClick={() => setLimit((n) => n + 60)}>
            Tampilkan {Math.min(60, visible.length - limit)} baris lagi
          </Button>
        </div>
      )}
    </div>
  );
}
