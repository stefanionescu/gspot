/** A parsed Wrangler object, or the diagnostic that prevented parsing it. */
export type WranglerParse =
    | { table: Record<string, unknown>; problem: undefined }
    | { table: undefined; problem: string };
