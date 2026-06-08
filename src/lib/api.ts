import { NextResponse } from "next/server";

/** JSON response with no-store caching (live data). */
export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function serverError(message = "Internal error") {
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Wrap a route handler with a try/catch that returns a 500 instead of crashing. */
export async function handle<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    const data = await fn();
    return json(data);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Internal error");
  }
}
