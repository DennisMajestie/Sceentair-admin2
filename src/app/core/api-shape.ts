/**
 * The API is inconsistent about list envelopes: some endpoints return
 * `{ data, total }` while others return a bare array. Normalising on the
 * client keeps list screens from crashing when the two drift.
 */
export interface ApiList<T> {
  data: T[];
  total: number;
}

export function normalizeList<T>(result: ApiList<T> | T[] | null | undefined): ApiList<T> {
  if (Array.isArray(result)) return { data: result, total: result.length };
  if (result && Array.isArray(result.data)) {
    return { data: result.data, total: result.total ?? result.data.length };
  }
  return { data: [], total: 0 };
}

export function unwrapArray<T>(result: T[] | ApiList<T> | null | undefined): T[] {
  return normalizeList<T>(result).data;
}
