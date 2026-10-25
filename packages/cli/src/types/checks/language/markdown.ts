import type { FORMAT_FENCE_PARSERS, GRAMMAR_FENCE_PARSERS } from '#cli/config/checks/language/markdown.ts';

export type FormatFenceParser = (typeof FORMAT_FENCE_PARSERS)[number];

export type GrammarFenceParser = (typeof GRAMMAR_FENCE_PARSERS)[number];

export type FenceParser = FormatFenceParser | GrammarFenceParser;

export type FenceSyntaxError = { line: number; message: string };
