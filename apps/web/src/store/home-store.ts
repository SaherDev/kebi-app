"use client";

import type {
  ChipItem,
  ClientIntent,
  ConsultResponseData,
  ExtractPlaceItem,
  ReasoningStep,
  RecallResponseData,
  RecallResult,
  SavedPlaceStub,
  SignalTier,
} from "@kebi-app/shared";
import type { FlowId, HomePhase } from "../flows/flow-definition";
import {
  appendSavedPlace,
  clearSavedPlaces,
  getSavedPlaceCount,
  incrementSavedPlaceCount,
} from "../storage/saved-places-storage";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  clearTasteProfileConfirmed,
  getTasteProfileConfirmed,
  setTasteProfileConfirmed,
} from "../storage/taste-profile-storage";

import { FLOW_BY_CLIENT_INTENT } from "../flows/registry";
import { classifyIntent } from "../lib/classify-intent";
import { create } from "zustand";
import { getSignalClient } from "../lib/signal-client";
import { getUserClient } from "../lib/user-client";
import { useChatStreamStore } from "./chat-stream.store";

// ── Thread entry types ─────────────────────────────────────────────────────────
export type ThreadEntry =
  | { id: string; role: "user"; content: string }
  | {
      id: string;
      role: "assistant";
      type: "clarification";
      message: string;
      dismissed?: boolean;
    }
  | {
      id: string;
      role: "assistant";
      type: "assistant";
      message: string;
      dismissed?: boolean;
    }
  | {
      id: string;
      role: "assistant";
      type: "consult";
      message: string;
      data: ConsultResponseData;
    }
  | {
      id: string;
      role: "assistant";
      type: "save";
      item: ExtractPlaceItem;
      sourceUrl: string | null;
    }
  | {
      id: string;
      role: "assistant";
      type: "recall";
      message: string;
      data: RecallResponseData;
    }
  | {
      id: string;
      role: "assistant";
      type: "reasoning";
      steps: import("@kebi-app/shared").SseReasoningStep[];
    }
  | {
      id: string;
      role: "assistant";
      type: "error";
      category: "offline" | "timeout" | "generic" | "server" | "rate_limit";
      message?: string;
      rateLimitInfo?: RateLimitInfo;
      flowId?: FlowId;
    };

export interface RateLimitInfo {
  limit: "turns_per_session" | "sessions_per_day" | "tool_calls_per_day";
  limit_value: number;
}

interface HomeState {
  // Phase
  phase: HomePhase;
  activeFlowId: FlowId | null;

  // Auth (seeded from Clerk via init())
  userId: string | null;
  getToken: (() => Promise<string>) | null;

  // Query state
  query: string | null;
  streamingMessage: string | null;
  result: ConsultResponseData | null;
  reasoningSteps: ReasoningStep[];
  error: {
    message: string;
    category: "offline" | "timeout" | "generic" | "server" | "rate_limit";
    rateLimitInfo?: RateLimitInfo;
  } | null;

  // Hydration
  hydrated: boolean;
  tasteProfileConfirmed: boolean;
  savedPlaceCount: number;

  abortController: AbortController | null;

  // Chat thread
  thread: ThreadEntry[];

  // Flow-specific slots
  recallResults: RecallResult[] | null;
  recallTotalCount: number;
  recallQuery: string | null;
  recallBreadcrumb: boolean;
  saveSheetPlaces: ExtractPlaceItem[];
  saveSheetSourceUrl: string | null;
  saveSheetSelectedIndex: number;
  saveSheetMessage: string | null;
  saveSheetStatus: "pending" | "saving" | "duplicate" | "error";
  saveSheetOriginalSavedAt: string | null;
  preSavePhase: HomePhase | null;
  assistantMessage: string | null;
  clarificationMessage: string | null;

  // User context / tier state
  signalTier: SignalTier | null;
  chips: ChipItem[];
  savedPlacesCountFromContext: number | null;
  contextLoading: boolean;

  // Actions
  hydrate: () => void;
  init: (opts: {
    userId: string | null;
    getToken: () => Promise<string>;
  }) => void;
  setUserId: (id: string | null) => void;
  loadUserContext: () => Promise<void>;
  submit: (
    message: string,
    opts?: { forceIntent?: ClientIntent; isRetry?: boolean },
  ) => void;
  clearStream: () => void;
  clearThread: () => void;
  clearAllUserData: () => Promise<void>;
  confirmTasteProfile: () => void;
  reset: () => void;

  setRecallResults: (results: RecallResult[], totalCount: number) => void;
  openSaveSheet: (
    message: string,
    places: ExtractPlaceItem[],
    sourceUrl: string | null,
  ) => void;
  setSaveSheetSelectedIndex: (index: number) => void;
  confirmSave: () => Promise<void>;
  confirmPlaceSelection: () => void;
  saveIndividualFromSheet: (item: ExtractPlaceItem) => void;
  closeSaveSheetWithResults: (savedItems: ExtractPlaceItem[]) => void;
  dismissSaveSheet: () => void;
  dismissAssistantReply: () => void;
  incrementSavedCount: (place: SavedPlaceStub) => void;
  autoSavePlace: (item: ExtractPlaceItem, sourceUrl: string | null) => void;
  pushMessage: (message: string) => void;
  pushRecallResults: (message: string, data: RecallResponseData) => void;

  // Signal actions (fire-and-forget)
  acceptPlace: (recommendationId: string, placeId: string) => Promise<void>;
  rejectPlace: (recommendationId: string, placeId: string) => Promise<void>;
  confirmChips: (decidedChips: ChipItem[]) => Promise<void>;
}

export type HomeStoreApi = HomeState;

function pickRestingPhase(
  savedPlaceCount: number,
  tasteProfileConfirmed: boolean,
  signalTier: SignalTier | null,
): HomePhase {
  // Chip-selection is the only gated phase — skip if already confirmed locally
  if (signalTier === "chip_selection" && !tasteProfileConfirmed)
    return "chip-selection";
  // Taste-profile celebration shown once after reaching threshold (count-based fallback only)
  if (signalTier === null && savedPlaceCount >= 5 && !tasteProfileConfirmed)
    return "taste-profile";
  return "idle";
}

let entryCounter = 0;
function nextId() {
  return `e-${Date.now()}-${++entryCounter}`;
}

const THREAD_STORAGE_KEY = "kebi-app.thread";

export function clearPersistedThread() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(THREAD_STORAGE_KEY);
  }
}

export const useHomeStore = create<HomeState>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────────────
      phase: "hydrating",
      activeFlowId: null,
      userId: null,
      getToken: null,
      query: null,
      streamingMessage: null,
      result: null,
      reasoningSteps: [],
      error: null,
      hydrated: false,
      tasteProfileConfirmed: false,
      savedPlaceCount: 0,
      abortController: null,
      thread: [],
      recallResults: null,
      recallTotalCount: 0,
      recallQuery: null,
      recallBreadcrumb: false,
      saveSheetPlaces: [],
      saveSheetSourceUrl: null,
      saveSheetSelectedIndex: 0,
      saveSheetMessage: null,
      saveSheetStatus: "pending",
      saveSheetOriginalSavedAt: null,
      preSavePhase: null,
      assistantMessage: null,
      clarificationMessage: null,
      signalTier: null,
      chips: [],
      savedPlacesCountFromContext: null,
      contextLoading: false,

      // ── hydrate ────────────────────────────────────────────────────────────────
      hydrate: () => {
        const savedPlaceCount = getSavedPlaceCount();
        const tasteProfileConfirmed = getTasteProfileConfirmed();
        const phase = pickRestingPhase(
          savedPlaceCount,
          tasteProfileConfirmed,
          null,
        );
        set({ phase, savedPlaceCount, tasteProfileConfirmed, hydrated: true });
      },

      // ── init ───────────────────────────────────────────────────────────────────
      init: ({ userId, getToken }) => {
        const prevUserId = get().userId;
        if (userId && prevUserId && userId !== prevUserId) {
          // Different user — clear the persisted thread
          set({ thread: [], userId, getToken });
        } else {
          set({ userId, getToken });
        }
        void get().loadUserContext();
      },

      // ── setUserId ──────────────────────────────────────────────────────────────
      setUserId: id => {
        set({ userId: id });
      },

      // ── loadUserContext ────────────────────────────────────────────────────────
      loadUserContext: async () => {
        const {
          getToken,
          savedPlaceCount,
          tasteProfileConfirmed,
          savedPlacesCountFromContext,
        } = get();
        const isFirstLoad = savedPlacesCountFromContext === null;
        if (isFirstLoad) set({ contextLoading: true });
        try {
          const client = getUserClient(getToken ?? (async () => ""));
          const ctx = await client.getUserContext();
          const signalTier = ctx.signal_tier;
          const phase = pickRestingPhase(
            savedPlaceCount,
            tasteProfileConfirmed,
            signalTier,
          );
          set({
            signalTier,
            chips: ctx.chips,
            savedPlacesCountFromContext: ctx.saved_places_count,
            phase,
            contextLoading: false,
          });
        } catch {
          // Silently fall back — pickRestingPhase uses count-based when signalTier is null
          set({ contextLoading: false });
        }
      },

      // ── submit ─────────────────────────────────────────────────────────────────
      submit: (message, opts) => {
        const { thread } = get();

        get().dismissAssistantReply();
        get().abortController?.abort();
        const abortController = new AbortController();

        const intent: ClientIntent =
          opts?.forceIntent ?? classifyIntent(message);

        const preFlow = FLOW_BY_CLIENT_INTENT[intent];
        const initialFlowId: FlowId = preFlow?.id ?? "consult";
        const initialPhase = preFlow?.phase ?? "thinking";

        let newThread: ThreadEntry[];
        if (opts?.isRetry) {
          const last = thread[thread.length - 1];
          newThread =
            last?.role === "assistant" && last?.type === "error"
              ? thread.slice(0, -1)
              : thread;
        } else {
          const userEntry: ThreadEntry = {
            id: nextId(),
            role: "user",
            content: message,
          };
          // Drop any trailing error entries so "Try again" disappears on new message
          const trimmed = [...thread];
          while (
            trimmed.length > 0 &&
            trimmed[trimmed.length - 1].role === "assistant" &&
            (trimmed[trimmed.length - 1] as { type: string }).type === "error"
          ) {
            trimmed.pop();
          }
          newThread = [...trimmed, userEntry];
        }

        set({
          thread: newThread,
          phase: initialPhase,
          activeFlowId: initialFlowId,
          query: message,
          streamingMessage: message,
          result: null,
          reasoningSteps: [],
          error: null,
          clarificationMessage: null,
          abortController,
        });
      },

      // ── clearStream ────────────────────────────────────────────────────────────
      clearStream: () => {
        const { savedPlaceCount, tasteProfileConfirmed, signalTier, thread } =
          get();
        const { events, error: streamError } = useChatStreamStore.getState();

        // Convert SSE events into persistent thread entries
        const newEntries: ThreadEntry[] = [];
        const messageEvent = events.find(e => e.type === "message");
        const messageText =
          messageEvent?.type === "message" ? messageEvent.data.content : "";
        const toolResults = events.filter(e => e.type === "tool_result");
        const errorEvent = events.find(e => e.type === "error");
        const reasoningSteps = events
          .filter(e => e.type === "reasoning_step")
          .map(e => (e.type === "reasoning_step" ? e.data : null))
          .filter(s => s!.visibility !== "debug")
          .filter(
            s => s!.step !== "agent.tool_decision",
          ) as import("@kebi-app/shared").SseReasoningStep[];

        if (reasoningSteps.length > 0) {
          newEntries.push({
            id: nextId(),
            role: "assistant",
            type: "reasoning",
            steps: reasoningSteps,
          });
        }

        // HTTP-level error (e.g. rate limit) — streamError set but no SSE error event
        const isRateLimit = streamError?.startsWith("rate_limit_exceeded");
        const isHttpError = streamError && !errorEvent;

        if (errorEvent && errorEvent.type === "error") {
          newEntries.push({
            id: nextId(),
            role: "assistant",
            type: "error",
            category: "server",
            message: errorEvent.data.detail,
          });
        } else if (isHttpError) {
          if (isRateLimit) {
            const parts = streamError.split(":");
            newEntries.push({
              id: nextId(),
              role: "assistant",
              type: "error",
              category: "rate_limit",
              rateLimitInfo: {
                limit: (parts[1] ??
                  "turns_per_session") as RateLimitInfo["limit"],
                limit_value: Number(parts[2] ?? 10),
              },
            });
          } else {
            newEntries.push({
              id: nextId(),
              role: "assistant",
              type: "error",
              category: "server",
              message: streamError,
            });
          }
        } else {
          const consultResult = toolResults.find(
            e => e.type === "tool_result" && e.data.tool === "consult",
          );
          const recallResult = toolResults.find(
            e => e.type === "tool_result" && e.data.tool === "recall",
          );
          const saveResult = toolResults.find(
            e => e.type === "tool_result" && e.data.tool === "save",
          );

          if (
            consultResult &&
            consultResult.type === "tool_result" &&
            consultResult.data.payload
          ) {
            newEntries.push({
              id: nextId(),
              role: "assistant",
              type: "consult",
              message: messageText,
              data: consultResult.data
                .payload as unknown as ConsultResponseData,
            });
          } else if (
            recallResult &&
            recallResult.type === "tool_result" &&
            recallResult.data.payload
          ) {
            newEntries.push({
              id: nextId(),
              role: "assistant",
              type: "recall",
              message: messageText,
              data: recallResult.data.payload as unknown as RecallResponseData,
            });
          } else if (
            saveResult &&
            saveResult.type === "tool_result" &&
            saveResult.data.payload
          ) {
            const payload = saveResult.data.payload as unknown as {
              results?: ExtractPlaceItem[];
              raw_input?: string;
            };
            const items = payload.results ?? [];
            for (const item of items) {
              newEntries.push({
                id: nextId(),
                role: "assistant",
                type: "save",
                item,
                sourceUrl: payload.raw_input ?? null,
              });
            }
            if (messageText) {
              newEntries.push({
                id: nextId(),
                role: "assistant",
                type: "assistant",
                message: messageText,
              });
            }
          } else if (messageText) {
            newEntries.push({
              id: nextId(),
              role: "assistant",
              type: "assistant",
              message: messageText,
            });
          }
        }

        useChatStreamStore.getState().reset();
        set({
          streamingMessage: null,
          phase: pickRestingPhase(
            savedPlaceCount,
            tasteProfileConfirmed,
            signalTier,
          ),
          activeFlowId: null,
          thread: newEntries.length > 0 ? [...thread, ...newEntries] : thread,
        });
      },

      // ── confirmTasteProfile ────────────────────────────────────────────────────
      confirmTasteProfile: () => {
        setTasteProfileConfirmed();
        set({ tasteProfileConfirmed: true, phase: "idle" });
      },

      // ── reset ──────────────────────────────────────────────────────────────────
      reset: () => {
        const { savedPlaceCount, tasteProfileConfirmed, signalTier } = get();
        const phase = pickRestingPhase(
          savedPlaceCount,
          tasteProfileConfirmed,
          signalTier,
        );
        set({
          phase,
          activeFlowId: null,
          query: null,
          streamingMessage: null,
          result: null,
          reasoningSteps: [],
          error: null,
          abortController: null,
          clarificationMessage: null,
        });
      },

      // ── clearAllUserData ───────────────────────────────────────────────────────
      // Wipes every server-side trace (AI-owned tables via DELETE /user/data)
      // and every client-side trace (persisted thread, saved places, taste
      // profile confirmation, chat stream buffer). Throws if the API call fails
      // so the caller can surface an error — local state is not touched until
      // the server confirms deletion.
      clearAllUserData: async () => {
        const { getToken } = get();
        const client = getUserClient(getToken ?? (async () => ""));
        await client.deleteUserData();

        get().abortController?.abort();
        useChatStreamStore.getState().reset();
        clearPersistedThread();
        clearSavedPlaces();
        clearTasteProfileConfirmed();

        set({
          thread: [],
          streamingMessage: null,
          phase: "idle",
          activeFlowId: null,
          query: null,
          result: null,
          reasoningSteps: [],
          error: null,
          abortController: null,
          clarificationMessage: null,
          savedPlaceCount: 0,
          tasteProfileConfirmed: false,
          signalTier: null,
          chips: [],
          savedPlacesCountFromContext: null,
        });

        void get().loadUserContext();
      },

      // ── clearThread ────────────────────────────────────────────────────────────
      // Triggered by the X button. Clears local thread state immediately, then
      // wipes the server-side LangGraph checkpoint + pending taste-regen via
      // DELETE /api/v1/user/data?scope=chat_history. Fire-and-forget on the
      // server call so the UI is responsive — saves are unaffected by this scope.
      clearThread: () => {
        get().abortController?.abort();
        useChatStreamStore.getState().reset();
        const { savedPlaceCount, tasteProfileConfirmed, signalTier, getToken } = get();
        const phase = pickRestingPhase(
          savedPlaceCount,
          tasteProfileConfirmed,
          signalTier,
        );
        set({
          thread: [],
          streamingMessage: null,
          phase,
          activeFlowId: null,
          query: null,
          result: null,
          reasoningSteps: [],
          error: null,
          abortController: null,
          clarificationMessage: null,
        });
        const client = getUserClient(getToken ?? (async () => ""));
        void client.deleteUserData("chat_history").catch((err) => {
          console.warn("Failed to clear server chat history", err);
        });
        void get().loadUserContext();
      },

      // ── setRecallResults ───────────────────────────────────────────────────────
      setRecallResults: (results, totalCount) => {
        set({ recallResults: results, recallTotalCount: totalCount });
      },

      // ── openSaveSheet ──────────────────────────────────────────────────────────
      openSaveSheet: (message, places, sourceUrl) => {
        const { phase, activeFlowId } = get();
        const preSavePhase =
          phase !== "save-sheet" && phase !== "save-snackbar" ? phase : null;
        set({
          preSavePhase,
          saveSheetMessage: message,
          saveSheetPlaces: places,
          saveSheetSourceUrl: sourceUrl,
          saveSheetSelectedIndex: 0,
          saveSheetStatus: "pending",
          phase: "save-sheet",
          activeFlowId: activeFlowId !== "save" ? "save" : activeFlowId,
        });
      },

      // ── setSaveSheetSelectedIndex ──────────────────────────────────────────────
      setSaveSheetSelectedIndex: index => {
        set({ saveSheetSelectedIndex: index });
      },

      // ── confirmSave ────────────────────────────────────────────────────────────
      confirmSave: async () => {
        // Legacy action — kept for compatibility; new flow uses openSaveSheet + saveIndividualFromSheet
        set({ saveSheetStatus: "saving" });
        try {
          const { savedPlaceCount, tasteProfileConfirmed, signalTier } = get();
          const restingPhase = pickRestingPhase(
            savedPlaceCount,
            tasteProfileConfirmed,
            signalTier,
          );
          set({ phase: restingPhase, saveSheetStatus: "pending" });
        } catch {
          set({ saveSheetStatus: "error" });
        }
      },

      // ── confirmPlaceSelection ──────────────────────────────────────────────────
      confirmPlaceSelection: () => {
        const { saveSheetPlaces, saveSheetSelectedIndex, saveSheetSourceUrl } =
          get();
        const selectedItem = saveSheetPlaces[saveSheetSelectedIndex];
        if (!selectedItem?.place) return;

        const stub: SavedPlaceStub = {
          place_id: selectedItem.place.place_id,
          place_name: selectedItem.place.place_name,
          address: selectedItem.place.address ?? "",
          saved_at: new Date().toISOString(),
          source_url: saveSheetSourceUrl,
          thumbnail_url: selectedItem.place.photo_url ?? undefined,
        };
        get().incrementSavedCount(stub);
        const { savedPlaceCount, tasteProfileConfirmed, signalTier, thread } =
          get();
        const restingPhase = pickRestingPhase(
          savedPlaceCount,
          tasteProfileConfirmed,
          signalTier,
        );
        const entry: ThreadEntry = {
          id: nextId(),
          role: "assistant",
          type: "save",
          item: selectedItem,
          sourceUrl: saveSheetSourceUrl,
        };
        set({
          thread: [...thread, entry],
          phase: restingPhase,
          activeFlowId: null,
          saveSheetPlaces: [],
          saveSheetSelectedIndex: 0,
          saveSheetMessage: null,
          saveSheetStatus: "pending",
        });
      },

      // ── saveIndividualFromSheet ────────────────────────────────────────────────
      saveIndividualFromSheet: item => {
        if (!item.place) return;
        const stub: SavedPlaceStub = {
          place_id: item.place.place_id,
          place_name: item.place.place_name,
          address: item.place.address ?? "",
          saved_at: new Date().toISOString(),
          source_url: get().saveSheetSourceUrl,
          thumbnail_url: item.place.photo_url ?? undefined,
        };
        get().incrementSavedCount(stub);
      },

      // ── closeSaveSheetWithResults ──────────────────────────────────────────────
      closeSaveSheetWithResults: savedItems => {
        const {
          savedPlaceCount,
          tasteProfileConfirmed,
          signalTier,
          thread,
          saveSheetSourceUrl,
        } = get();
        const restingPhase = pickRestingPhase(
          savedPlaceCount,
          tasteProfileConfirmed,
          signalTier,
        );
        const newEntries: ThreadEntry[] = savedItems.map(item => ({
          id: nextId(),
          role: "assistant" as const,
          type: "save" as const,
          item,
          sourceUrl: saveSheetSourceUrl,
        }));
        set({
          thread: [...thread, ...newEntries],
          phase: restingPhase,
          activeFlowId: null,
          saveSheetPlaces: [],
          saveSheetSourceUrl: null,
          saveSheetSelectedIndex: 0,
          saveSheetMessage: null,
          saveSheetStatus: "pending",
        });
        void get().loadUserContext();
      },

      // ── dismissSaveSheet ───────────────────────────────────────────────────────
      dismissSaveSheet: () => {
        const {
          preSavePhase,
          savedPlaceCount,
          tasteProfileConfirmed,
          signalTier,
        } = get();
        const restorePhase =
          preSavePhase ??
          pickRestingPhase(savedPlaceCount, tasteProfileConfirmed, signalTier);
        set({
          phase: restorePhase,
          preSavePhase: null,
          saveSheetPlaces: [],
          saveSheetSourceUrl: null,
          saveSheetSelectedIndex: 0,
          saveSheetMessage: null,
          saveSheetStatus: "pending",
        });
      },

      // ── incrementSavedCount ────────────────────────────────────────────────────
      incrementSavedCount: place => {
        incrementSavedPlaceCount();
        appendSavedPlace(place);
        const newCount = getSavedPlaceCount();
        set({ savedPlaceCount: newCount });
      },

      // ── dismissAssistantReply ──────────────────────────────────────────────────
      dismissAssistantReply: () => {
        const { thread } = get();
        let found = false;
        for (let i = thread.length - 1; i >= 0 && !found; i--) {
          const entry = thread[i];
          if (
            entry.role === "assistant" &&
            (entry.type === "assistant" || entry.type === "clarification") &&
            !entry.dismissed
          ) {
            const newThread = thread.map((e, idx) =>
              idx === i ? { ...e, dismissed: true } : e,
            );
            set({ thread: newThread });
            found = true;
          }
        }
      },

      // ── autoSavePlace ──────────────────────────────────────────────────────────
      autoSavePlace: (item, sourceUrl) => {
        if (!item.place) return;
        const stub: SavedPlaceStub = {
          place_id: item.place.place_id,
          place_name: item.place.place_name,
          address: item.place.address ?? "",
          saved_at: new Date().toISOString(),
          source_url: sourceUrl,
          thumbnail_url: item.place.photo_url ?? undefined,
        };
        get().incrementSavedCount(stub);
        const { savedPlaceCount, tasteProfileConfirmed, signalTier, thread } =
          get();
        const restingPhase = pickRestingPhase(
          savedPlaceCount,
          tasteProfileConfirmed,
          signalTier,
        );
        const entry: ThreadEntry = {
          id: nextId(),
          role: "assistant",
          type: "save",
          item,
          sourceUrl,
        };
        set({
          thread: [...thread, entry],
          phase: restingPhase,
          activeFlowId: null,
        });
      },

      // ── pushMessage ────────────────────────────────────────────────────────────
      pushMessage: message => {
        const { savedPlaceCount, tasteProfileConfirmed, signalTier, thread } =
          get();
        const restingPhase = pickRestingPhase(
          savedPlaceCount,
          tasteProfileConfirmed,
          signalTier,
        );
        const entry: ThreadEntry = {
          id: nextId(),
          role: "assistant",
          type: "assistant",
          message,
        };
        set({
          thread: [...thread, entry],
          phase: restingPhase,
          activeFlowId: null,
        });
      },

      // ── pushRecallResults ──────────────────────────────────────────────────────
      pushRecallResults: (message, data) => {
        const { savedPlaceCount, tasteProfileConfirmed, signalTier, thread } =
          get();
        const restingPhase = pickRestingPhase(
          savedPlaceCount,
          tasteProfileConfirmed,
          signalTier,
        );
        const entry: ThreadEntry = {
          id: nextId(),
          role: "assistant",
          type: "recall",
          message,
          data,
        };
        set({
          thread: [...thread, entry],
          phase: restingPhase,
          activeFlowId: null,
        });
      },

      // ── acceptPlace ───────────────────────────────────────────────────────────
      acceptPlace: async (recommendationId, placeId) => {
        const { getToken } = get();
        const client = getSignalClient(getToken ?? (async () => ""));
        await client.acceptRecommendation(recommendationId, placeId);
        void get().loadUserContext();
      },

      // ── rejectPlace ───────────────────────────────────────────────────────────
      rejectPlace: async (recommendationId, placeId) => {
        const { getToken } = get();
        const client = getSignalClient(getToken ?? (async () => ""));
        await client.rejectRecommendation(recommendationId, placeId);
        void get().loadUserContext();
      },

      // ── confirmChips ──────────────────────────────────────────────────────────
      confirmChips: async decidedChips => {
        // Optimistic update
        set(s => ({
          chips: s.chips.map(c => {
            const decided = decidedChips.find(
              d =>
                d.label === c.label && d.selection_round === c.selection_round,
            );
            return decided ?? c;
          }),
        }));
        setTasteProfileConfirmed();
        set({ tasteProfileConfirmed: true });

        // Fire chip_confirm signal — local state already updated, so a failed
        // network call doesn't block the user from moving on.
        const { getToken } = get();
        const client = getSignalClient(getToken ?? (async () => ""));
        try {
          await client.confirmChips(decidedChips);
        } catch (err) {
          console.warn("[home-store] chip_confirm signal failed", err);
        }

        await get().loadUserContext();
      },
    }),
    {
      name: THREAD_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        thread: state.thread.slice(-30),
        userId: state.userId,
      }),
    },
  ),
);
