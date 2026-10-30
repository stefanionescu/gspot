import type { GRAMMAR_FENCE_PARSERS } from '#cli/config/checks/language/markdown.ts';

export type FormatFenceParser = 'json' | 'jsonc' | 'toml' | 'yaml';

export type GrammarFenceParser = (typeof GRAMMAR_FENCE_PARSERS)[number];

export type FenceParser = FormatFenceParser | GrammarFenceParser;

export type FenceSyntaxError = { line: number; message: string };
