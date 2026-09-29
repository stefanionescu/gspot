// The types of integration/tools in this package.
import type { ToolPin } from '#cli/types/kits.ts';
import type { LOCKS } from '#tests/inputs/integration/tools/packages.ts';

export type ToolCommand = { tool: ToolPin; argv: string[]; subcommands: string[]; flags: string[] };

/** The package managers exercised by the private project journeys. */
export type PackageClient = keyof typeof LOCKS;
