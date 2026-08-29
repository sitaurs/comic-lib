import { useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { useUIStore } from '../../stores/uiStore';
import {
  backupFileName,
  csvFileName,
  exportBackupZip,
  exportCsv,
  restoreBackupZip,
  type RestoreMode,
} from '../../lib/backup';

/**
 * Backup / Restore Panel — spec §7 L193–L196, req FR-25 (L100–L101).
 * Export penuh (ZIP: library.json + covers/ + manifest.json), export CSV 22 kolom,
 * dan restore dari ZIP (mode replace/merge; replace destruktif → butuh konfirmasi).
 */
export function BackupPanel() {
  const toast = useUIStore((s) => s.toast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<RestoreMode>('merge');

  /** Unduh Blob via objectURL + <a download>, lalu revoke agar tidak leak (spec L82). */
  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleExportZip() {
    setBusy(true);
    try {
      // spec L193 — ZIP portable lintas perangkat (termasuk blob cover)
      download(await exportBackupZip(), backupFileName());
      toast('Backup ZIP tersimpan', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal membuat backup', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleExportCsv() {
    setBusy(true);
    try {
      // spec L194 — 22 kolom library.csv untuk interop dua arah
      const csv = await exportCsv();
      download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), csvFileName());
      toast('Export CSV selesai', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal export CSV', 'error');
    } finally {
      setBusy(false);
    }
  }

  function pickFile() {
    // replace membuang seluruh data lama → konfirmasi dulu
    if (mode === 'replace') {
      const ok = window.confirm(
        'Mode Replace akan MENGHAPUS seluruh data (judul, badge, collection, cover) ' +
          'dan menggantinya dengan isi backup. Lanjutkan?',
      );
      if (!ok) return;
    }
    fileRef.current?.click();
  }

  async function handleRestore(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setBusy(true);
    try {
      // spec L196 — validasi schemaVersion + tulis ulang semua store dalam satu transaksi
      const result = await restoreBackupZip(file, mode);
      toast(
        `Restore selesai — ${result.counts.titles} judul, ${result.counts.covers} cover`,
        'success',
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Restore gagal', 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Backup penuh berisi seluruh data <span className="text-text-primary">termasuk cover</span> (
        <code className="text-text-primary">library.json</code> +{' '}
        <code className="text-text-primary">covers/</code> +{' '}
        <code className="text-text-primary">manifest.json</code>). Export CSV memakai 22 kolom{' '}
        <code className="text-text-primary">library.csv</code> sehingga bisa di-import ulang.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void handleExportZip()} disabled={busy}>
          Export Backup (ZIP)
        </Button>
        <Button onClick={() => void handleExportCsv()} disabled={busy}>
          Export CSV
        </Button>
      </div>

      <div className="space-y-3 rounded-2xl border border-hairline bg-surface/50 p-4">
        <div className="text-sm font-semibold text-text-primary">Restore dari ZIP</div>

        <fieldset className="space-y-2">
          <legend className="text-xs text-text-muted">Mode restore</legend>

          <label className="flex cursor-pointer items-start gap-2 text-sm text-text-secondary">
            <input
              type="radio"
              name="restore-mode"
              value="merge"
              checked={mode === 'merge'}
              onChange={() => setMode('merge')}
              disabled={busy}
              className="mt-1 accent-brand"
            />
            <span>
              <span className="text-text-primary">Merge</span> — tambahkan / timpa per record, data
              lain dibiarkan.
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-sm text-text-secondary">
            <input
              type="radio"
              name="restore-mode"
              value="replace"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
              disabled={busy}
              className="mt-1 accent-tier-d"
            />
            <span>
              <span className="text-tier-d">Replace</span> — hapus seluruh data lama lebih dulu
              (destruktif, tidak bisa dibatalkan).
            </span>
          </label>
        </fieldset>

        {mode === 'replace' && (
          <p className="rounded-lg border border-tier-d/30 bg-tier-d/10 px-3 py-2 text-xs text-tier-d">
            Mode Replace menghapus semua judul, badge, collection, dan cover yang ada sekarang.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant={mode === 'replace' ? 'danger' : 'secondary'}
            onClick={pickFile}
            disabled={busy}
          >
            {busy ? 'Memproses…' : 'Restore dari ZIP'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => void handleRestore(e.target.files)}
          />
        </div>
      </div>
    </div>
  );
}
