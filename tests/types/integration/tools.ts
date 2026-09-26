// The types of integration/tools in this package.
import type { ToolPin } from '#cli/types/configurations.ts';

export type ToolCommand = { tool: ToolPin; argv: string[]; subcommands: string[]; flags: string[] };
