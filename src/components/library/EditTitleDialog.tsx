import { useEffect, useState } from 'react';
import { db } from '../../db/db';
import type { Title } from '../../db/types';
import { useTitleBadges } from '../../hooks/useLibraryData';
import { useCoverUrl } from '../../hooks/useCoverUrl';
import { replaceCover } from '../../lib/coverCache';
import { useLibraryStore } from '../../stores/libraryStore';
import { useUIStore } from '../../stores/uiStore';
import { Button } from '../ui/Button';
import { AdaptiveDialog } from '../ui/Modal';
import { TitleForm, formValueFromTitle, type TitleFormValue } from './TitleForm';

/** Edit judul — req FR-20 (tombol Edit di detail), memakai form yang sama dengan Manual Add. */
export function EditTitleDialog({
  title,
  open,
  onClose,
}: {
  title: Title;
  open: boolean;
  onClose: () => void;
}) {
  const attached = useTitleBadges(title.id);
  const coverUrl = useCoverUrl(title.coverId);
  const updateTitle = useLibraryStore((s) => s.updateTitle);
  const toast = useUIStore((s) => s.toast);
  const [value, setValue] = useState<TitleFormValue | null>(null);
  const [saving, setSaving] = useState(false);

  // isi form saat dialog dibuka (dan saat badge terpasang selesai dimuat)
  useEffect(() => {
    if (!open) {
      setValue(null);
      return;
    }
    setValue(formValueFromTitle(title, new Set(attached.map((b) => b.id))));
    // sengaja hanya bergantung pada open + identitas judul + jumlah badge,
    // agar edit pengguna tidak tertimpa oleh live query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, title.id, attached.length]);

  const save = async () => {
    if (!value) return;
    const name = value.title.trim();
    if (!name) {
      toast('Judul wajib diisi', 'error');
      return;
    }
    setSaving(true);
    try {
      if (value.coverFile) await replaceCover(title.id, value.coverFile);

      await updateTitle(title.id, {
        title: name,
        titleKo: value.titleKo.trim() || null,
        altTitles: value.altTitlesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        readUrls: value.readUrls.filter((l) => l.url.trim()),
        readingStatus: value.readingStatus,
        tier: value.tier,
        favorite: value.favorite,
        workStatus: value.workStatus,
        type: value.type || null,
        yearOriginal: value.yearOriginal ? Number(value.yearOriginal) : null,
        description: value.description.trim() || null,
      });

      // sinkronkan badge: tambah yang baru, lepas yang dicabut
      const before = new Set(attached.map((b) => b.id));
      const after = value.badgeIds;
      const toAdd = [...after].filter((id) => !before.has(id));
      const toRemove = [...before].filter((id) => !after.has(id));
      await db.transaction('rw', db.titleBadges, async () => {
        if (toAdd.length)
          await db.titleBadges.bulkPut(toAdd.map((badgeId) => ({ titleId: title.id, badgeId })));
        for (const badgeId of toRemove) await db.titleBadges.delete([title.id, badgeId]);
      });

      toast(`Perubahan "${name}" disimpan`, 'success');
      onClose();
    } catch (err) {
      console.error(err);
      toast('Gagal menyimpan perubahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdaptiveDialog
      open={open}
      onClose={onClose}
      title="Edit Judul"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={save} disabled={saving || !value}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </>
      }
    >
      {value && <TitleForm value={value} onChange={setValue} existingCoverUrl={coverUrl} />}
    </AdaptiveDialog>
  );
}
