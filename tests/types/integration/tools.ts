// The types of integration/tools in this package.
import type { ToolPin } from '#cli/types/configurations.ts';

export type ToolCommand = { tool: ToolPin; argv: string[]; subcommands: string[]; flags: string[] };
/** The lock file each package manager writes. */
export const LOCKS = { npm: 'package-lock.json', bun: 'bun.lock', pnpm: 'pnpm-lock.yaml', yarn: 'yarn.lock' } as const;
