import { Capacitor } from "@capacitor/core";
import { FetchClient } from "../api/transports/fetch.transport";
import type { DataScope, UserContextResponse } from "@kebi-app/shared";

export interface UserClient {
  getUserContext(): Promise<UserContextResponse>;
  /**
   * Delete AI-owned user data. Pass `scope="chat_history"` to clear only
   * the LangGraph chat thread + pending taste-regen task (saves remain).
   * Omit to wipe everything (used by full account-delete).
   */
  deleteUserData(scope?: DataScope): Promise<void>;
}

const FIXTURE_RESPONSE: UserContextResponse = {
  saved_places_count: 0,
  signal_tier: "active",
  chips: [],
  plan: null,
};

function makeRealUserClient(getToken: () => Promise<string>): UserClient {
  const apiBase = Capacitor.isNativePlatform()
    ? (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/v1\/?$/, "")
    : "";
  const http = new FetchClient(apiBase, getToken);

  return {
    getUserContext: () => http.get<UserContextResponse>(`/api/v1/user/context`),
    deleteUserData: (scope) => {
      const path = scope
        ? `/api/v1/user/data?scope=${encodeURIComponent(scope)}`
        : `/api/v1/user/data`;
      return http.delete(path);
    },
  };
}

export function getUserClient(getToken: () => Promise<string>): UserClient {
  if (process.env.NEXT_PUBLIC_CHAT_FIXTURES === "true") {
    return {
      getUserContext: async () => FIXTURE_RESPONSE,
      deleteUserData: async () => {
        /* fixture no-op */
      },
    };
  }
  return makeRealUserClient(getToken);
}
