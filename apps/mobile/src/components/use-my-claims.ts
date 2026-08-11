import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApiClient } from '../api/hooks';
import { listClaims, retractClaim } from '../api/knowledge';
import { groupClaimsByAnchor, type ClaimGroup, type KnowledgeClaim } from '../api/models/knowledge';
import { useToast } from './toast-context';
import { useTranslation } from '../i18n/context';
import { triggerHaptic } from '../lib/haptics';
import { TOAST_DISMISS_MS } from '../theme/motion';

/** Undo window before a retract commits the DELETE — matches the toast lifetime. */
const RETRACT_UNDO_MS = TOAST_DISMISS_MS.withAction;

export type MyClaimsState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; groups: ClaimGroup[]; total: number };

export interface MyClaims {
  state: MyClaimsState;
  /** Retract one note, with an undo window. */
  retract: (claim: KnowledgeClaim) => void;
  reload: () => void;
}

/**
 * The caller's own claims, grouped by what they are about — what backs "what
 * you've added".
 *
 * Retraction mirrors the place `forget` exactly: the row disappears
 * **optimistically**, the toast carries undo, and the DELETE fires only once the
 * undo window elapses. Deferring the request rather than sending it and undoing
 * afterwards means an undo needs no compensating write — and a claim is global,
 * so an un-deletable delete is the wrong thing to risk.
 *
 * There is no confirm dialog: the undo **is** the confirmation, the same bargain
 * "forget this place" already makes.
 */
export function useMyClaims(): MyClaims {
  const client = useApiClient();
  const clientRef = useRef(client);
  clientRef.current = client;
  const toast = useToast();
  const { t } = useTranslation();

  const [claims, setClaims] = useState<KnowledgeClaim[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  // Ids hidden by an in-flight retract. Kept separate from `claims` so an undo
  // restores the row without refetching.
  const [retracted, setRetracted] = useState<Set<string>>(new Set());

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let current = true;
    setFailed(false);
    void (async () => {
      try {
        const page = await listClaims(clientRef.current);
        if (!current) return;
        setClaims(page.claims);
      } catch {
        if (!current) return;
        setClaims(null);
        setFailed(true);
      }
    })();
    return () => {
      current = false;
    };
  }, [nonce]);

  const hide = useCallback((id: string, hidden: boolean) => {
    setRetracted((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const retract = useCallback(
    (claim: KnowledgeClaim) => {
      triggerHaptic('forget-place');
      hide(claim.id, true);

      let undone = false;
      const timer = setTimeout(() => {
        if (undone) return;
        retractClaim(clientRef.current, claim.id).catch(() => {
          // Put it back and say so — a note the user believes is gone but isn't
          // is worse than the failure itself.
          hide(claim.id, false);
          toast.show({ tone: 'danger', icon: 'alert', text: t('myClaims.toast.removeFailed') });
        });
      }, RETRACT_UNDO_MS);

      toast.show({
        tone: 'danger',
        icon: 'trash',
        text: t('myClaims.toast.removed'),
        action: {
          label: t('toast.undo'),
          onPress: () => {
            undone = true;
            clearTimeout(timer);
            triggerHaptic('toast-undo');
            hide(claim.id, false);
          },
        },
      });
    },
    [hide, toast, t],
  );

  const state = useMemo<MyClaimsState>(() => {
    if (failed) return { status: 'failed' };
    if (claims === null) return { status: 'loading' };
    const visible = claims.filter((c) => !retracted.has(c.id));
    return { status: 'ready', groups: groupClaimsByAnchor(visible), total: visible.length };
  }, [claims, failed, retracted]);

  return { state, retract, reload };
}
