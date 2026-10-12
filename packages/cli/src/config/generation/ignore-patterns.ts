import { DOT_GSPOT } from '#cli/config/system/locations.ts';

export const ALWAYS_IGNORED = [`${DOT_GSPOT}/**`] as const;
export const BRACE_TOKENS = /\\[\s\S]|\[(?:\\[\s\S]|[^\]\\])*\]?|[{},]/gu;
