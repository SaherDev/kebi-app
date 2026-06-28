import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  placeDisplayName,
  type SavedPlaceView,
  type UpdateUserPlaceRequest,
  type UserPlace,
} from '@kebi-app/shared';
import { useApiClient } from '../api/hooks';
import { deleteUserPlace, updateUserPlace } from '../api/library';
import { useToast } from './toast-context';
import { useTranslation } from '../i18n/context';
import { triggerHaptic } from '../lib/haptics';
import { TOAST_DISMISS_MS } from '../theme/motion';

/**
 * Global place actions — the saved-place menu mutations (looks right · i like
 * this one · been there · forget), shared by every surface that shows a place
 * (the library card long-press menu, the place page ••• sheet, future chat
 * cards). It owns the gateway calls (PATCH/DELETE), the toast + undo, and a
 * single **overrides store** so an optimistic change is reflected everywhere the
 * place appears, not just on the surface that triggered it.
 *
 * Surfaces never mutate user-state directly: they call `update`/`forget` and read
 * the effective state back through `resolve(view)` (applying any optimistic
 * override and hiding a `removed` place). This replaces the per-surface
 * `useLibraryActions` + the place-page stub.
 */

/** An optimistic change for one save, layered over its server `user_data`. */
interface Override {
  userData?: UserPlace;
  removed?: boolean;
}

/** A view's effective state after applying any optimistic override. */
export interface ResolvedPlace {
  userData: UserPlace;
  removed: boolean;
}

/** Confirmation toast fired optimistically when an update succeeds-by-default. */
export interface ActionConfirm {
  emoji?: string;
  text: string;
}

export interface PlaceActionsValue {
  /**
   * PATCH a save's user-state (approved/liked/visited); optimistic + rollback.
   * `confirm` shows a confirmation toast immediately (design-system: fire the
   * toast on the optimistic action); the error toast supersedes it on failure.
   */
  update: (view: SavedPlaceView, patch: UpdateUserPlaceRequest, confirm?: ActionConfirm) => Promise<void>;
  /** Remove a save with an undo window; the DELETE fires only after it elapses. */
  forget: (view: SavedPlaceView) => void;
  /** The view's effective user-state + whether it's been (optimistically) removed. */
  resolve: (view: SavedPlaceView) => ResolvedPlace;
}

const fallback: PlaceActionsValue = {
  update: async () => undefined,
  forget: () => undefined,
  resolve: (view) => ({ userData: view.user_data, removed: false }),
};

const PlaceActionsContext = createContext<PlaceActionsValue>(fallback);

/** Undo window before a forget commits the DELETE — matches the toast lifetime. */
const FORGET_UNDO_MS = TOAST_DISMISS_MS.withAction;

export function PlaceActionsProvider({ children }: { children: ReactNode }) {
  const client = useApiClient();
  const clientRef = useRef(client);
  clientRef.current = client;
  const toast = useToast();
  const { t } = useTranslation();

  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;

  const setOverride = useCallback((id: string, next: Override) => {
    setOverrides((prev) => ({ ...prev, [id]: next }));
  }, []);

  const update = useCallback(
    async (view: SavedPlaceView, patch: UpdateUserPlaceRequest, confirm?: ActionConfirm) => {
      const id = view.user_data.user_place_id;
      const current = overridesRef.current[id];
      const prev = current?.userData ?? view.user_data;
      setOverride(id, { ...current, userData: { ...prev, ...patch } }); // optimistic
      if (confirm) toast.show({ tone: 'success', emoji: confirm.emoji, text: confirm.text });
      try {
        const fresh = await updateUserPlace(clientRef.current, id, patch);
        setOverride(id, { ...overridesRef.current[id], userData: fresh });
      } catch {
        setOverride(id, { ...overridesRef.current[id], userData: prev }); // rollback
        toast.show({ tone: 'danger', icon: 'alert', text: t('library.toast.updateFailed') });
      }
    },
    [setOverride, toast, t],
  );

  const forget = useCallback(
    (view: SavedPlaceView) => {
      const id = view.user_data.user_place_id;
      const name = placeDisplayName(view);
      triggerHaptic('forget-place');
      setOverride(id, { ...overridesRef.current[id], removed: true }); // optimistic
      let undone = false;
      const timer = setTimeout(() => {
        if (undone) return;
        deleteUserPlace(clientRef.current, id).catch(() => {
          setOverride(id, { ...overridesRef.current[id], removed: false }); // restore
          toast.show({ tone: 'danger', icon: 'alert', text: t('library.toast.removeFailed') });
        });
      }, FORGET_UNDO_MS);
      toast.show({
        tone: 'danger',
        icon: 'trash',
        text: t('toast.removed', { name }),
        action: {
          label: t('toast.undo'),
          onPress: () => {
            undone = true;
            clearTimeout(timer);
            triggerHaptic('toast-undo');
            setOverride(id, { ...overridesRef.current[id], removed: false }); // bring it back
          },
        },
      });
    },
    [setOverride, toast, t],
  );

  const resolve = useCallback(
    (view: SavedPlaceView): ResolvedPlace => {
      const o = overrides[view.user_data.user_place_id];
      return { userData: o?.userData ?? view.user_data, removed: o?.removed ?? false };
    },
    [overrides],
  );

  const value = useMemo<PlaceActionsValue>(
    () => ({ update, forget, resolve }),
    [update, forget, resolve],
  );

  return <PlaceActionsContext.Provider value={value}>{children}</PlaceActionsContext.Provider>;
}

/** Read the global place actions + resolver from anywhere under the provider. */
export function usePlaceActions(): PlaceActionsValue {
  return useContext(PlaceActionsContext);
}
