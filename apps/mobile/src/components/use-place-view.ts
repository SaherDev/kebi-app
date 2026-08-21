import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaceView, UserPlace } from '@kebi-app/shared';
import { useApiClient } from '../api/hooks';
import { getPlace, saveUserPlace } from '../api/library';
import { SavedPlaceView } from '../api/models/library';
import { useToast } from './toast-context';
import { useUpgradeToast } from './use-upgrade-toast';
import { usePlaceDetail } from './place-detail-context';
import { useTranslation } from '../i18n/context';

/**
 * The place screen's data. One place opens the same screen whether the caller
 * saved it or not (ADR-151), so this hook resolves both:
 *
 * - **Seed** — a list surface (a Library card) hands the view it already holds
 *   to `place-detail-context` before navigating, so the screen paints with no
 *   spinner. A by-id fetch still runs behind it to refresh claims/user-state.
 * - **Fetch** — a chat venue tap or a cold start onto `/place?id=…` has no
 *   seed, so `GET /v1/places/{id}` is the only path and the screen waits.
 *
 * `user_data: null` means the caller never saved this place — the screen's cue
 * to offer {@link save} instead of the user-state layer. Saving returns the
 * created user-state, so the flip to the saved screen needs no refetch.
 */
export type PlaceViewState =
  | { status: 'loading'; view: null }
  | { status: 'ready'; view: PlaceView }
  /** Nothing to show. `retryable` is false for a place that is simply gone. */
  | { status: 'failed'; view: null; retryable: boolean };

export interface PlaceViewResult {
  state: PlaceViewState;
  /** True while a seeded screen is still waiting on its by-id refresh. */
  refreshing: boolean;
  /** Re-read the place after a recoverable failure (ADR-056). */
  retry: () => void;
  /** Save this place to the caller's library; no-op while one is in flight. */
  save: () => void;
  /** True while the save request is in flight (the button shows its pending state). */
  saving: boolean;
}

export function usePlaceView(placeId: string | undefined): PlaceViewResult {
  const client = useApiClient();
  const clientRef = useRef(client);
  clientRef.current = client;
  const { t } = useTranslation();
  const toast = useToast();
  const showUpgrade = useUpgradeToast();
  const placeDetail = usePlaceDetail();

  // The seed is only valid for the place actually being opened — a stale
  // selection from a previous tap must never render under a different id.
  const seed = placeDetail.view;
  const seeded = seed && (!placeId || seed.place.id === placeId) ? seed : null;

  // What the fetch (or a save) produced. Kept *beside* the seed rather than
  // initialised from it: the seeding surface sets the context in an effect, so
  // a snapshot taken during the first render would miss it entirely.
  const [loaded, setLoaded] = useState<PlaceView | null>(null);
  const [failed, setFailed] = useState(false);
  /** A 404 (or a forgotten place): retrying cannot change the answer. */
  const [gone, setGone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const view = loaded ?? seeded;

  useEffect(() => {
    if (!placeId) return;
    let live = true;
    void (async () => {
      try {
        const fresh = await getPlace(clientRef.current, placeId);
        if (live) {
          setLoaded(fresh);
          setFailed(false);
        }
      } catch (err) {
        // `failed` only decides what an *empty* screen shows: a seeded screen
        // keeps rendering what it has, since blanking a card the user is
        // already reading is worse than a stale one.
        if (!live) return;
        const status =
          err && typeof err === 'object' && 'status' in err
            ? (err as { status?: number }).status
            : undefined;
        setGone(status === 404);
        setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [placeId, attempt]);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);

  // A refresh that fails behind a seeded screen never replaces it — the places
  // stays readable and the failure is a toast (ADR-056). Fires on the
  // transition only, and never for a cold open, which has its own screen.
  const toldRef = useRef(false);
  useEffect(() => {
    if (failed && !toldRef.current && seeded && !gone) {
      toldRef.current = true;
      toast.show({
        tone: 'danger',
        icon: 'alert',
        text: t('place.refreshFailed'),
        action: { label: t('common.retry'), onPress: retry },
      });
    }
    if (!failed) toldRef.current = false;
  }, [failed, seeded, gone, toast, t, retry]);

  const save = useCallback(() => {
    const id = view?.place.id;
    if (!id || saving || view?.user_data) return;
    setSaving(true);
    void (async () => {
      try {
        const userData: UserPlace = await saveUserPlace(clientRef.current, {
          place_core_id: id,
        });
        // 201 carries the created user-state, so the screen flips in place.
        setLoaded(
          new SavedPlaceView({
            place: view.place,
            user_data: userData,
            claims: view.claims,
            // Saving doesn't move a place — it keeps the area it already resolved to.
            area: view.area,
          }),
        );
        toast.show({
          tone: 'success',
          icon: 'check',
          text: t('toast.saved', { name: view.place.place_name }),
        });
      } catch (err) {
        const status =
          err && typeof err === 'object' && 'status' in err
            ? (err as { status?: number }).status
            : undefined;
        // 403 is the plan's save limit (ADR-112) — point at the plans screen.
        if (status === 403) showUpgrade(t('plans.limitReached.save'));
        else toast.show({ tone: 'danger', icon: 'alert', text: t('toast.saveFailed') });
      } finally {
        setSaving(false);
      }
    })();
  }, [view, saving, toast, showUpgrade, t]);

  // No id and no seed (a cold start onto a bare `/place`) can never resolve, so
  // it reads as failed rather than spinning forever.
  const state: PlaceViewState = view
    ? { status: 'ready', view }
    : !placeId || gone
      ? { status: 'failed', view: null, retryable: false }
      : failed
        ? { status: 'failed', view: null, retryable: true }
        : { status: 'loading', view: null };

  return { state, refreshing: loaded == null && seeded != null, retry, save, saving };
}
