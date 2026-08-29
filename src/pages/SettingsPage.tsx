import { useState } from 'react';
import { PageHeader, SectionHeader } from '../components/layout/PageHeader';
import { DataImportPanel } from '../components/import/DataImportPanel';
import { CoverImportPanel } from '../components/import/CoverImportPanel';
import { BackupPanel } from '../components/settings/BackupPanel';
import { useTitleCount } from '../hooks/useLibraryData';

/**
 * Settings — Import data & cover (Fase 4) + Backup/Restore (Fase 6, req FR-25).
 * design §5: panel `surface` flat dengan border halus, teks metadata quiet.
 */
export function SettingsPage() {
  const total = useTitleCount();
  const [coverHints, setCoverHints] = useState<Map<string, string> | undefined>();

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle={`${total ?? 0} judul di library · semua data tersimpan lokal di browser ini`}
      />

      <div className="space-y-6">
        <section className="rounded-2xl border border-hairline bg-surface/50 p-4 md:p-5">
          <SectionHeader title="Import Data" aside={<span className="text-xs text-text-muted">CSV · JSON · TXT</span>} />
          <DataImportPanel onCommitted={setCoverHints} />
        </section>

        <section className="rounded-2xl border border-hairline bg-surface/50 p-4 md:p-5">
          <SectionHeader
            title="Import Cover"
            aside={
              coverHints ? (
                <span className="text-xs text-brand">
                  {coverHints.size} petunjuk cover dari import terakhir
                </span>
              ) : (
                <span className="text-xs text-text-muted">gambar · folder · ZIP</span>
              )
            }
          />
          <CoverImportPanel coverHints={coverHints} />
        </section>

        <section className="rounded-2xl border border-hairline bg-surface/50 p-4 md:p-5">
          <SectionHeader
            title="Backup & Restore"
            aside={<span className="text-xs text-text-muted">ZIP · CSV 22 kolom</span>}
          />
          <BackupPanel />
        </section>

        {/* req FR-26 / NFR-01 — tegaskan sifat local-first ke pengguna */}
        <p className="px-1 text-xs text-text-muted">
          Aplikasi ini local-first: tanpa login, tanpa server, tanpa telemetri. Semua judul, badge,
          dan cover disimpan di IndexedDB browser ini dan tetap bisa dibuka offline. Simpan backup
          ZIP secara berkala — menghapus data situs juga menghapus library.
        </p>
      </div>
    </>
  );
}
