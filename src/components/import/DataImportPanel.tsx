import { useRef, useState } from 'react';
import { detectAndParse } from '../../import/detect';
import { buildPreview, summarize, type DupeAction, type PreviewRow } from '../../import/dedupe';
import { commitImport } from '../../import/commit';
import type { ImportFormat } from '../../import/types';
import { Button } from '../ui/Button';
import { useUIStore } from '../../stores/uiStore';
import { ImportPreviewTable } from './ImportPreviewTable';

/**
 * Import data — req FR-14/FR-15/FR-16, spec §3 (parse → normalisasi → dedup →
 * preview → commit). Menerima CSV / JSON / TXT; format dideteksi dari isi file.
 */
const FORMAT_LABEL: Record<ImportFormat, string> = {
  'library-csv': 'library.csv (22 kolom)',
  'metadata-csv': 'metadata.csv (format lama)',
  'metadata-json': 'JSON',
  txt: 'TXT (daftar 2 baris)',
};

export function DataImportPanel({
  onCommitted,
}: {
  onCommitted?: (coverHints: Map<string, string>) => void;
}) {
  const toast = useUIStore((s) => s.toast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [format, setFormat] = useState<ImportFormat | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);

  async function handleFile(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = detectAndParse(text, file.name);
      const preview = await buildPreview(parsed.titles);
      setFileName(file.name);
      setFormat(parsed.format);
      setWarnings(parsed.warnings);
      setRows(preview);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal membaca file', 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function changeAction(index: number, action: DupeAction) {
    setRows((prev) =>
      prev ? prev.map((row, i) => (i === index ? { ...row, action } : row)) : prev,
    );
  }

  function bulkAction(action: DupeAction) {
    setRows((prev) =>
      prev ? prev.map((row) => (row.status === 'duplicate' ? { ...row, action } : row)) : prev,
    );
  }

  async function commit() {
    if (!rows) return;
    setBusy(true);
    try {
      const result = await commitImport(rows);
      toast(
        `${result.inserted} baru · ${result.merged} merge · ${result.replaced} replace · ${result.skipped} skip`,
        'success',
      );
      onCommitted?.(result.coverHints);
      setRows(null);
      setFormat(null);
      setWarnings([]);
      setFileName('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import gagal', 'error');
    } finally {
      setBusy(false);
    }
  }

  const summary = rows ? summarize(rows) : null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        Pilih file <code className="text-text-primary">.csv</code>,{' '}
        <code className="text-text-primary">.json</code>, atau{' '}
        <code className="text-text-primary">.txt</code>. Format dikenali otomatis dari isinya.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          Pilih file data
        </Button>
        {fileName && (
          <span className="text-xs text-text-muted">
            {fileName}
            {format && ` · ${FORMAT_LABEL[format]}`}
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,.txt,text/csv,application/json,text/plain"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files)}
        />
      </div>

      {warnings.length > 0 && (
        <ul className="rounded-xl border border-tier-c/30 bg-tier-c/10 px-3 py-2 text-xs text-tier-c">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {rows && summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Detected" value={summary.detected} />
            <StatTile label="Valid" value={summary.valid} tone="text-status-read" />
            <StatTile label="Duplicates" value={summary.duplicates} tone="text-tier-ss" />
            <StatTile label="Needs Review" value={summary.needsReview} tone="text-tier-d" />
          </div>

          {summary.weakDuplicates > 0 && (
            <p className="rounded-xl border border-tier-c/30 bg-tier-c/10 px-3 py-2 text-xs text-tier-c">
              {summary.weakDuplicates} baris cocok hanya lewat <em>alt title</em>. Judul berbeda bisa
              berbagi alt title, jadi baris ini default-nya <strong>Skip</strong> — periksa sebelum
              memilih Merge.
            </p>
          )}

          <ImportPreviewTable
            rows={rows}
            onChangeAction={changeAction}
            onBulkAction={bulkAction}
          />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRows(null)} disabled={busy}>
              Batal
            </Button>
            <Button variant="primary" onClick={() => void commit()} disabled={busy}>
              Import {summary.detected - summary.needsReview} judul
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = 'text-text-primary',
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-3 py-2">
      <div className={`font-display text-xl font-bold tracking-editorial ${tone}`}>{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  );
}
