import type { FENCE_PARSER_NAMES } from '#cli/config/checks/markdown.ts';

export type FenceParser = (typeof FENCE_PARSER_NAMES)[number];

/** The body and opening line of a language-tagged Markdown code fence. */
export type FencedBlock = { line: number; language: string; body: string };

/** A syntax error at a one-based line of a code body or Markdown source. */
export type FenceSyntaxError = { line: number; message: string };
