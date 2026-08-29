import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * design §4 — Modal (glass) & BottomSheet mobile.
 * Transisi fade + slide singkat (design §8, 150–200ms); reduced-motion dihormati via CSS.
 */

function useEscape(onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, active]);
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * NFR-06 — jerat fokus di dalam dialog, beri fokus awal, lalu pulihkan fokus
 * ke elemen pemicu saat ditutup.
 */
function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const previous = document.activeElement as HTMLElement | null;

    const first = node.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [active]);

  return ref;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEscape(onClose, open);
  const trapRef = useFocusTrap(open);
  if (!open) return null;

  const width = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={trapRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        className={`glass relative flex max-h-[85vh] w-full ${width} flex-col overflow-hidden rounded-2xl animate-[modalIn_200ms_ease-out]`}
      >
        {title && (
          <header className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4">
            <h2 className="font-display text-lg font-semibold tracking-editorial">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="grid h-8 w-8 place-items-center rounded-lg text-text-muted transition-colors hover:bg-elevated hover:text-text-primary"
            >
              ×
            </button>
          </header>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-hairline px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** design §6 — Bottom sheet: Filter & Quick Edit muncul dari bawah (mobile). */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEscape(onClose, open);
  const trapRef = useFocusTrap(open);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/60 animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={trapRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Panel'}
        className="glass relative flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-[sheetIn_200ms_ease-out]"
      >
        <div className="flex justify-center pt-3" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-elevated" />
        </div>
        {title && (
          <header className="flex items-center justify-between gap-4 px-5 py-3">
            <h2 className="font-display text-base font-semibold tracking-editorial">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-elevated hover:text-text-primary"
            >
              ×
            </button>
          </header>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <footer className="flex items-center gap-2 border-t border-hairline px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Adaptif: Modal di desktop, BottomSheet di mobile (< 768px) — NFR-07.
 * Memakai listener matchMedia agar ikut berubah saat viewport diputar/di-resize.
 */
export function AdaptiveDialog(props: Parameters<typeof Modal>[0]) {
  const isMobile = useIsMobile();
  return isMobile ? <BottomSheet {...props} /> : <Modal {...props} />;
}

/** true saat viewport < 768px (breakpoint `md` Tailwind) — design §6. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

const MOBILE_QUERY = '(max-width: 767px)';
