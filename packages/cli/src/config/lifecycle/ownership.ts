// The literal values lifecycle/ownership reads: names, patterns, limits, and tables.
import { NODE_MODULES_DIRECTORY, PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/config/platform/locations.ts';

export const OUTPUT_JSON_INDENT = 2;

/** The heading the text of a moved `CLAUDE.md` goes under at the end of `AGENTS.md`. */
export const MOVED_HEADING = '## Other instructions';

// The kinds gspot adopts when the file already holds the exact bytes it writes, so a prune leaves it in place. A
// block or merged fields are taken out by themselves, gspot.toml stays, and an exported profile is the user's.
export const ADOPTED_KINDS = new Set(['config', 'hook', 'pin', 'lock']);

/** The folder each private installation kind is written to. */
export const INSTALLATION_DIRECTORIES = { npm: NODE_MODULES_DIRECTORY, python: PYTHON_ENVIRONMENT_DIRECTORY } as const;

/** The kinds of file a gspot write owns. */
export const OWNED_KINDS = ['config', 'block', 'merge', 'policy', 'pin', 'hook', 'lock', 'export'] as const;
