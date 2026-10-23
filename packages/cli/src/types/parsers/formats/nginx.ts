/** One token of an nginx configuration, or none, and the index past it. */
export type DirectiveScan = { token: string | undefined; end: number };
