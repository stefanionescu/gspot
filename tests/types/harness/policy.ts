import type { Level } from '#cli/types/rules.ts';

/** Authored policy choices for a fixture; absent values keep the public policy defaults. */
export type PolicyOptions = { level?: Level; tables?: string };
