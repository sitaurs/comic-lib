import { useEffect, useState } from 'react';
import { getCoverUrl } from '../lib/coverCache';

/**
 * Ambil objectURL cover via cache (spec L82).
 * Cache global menangani revoke — hook ini tidak revoke sendiri agar URL
 * tetap valid untuk komponen lain yang memakai coverId sama.
 */
export function useCoverUrl(coverId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!coverId) {
      setUrl(null);
      return;
    }
    void getCoverUrl(coverId).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [coverId]);

  return url;
}
