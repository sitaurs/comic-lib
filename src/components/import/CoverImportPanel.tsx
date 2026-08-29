import { useRef, useState } from 'react';
import {
  applyCoverMatches,
  collectCandidates,
  matchCovers,
  type CoverMatchResult,
} from '../../import/coverMatcher';
import { Button } from '../ui/Button';
import { useUIStore } from '../../stores/uiStore';

/**
 * Bulk Cover Import — req FR-17 (L76–L77), spec §5 (L158–L165).
 * Terima banyak gambar, folder, atau ZIP; cocokkan ke judul lewat slug/hint;
 * tampilkan matched vs unmatched sebelum disimpan.
 */
export function CoverImportPanel({ coverHints }: { coverHints?: Map<string, string> }) {
  const toast = useUIStore((s) => s.toast);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CoverMatchResult | null>(null);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    try {
      const candidates = await collectCandidates(Array.from(list));
      if (candidates.length === 0) {
        toast('Tidak ada gambar yang ditemukan', 'error');
        return;
      }
      setResult(await matchCovers(candidates, coverHints));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal membaca file cover', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!result) return;
    setBusy(true);
    try {
      const applied = await applyCoverMatches(result.matched);
      toast(`${applied} cover terpasang`, 'success');
      setResult(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan cover', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        Pilih gambar cover, folder <code className="text-text-primary">covers/</code>, atau satu file
        ZIP. Nama file dicocokkan ke judul (toleran prefix <code>NN-</code> &amp; ekstensi campur).
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          Pilih gambar / ZIP
        </Button>
        <Button onClick={() => folderRef.current?.click()} disabled={busy}>
          Pilih folder
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.zip"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <input
          ref={folderRef}
          type="file"
          multiple
          className="hidden"
          // @ts-expect-error atribut non-standar untuk memilih folder
          webkitdirectory=""
          directory=""
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {result && (
        <div className="space-y-3 rounded-2xl border border-hairline bg-surface/50 p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span>
              <span className="text-text-muted">Matched</span>{' '}
              <span className="font-semibold text-status-read">{result.matched.length}</span>
            </span>
            <span>
              <span className="text-text-muted">Unmatched</span>{' '}
              <span className="font-semibold text-tier-d">{result.unmatched.length}</span>
            </span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setResult(null)} disabled={busy}>
                Batal
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => void apply()}
                disabled={busy || result.matched.length === 0}
              >
                Pasang {result.matched.length} cover
              </Button>
            </div>
          </div>

          <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
            {result.matched.slice(0, 200).map((m) => (
              <li key={m.candidate.path} className="flex items-center justify-between gap-3">
                <span className="truncate text-text-muted">{m.candidate.path}</span>
                <span className="truncate text-text-primary">
                  {m.titleName}
                  {!m.viaHint && m.score < 1 && (
                    <span className="ml-1 text-text-muted">({Math.round(m.score * 100)}%)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {result.unmatched.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-text-secondary">
                Lihat {result.unmatched.length} file tanpa pasangan
              </summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-text-muted">
                {result.unmatched.map((c) => (
                  <li key={c.path} className="truncate">
                    {c.path}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
