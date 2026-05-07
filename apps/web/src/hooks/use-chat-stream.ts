"use client";

import type {
  SignalTier,
  SseDone,
  SseError,
  SseEvent,
  SseMessage,
  SseReasoningStep,
  SseToolResult,
} from "@kebi-app/shared";
import { useCallback, useEffect, useRef } from "react";

import { Capacitor } from "@capacitor/core";
import { FetchClient } from "../api/transports/fetch.transport";
import { useAuth } from "@clerk/nextjs";
import { useChatStreamStore } from "../store/chat-stream.store";

interface UseChatStreamOptions {
  signalTier?: SignalTier | null;
  onComplete?: () => void;
  onError?: (msg: string) => void;
  onStop?: () => void;
}

export function useChatStream(
  message: string | null,
  options: UseChatStreamOptions = {},
): { stop: () => void } {
  const { getToken } = useAuth();
  const store = useChatStreamStore();
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null,
  );
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stop = useCallback(() => {
    readerRef.current?.cancel().catch(() => undefined);
    readerRef.current = null;
    store.stop();
    optionsRef.current.onStop?.();
  }, [store]);

  useEffect(() => {
    if (!message) return;

    let cancelled = false;

    async function run() {
      store.startStream();

      const apiBase = Capacitor.isNativePlatform()
        ? (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/v1\/?$/, "")
        : "";
      const client = new FetchClient(apiBase, async () => {
        const token = await getToken();
        return token ?? "";
      });

      let response: Response;
      try {
        response = await client.postStream("/api/v1/chat", {
          message,
          ...(optionsRef.current.signalTier != null
            ? { signal_tier: optionsRef.current.signalTier }
            : {}),
        });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        store.fail(msg);
        optionsRef.current.onError?.(msg);
        return;
      }

      if (!response.ok) {
        if (cancelled) return;
        let msg = `HTTP ${response.status}`;
        try {
          const body = (await response.json()) as Record<string, unknown>;
          if (body.error === "rate_limit_exceeded") {
            msg = `rate_limit_exceeded:${body.limit ?? ""}:${body.limit_value ?? ""}`;
          } else if (typeof body.error === "string") {
            msg = body.error;
          }
        } catch {
          /* ignore parse errors */
        }
        store.fail(msg);
        optionsRef.current.onError?.(msg);
        return;
      }

      if (!response.body) {
        if (cancelled) return;
        store.fail("No response body");
        optionsRef.current.onError?.("No response body");
        return;
      }

      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEventName = "message";

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done || cancelled) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE lines are separated by '\n'. A blank line ends an event.
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              currentEventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              const dataStr = line.slice(5).trim();
              let parsed: unknown;
              try {
                parsed = JSON.parse(dataStr);
              } catch {
                continue;
              }

              const event = buildEvent(currentEventName, parsed);
              if (event) {
                store.pushEvent(event);
                if (event.type === "done") {
                  store.complete();
                  optionsRef.current.onComplete?.();
                } else if (event.type === "error") {
                  store.fail(event.data.detail);
                  optionsRef.current.onError?.(event.data.detail);
                }
              }
              // Reset event name after data line
              currentEventName = "message";
            }
          }
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        store.fail(msg);
        optionsRef.current.onError?.(msg);
      } finally {
        readerRef.current = null;
      }
    }

    void run();

    return () => {
      cancelled = true;
      readerRef.current?.cancel().catch(() => undefined);
      readerRef.current = null;
    };
  }, [message]); // intentional: only re-run when the message changes

  return { stop };
}

function buildEvent(eventName: string, data: unknown): SseEvent | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  switch (eventName) {
    case "reasoning_step":
      return { type: "reasoning_step", data: d as unknown as SseReasoningStep };
    case "tool_result":
      return { type: "tool_result", data: d as unknown as SseToolResult };
    case "message":
      return { type: "message", data: d as unknown as SseMessage };
    case "done":
      return { type: "done", data: d as unknown as SseDone };
    case "error":
      return { type: "error", data: d as unknown as SseError };
    default:
      return null;
  }
}
