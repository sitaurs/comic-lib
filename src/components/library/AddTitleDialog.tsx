import { useState } from 'react';
import { db } from '../../db/db';
import { useLibraryStore } from '../../stores/libraryStore';
import { useUIStore } from '../../stores/uiStore';
import { putCover } from '../../lib/coverCache';
import { newId } from '../../lib/id';
import { AdaptiveDialog } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TitleForm, emptyFormValue, type TitleFormValue } from './TitleForm';

/**
 * Manual Add — req FR-13.
 * Judul baru default: Unrated / belum_baca / favorite=false (req L128).
 */
export function AddTitleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [value, setValue] = useState<TitleFormValue>(emptyFormValue);
  const [saving, setSaving] = useState(false);
  const addTitle = useLibraryStore((s) => s.addTitle);
  const toast = useUIStore((s) => s.toast);

  const reset = () => setValue(emptyFormValue());

  const save = async () => {
    const name = value.title.trim();
    if (!name) {
      toast('Judul wajib diisi', 'error');
      return;
    }
    setSaving(true);
    try {
      const coverId = value.coverFile ? await putCover(value.coverFile) : null;
      const id = await addTitle({
        id: newId(),
        title: name,
        titleKo: value.titleKo.trim() || null,
        altTitles: value.altTitlesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        coverId,
        readUrls: value.readUrls.filter((l) => l.url.trim()),
        readingStatus: value.readingStatus,
        tier: value.tier,
        favorite: value.favorite,
        workStatus: value.workStatus,
        type: value.type || null,
        yearOriginal: value.yearOriginal ? Number(value.yearOriginal) : null,
        description: value.description.trim() || null,
      });

      if (value.badgeIds.size > 0) {
        await db.titleBadges.bulkPut(
          [...value.badgeIds].map((badgeId) => ({ titleId: id, badgeId })),
        );
      }

      toast(`"${name}" ditambahkan`, 'success');
      reset();
      onClose();
    } catch (err) {
      console.error(err);
      toast('Gagal menyimpan judul', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdaptiveDialog
      open={open}
      onClose={onClose}
      title="Tambah Judul"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </>
      }
    >
      <TitleForm value={value} onChange={setValue} />
    </AdaptiveDialog>
  );
}
