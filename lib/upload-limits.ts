/**
 * How large an uploaded statement may be.
 *
 * The ceiling is the platform's, not ours: Vercel caps a function's request
 * body at 4.5 MB and rejects anything larger with 413
 * FUNCTION_PAYLOAD_TOO_LARGE before our code ever runs. That cap is the same on
 * Hobby and Pro, so there is no plan to upgrade out of it.
 *
 * 4 MB rather than 4.5 leaves room for multipart overhead — the request carries
 * field boundaries and headers around the file, so a file at exactly the cap
 * would push the body over it.
 *
 * This is the single source of truth: next.config.ts configures the Server
 * Action limit from it and the import form quotes it to the user, so the
 * enforced limit and the advertised one cannot drift apart.
 */
export const MAX_UPLOAD_MB = 4;

export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** The `serverActions.bodySizeLimit` format Next expects. */
export const MAX_UPLOAD_BODY_LIMIT = `${MAX_UPLOAD_MB}mb` as const;
