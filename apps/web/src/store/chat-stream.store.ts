'use client';

import { create } from 'zustand';
import type { SseEvent } from '@kebi-app/shared';

type StreamPhase = 'idle' | 'streaming' | 'done' | 'stopped' | 'error';

interface ChatStreamState {
  phase: StreamPhase;
  events: SseEvent[];
  error: string | null;

  startStream: () => void;
  pushEvent: (event: SseEvent) => void;
  stop: () => void;
  complete: () => void;
  fail: (error: string) => void;
  reset: () => void;
}

export const useChatStreamStore = create<ChatStreamState>((set) => ({
  phase: 'idle',
  events: [],
  error: null,

  startStream: () => set({ phase: 'streaming', events: [], error: null }),
  pushEvent: (event) => set((s) => ({ events: [...s.events, event] })),
  stop: () => set({ phase: 'stopped' }),
  complete: () => set({ phase: 'done' }),
  fail: (error) => set({ phase: 'error', error }),
  reset: () => set({ phase: 'idle', events: [], error: null }),
}));
