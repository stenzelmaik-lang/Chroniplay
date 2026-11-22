"use client";

import type { ApiResult } from "@/domain/legacy";
// Explicit extension so the transport behaviour is testable under Node's type stripping (tests/p1-scene-performance).
import { purgeProtectedPlayerData } from "./player-data-cache.ts";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Reads stop waiting after this long, so polling guards ("in flight") are released and the next tick retries.
 * Writes keep the browser's own timeout: aborting a save midway would leave its outcome unknown. */
export const API_READ_TIMEOUT_MS = 45_000;
/** Status 0 marks a transport problem (timeout, interrupted or unreadable answer); callers retry instead of
 * treating it as a decision of the server. */
export const API_TRANSPORT_ERROR = 0;

async function send(url: string, method: string, body: unknown, headers: Record<string, string> = {}) {
  try {
    return await fetch(url, {
      method,
      cache: "no-store",
      headers: body instanceof FormData ? headers : body ? { ...headers, "Content-Type": "application/json" } : headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      ...(method === "GET" && typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? { signal: AbortSignal.timeout(API_READ_TIMEOUT_MS) } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError"))
      throw new ApiError("Der Server antwortet gerade nicht rechtzeitig. Bitte erneut versuchen; es wurde nichts verändert.", API_TRANSPORT_ERROR);
    throw error;
  }
}

async function read<T>(r: Response): Promise<T> {
  let data: unknown, unreadable = false;
  try { data = await r.json(); } catch { unreadable = true; }
  if (!r.ok) {
    if ([401, 403, 404].includes(r.status)) purgeProtectedPlayerData();
    throw new ApiError(
      unreadable ? "Die Antwort konnte nicht gelesen werden." : data && typeof data === "object" && "error" in data ? String(data.error) : "Bitte erneut versuchen.",
      r.status,
    );
  }
  // An interrupted or truncated answer is an error, never a silently empty or partial view (P1 2026-11-22).
  if (unreadable) throw new ApiError("Die Antwort wurde unvollständig übertragen. Bitte erneut versuchen.", API_TRANSPORT_ERROR);
  return data as T;
}

export async function api<T = ApiResult>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  return read<T>(await send(url, method, body));
}

/** Polling read: sends the last ETag and resolves to null when the server answers 304 (nothing changed),
 * so an unchanged view is neither downloaded again nor re-rendered. */
export async function apiIfChanged<T = ApiResult>(url: string, tag: { current: string }): Promise<T | null> {
  const r = await send(url, "GET", undefined, tag.current ? { "If-None-Match": tag.current } : {});
  if (r.status === 304) return null;
  const data = await read<T>(r);
  tag.current = r.headers.get("ETag") || "";
  return data;
}
