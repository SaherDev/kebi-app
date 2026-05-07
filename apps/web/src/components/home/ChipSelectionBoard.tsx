'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import type { ChipItem, ChipStatus } from '@kebi-app/shared';
import { Illustration } from '@/components/illustrations/Illustration';

interface ChipSelectionBoardProps {
  chips: ChipItem[];
  onConfirm: (chips: ChipItem[]) => void;
  onSkip: () => void;
}

function Chip({ chip, status, onConfirm, onReject }: {
  chip: ChipItem;
  status: ChipStatus;
  onConfirm: () => void;
  onReject: () => void;
}) {
  if (status === 'confirmed') {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-2 text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-200">
        {chip.label}
        <Check className="h-3.5 w-3.5 text-green-700 dark:text-green-300" strokeWidth={2.5} />
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="flex items-center rounded-full border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground/50">
        {chip.label}
      </div>
    );
  }

  // pending — show both buttons
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2">
      <span className="text-sm text-foreground">{chip.label}</span>
      <button
        onClick={onConfirm}
        aria-label={`Confirm ${chip.label}`}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-80"
      >
        <Check className="h-3 w-3" strokeWidth={2.5} />
      </button>
      <button
        onClick={onReject}
        aria-label={`Reject ${chip.label}`}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted"
      >
        <X className="h-3 w-3" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function ChipSelectionBoard({ chips, onConfirm, onSkip }: ChipSelectionBoardProps) {
  const t = useTranslations('chipSelection');
  const currentRound = useMemo(
    () => chips.find((c) => c.status === 'pending')?.selection_round ?? null,
    [chips],
  );

  const actionable = useMemo(
    () => chips.filter((c) => c.status === 'pending' && c.selection_round === currentRound),
    [chips, currentRound],
  );

  // Start all pending — user decides each one
  const [decisions, setDecisions] = useState<Record<string, ChipStatus>>(() =>
    Object.fromEntries(actionable.map((c) => [c.label, 'pending' as ChipStatus])),
  );

  function handleConfirm() {
    // Only explicitly confirmed chips get confirmed; pending + rejected → rejected
    const decided = actionable.map((c) => ({
      ...c,
      status: decisions[c.label] === 'confirmed' ? 'confirmed' : 'rejected',
    })) as ChipItem[];
    onConfirm(decided);
  }

  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <Illustration id="knowing" className="h-24 w-24" />

      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-foreground">Your taste profile is ready.</h2>
        <p className="text-sm text-muted-foreground">Is this you? Confirm or correct.</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {actionable.map((chip) => (
          <Chip
            key={chip.label}
            chip={chip}
            status={decisions[chip.label] ?? 'pending'}
            onConfirm={() => setDecisions((p) => ({ ...p, [chip.label]: 'confirmed' }))}
            onReject={() => setDecisions((p) => ({ ...p, [chip.label]: 'rejected' }))}
          />
        ))}
      </div>

      <button
        onClick={handleConfirm}
        className="w-full max-w-xs rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {t('done')}
      </button>
    </div>
  );
}
