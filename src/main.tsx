import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { seedDefaultCategories, requestPersistentStorage } from './db/seed';
import './index.css';

// Fase 1: seed kategori default (spec L136) + persist storage (NFR-04).
// Keduanya idempoten & non-blocking; kegagalan tidak menghentikan app.
void seedDefaultCategories().catch((err) => console.error('seed gagal', err));
void requestPersistentStorage();

const root = document.getElementById('root');
if (!root) throw new Error('#root tidak ditemukan');

// Dev only: muat data uji (library.csv + covers/) otomatis kalau rak masih
// kosong — IndexedDB terisolasi per browser/profil, jadi tiap browser baru
// perlu di-seed sendiri. `__seed()` tersedia di console untuk re-seed manual.
// Tidak ikut ke bundle produksi.
if (import.meta.env.DEV) {
  void import('./dev/seedFromDisk').then(async ({ seedFromDisk, autoSeedIfEmpty }) => {
    (window as unknown as Record<string, unknown>).__seed = seedFromDisk;
    try {
      const report = await autoSeedIfEmpty();
      if (report) console.info('[dev] data uji dimuat otomatis', report);
      else console.info('[dev] rak sudah berisi data — jalankan `await __seed()` untuk re-seed');
    } catch (err) {
      console.error('[dev] auto-seed gagal', err);
    }
  });
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
