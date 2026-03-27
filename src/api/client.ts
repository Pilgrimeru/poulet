const API_BASE = process.env["API_URL"] ?? "http://localhost:3000/api";
const INTERNAL_API_SECRET = process.env["DASHBOARD_INTERNAL_API_SECRET"] ?? process.env["TOKEN"];

function createHeaders(contentType = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = "application/json";
  if (INTERNAL_API_SECRET) headers["x-dashboard-internal-secret"] = INTERNAL_API_SECRET;
  return headers;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: createHeaders() });
  if (!res.ok) throw new Error(`API GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T = void>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: createHeaders(true),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API POST ${path} failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiPut<T = void>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: createHeaders(true),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API PUT ${path} failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: createHeaders(true),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API PATCH ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiDelete<T = void>(path: string, params?: Record<string, string>): Promise<T> {
  const url = params
    ? `${API_BASE}${path}?${new URLSearchParams(params).toString()}`
    : `${API_BASE}${path}`;
  const res = await fetch(url, { method: "DELETE", headers: createHeaders() });
  if (!res.ok) throw new Error(`API DELETE ${path} failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
