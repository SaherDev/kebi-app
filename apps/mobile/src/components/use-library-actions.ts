import { useCallback, useMemo, useRef } from 'react';
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
 * Library mutations (the long-press menu actions): PATCH a save's user-state and
 * DELETE ("forget"). Both are optimistic against the {@link useLibrary} list and
 * roll back on failure. A forget waits out an undo window before committing the
 * DELETE, so "undo" truly restores the row (the server delete never fired yet).
 */

export interface LibraryActions {
  update: (view: SavedPlaceView, patch: UpdateUserPlaceRequest) => Promise<void>;
  forget: (view: SavedPlaceView) => void;
}

interface LibraryMutators {
  patchLocally: (userPlaceId: string, userData: UserPlace) => void;
  removeLocally: (userPlaceId: string) => void;
  refetch: () => void;
}

/** Undo window before a forget commits the DELETE — matches the toast lifetime. */
const FORGET_UNDO_MS = TOAST_DISMISS_MS.withAction;

export function useLibraryActions(lib: LibraryMutators): LibraryActions {
  const client = useApiClient();
  const clientRef = useRef(client);
  clientRef.current = client;
  const libRef = useRef(lib);
  libRef.current = lib;
  const toast = useToast();
  const { t } = useTranslation();

  const update = useCallback(
    async (view: SavedPlaceView, patch: UpdateUserPlaceRequest) => {
      const id = view.user_data.user_place_id;
      const prev = view.user_data;
      libRef.current.patchLocally(id, { ...prev, ...patch }); // optimistic
      try {
        const fresh = await updateUserPlace(clientRef.current, id, patch);
        libRef.current.patchLocally(id, fresh);
      } catch {
        libRef.current.patchLocally(id, prev); // rollback
        toast.show({ tone: 'danger', icon: 'alert', text: t('library.toast.updateFailed') });
      }
    },
    [toast, t],
  );

  const forget = useCallback(
    (view: SavedPlaceView) => {
      const id = view.user_data.user_place_id;
      const name = placeDisplayName(view);
      triggerHaptic('forget-place');
      libRef.current.removeLocally(id); // optimistic
      let undone = false;
      const timer = setTimeout(() => {
        if (undone) return;
        deleteUserPlace(clientRef.current, id).catch(() => {
          libRef.current.refetch(); // restore on failure
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
            libRef.current.refetch(); // bring the row back (never deleted)
          },
        },
      });
    },
    [toast, t],
  );

  return useMemo<LibraryActions>(() => ({ update, forget }), [update, forget]);
}
