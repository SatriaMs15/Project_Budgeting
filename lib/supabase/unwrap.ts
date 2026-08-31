/**
 * supabase-js never throws — every call resolves to `{ data, error }`. Code that
 * destructures only `data` turns a failed query into an empty array, which the
 * UI then renders as a friendly "nothing here yet" screen. That is how a missing
 * migration stayed invisible for weeks: `/goals` looked empty when the table did
 * not exist at all.
 *
 * These helpers convert a query error into a thrown error so the nearest
 * `error.tsx` boundary can tell the user something is actually broken.
 */

/** Structural shape of a PostgrestError — kept local so this file has no imports. */
type QueryError = {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

/** Extra context for the failures we can actually recognize. */
function explain(error: QueryError): string {
  switch (error.code) {
    case "PGRST205":
      return "The table is missing, or PostgREST's schema cache is stale. Check the migrations have been applied, then run: notify pgrst, 'reload schema';";
    case "42501":
      return "Row Level Security rejected this. The request may have no signed-in user attached.";
    case "PGRST301":
      return "The auth token was rejected or has expired.";
    default:
      return error.hint ?? "";
  }
}

export class DataError extends Error {
  readonly code: string | null;

  constructor(what: string, error: QueryError) {
    const code = error.code ?? null;
    const extra = explain(error);
    super(
      `Could not ${what}: ${error.message}` +
        (code ? ` [${code}]` : "") +
        (extra ? ` — ${extra}` : ""),
    );
    this.name = "DataError";
    this.code = code;
  }
}

/**
 * Return the rows from a Supabase query, throwing if it failed.
 * `what` completes the sentence "Could not ..." — e.g. "load transactions".
 */
/**
 * Supabase returns a discriminated union: on success `error` is null and `data`
 * is populated; on failure `data` is null and `error` is set. Inferring a plain
 * `T` from that union collapses to `never`, so instead we infer the whole
 * response and pick the data off its success branch. Conditional types
 * distribute over the union, so the failure branch contributes `never` and
 * drops out — leaving the return type the query actually implies: `Row[]` for a
 * list select, `Row | null` for `.maybeSingle()`.
 */
type SuccessData<R> = R extends { error: null; data: infer D } ? D : never;

/**
 * Return the data from a Supabase query, throwing if it failed.
 * `what` completes the sentence "Could not ..." — e.g. "load transactions".
 */
export function unwrap<R extends { data: unknown; error: QueryError | null }>(
  result: R,
  what: string,
): SuccessData<R> {
  if (result.error) throw new DataError(what, result.error);
  return result.data as SuccessData<R>;
}

/** Throw if a write failed. For inserts/updates/deletes with no returned rows. */
export function assertOk(
  result: { error: QueryError | null },
  what: string,
): void {
  if (result.error) throw new DataError(what, result.error);
}
