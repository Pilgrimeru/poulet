const BASE = process.env["NEXT_PUBLIC_API_BASE_URL"] ?? "";

const inFlightGets = new Map<string, Promise<unknown>>();

export async function getJson<T>(path: string): Promise<T> {
  const url = `${BASE}${path}`;
  const existing = inFlightGets.get(url);
  if (existing !== undefined) {
    return existing as Promise<T>;
  }

  const request = fetch(url)
    .then(async (res) => {
      if (res.status === 401 && typeof window !== "undefined") {
        const nextPath = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
        throw new Error(`Unauthorized: ${path}`);
      }

      if (!res.ok) {
        throw new Error(`API error ${res.status}: ${path}`);
      }

      return res.json() as Promise<T>;
    })
    .finally(() => {
      if (inFlightGets.get(url) === request) {
        inFlightGets.delete(url);
      }
    });

  inFlightGets.set(url, request);
  return request;
}
