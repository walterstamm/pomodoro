"use client";

let refreshPromise: Promise<Response> | null = null;

export const apiFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  refreshPromise ??= fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }).finally(() => {
    refreshPromise = null;
  });

  const refreshResponse = await refreshPromise;
  if (!refreshResponse.ok) return response;
  return fetch(input, init);
};
