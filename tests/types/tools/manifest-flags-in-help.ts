import type { ToolPin } from '#cli/types/parsers/tool.ts';

/** A unique pinned tool invocation whose help must declare its selected flags. */
export type FlagCommand = { tool: ToolPin; argv: string[]; subcommands: string[]; flags: string[] };
