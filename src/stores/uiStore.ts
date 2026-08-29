import { create } from 'zustand';
import { newId } from '../lib/id';

/**
 * uiStore — spec §8 L203.
 * Mode grid/compact, modal & bottom-sheet aktif, seleksi multi (bulk), toast queue.
 */
export type ViewMode = 'grid' | 'compact';
export type SheetKind = 'filter' | 'quickEdit' | null;
export type ModalKind = 'addTitle' | 'import' | 'coverImport' | 'badgeSelector' | null;
export type ToastTone = 'default' | 'success' | 'error';

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

interface UIState {
  viewMode: ViewMode;
  modal: ModalKind;
  modalPayload: unknown;
  sheet: SheetKind;
  sheetPayload: unknown;
  /** Seleksi multi untuk Bulk Edit — req FR-18. */
  selection: Set<string>;
  selectionMode: boolean;
  toasts: Toast[];
}

interface UIActions {
  setViewMode: (v: ViewMode) => void;
  toggleViewMode: () => void;

  openModal: (kind: NonNullable<ModalKind>, payload?: unknown) => void;
  closeModal: () => void;
  openSheet: (kind: NonNullable<SheetKind>, payload?: unknown) => void;
  closeSheet: () => void;

  toggleSelect: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;
  setSelectionMode: (v: boolean) => void;

  /** design §4 Toast + §8 (toast konfirmasi setelah toggle). */
  toast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: string) => void;
}

export const useUIStore = create<UIState & UIActions>((set, get) => ({
  viewMode: 'grid',
  modal: null,
  modalPayload: undefined,
  sheet: null,
  sheetPayload: undefined,
  selection: new Set(),
  selectionMode: false,
  toasts: [],

  setViewMode: (viewMode) => set({ viewMode }),
  toggleViewMode: () => set((s) => ({ viewMode: s.viewMode === 'grid' ? 'compact' : 'grid' })),

  openModal: (modal, modalPayload) => set({ modal, modalPayload }),
  closeModal: () => set({ modal: null, modalPayload: undefined }),
  openSheet: (sheet, sheetPayload) => set({ sheet, sheetPayload }),
  closeSheet: () => set({ sheet: null, sheetPayload: undefined }),

  toggleSelect: (id) =>
    set((s) => {
      const selection = new Set(s.selection);
      if (selection.has(id)) selection.delete(id);
      else selection.add(id);
      return { selection, selectionMode: selection.size > 0 };
    }),

  selectMany: (ids) =>
    set((s) => {
      const selection = new Set(s.selection);
      ids.forEach((id) => selection.add(id));
      return { selection, selectionMode: selection.size > 0 };
    }),

  clearSelection: () => set({ selection: new Set(), selectionMode: false }),
  setSelectionMode: (selectionMode) =>
    set(selectionMode ? { selectionMode } : { selectionMode, selection: new Set() }),

  toast: (message, tone = 'default') => {
    const id = newId();
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => get().dismissToast(id), 2800);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
