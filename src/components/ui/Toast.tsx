import { createPortal } from 'react-dom';
import { useUIStore, type ToastTone } from '../../stores/uiStore';

/** design §4 Toast — muncul sementara, elevated + border. */
const TONE: Record<ToastTone, string> = {
  default: 'border-hairline text-text-primary',
  success: 'border-status-read/40 text-status-read',
  error: 'border-tier-d/40 text-tier-d',
};

export function ToastHost() {
  const toasts = useUIStore((s) => s.toasts);
  const dismiss = useUIStore((s) => s.dismissToast);

  if (typeof document === 'undefined' || toasts.length === 0) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto max-w-sm rounded-xl border bg-elevated px-4 py-2.5 text-sm shadow-glass animate-[toastIn_200ms_ease-out] ${TONE[t.tone]}`}
        >
          {t.message}
        </button>
      ))}
    </div>,
    document.body,
  );
}
