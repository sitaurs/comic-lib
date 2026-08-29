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

// Auto-seed: muat dataset (library.csv + covers/) kalau rak masih kosong.
// IndexedDB terisolasi per browser/profil, jadi tiap perangkat men-seed dirinya
// sendiri sekali — termasuk di produksi, sehingga app langsung terisi 118 judul.
// Idempoten: rak yang sudah berisi tidak disentuh. `__seed()` di console untuk
// re-seed manual. Chunk-nya dynamic import, jadi tidak menahan first paint.
void import('./lib/seedFromDisk').then(async ({ seedFromDisk, autoSeedIfEmpty }) => {
  (window as unknown as Record<string, unknown>).__seed = seedFromDisk;
  try {
    const report = await autoSeedIfEmpty();
    if (report) console.info('[seed] dataset dimuat otomatis', report);
  } catch (err) {
    console.error('[seed] auto-seed gagal', err);
  }
});

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
