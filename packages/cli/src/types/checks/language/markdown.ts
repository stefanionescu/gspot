import type { FENCE_PARSER_NAMES } from '#cli/config/checks/language/markdown.ts';

export type FenceParser = (typeof FENCE_PARSER_NAMES)[number];

export type FenceSyntaxError = { line: number; message: string };
