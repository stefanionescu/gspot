import { VERSION_FILE } from '#cli/config/platform/locations.ts';
import type { OwnedKind } from '#cli/types/lifecycle/ownership.ts';

/** The kinds of file a gspot write owns. */
export const OWNED_KINDS = ['config', 'block', 'merge', 'policy', 'pin', 'hook', 'lock', 'export'] as const;

// The kinds gspot adopts when the file already holds the exact bytes it writes, so a prune leaves it in place outside
// `.gspot`. A block or merged fields are taken out by themselves, gspot.toml stays, and an exported template is the
// user's.
export const ADOPTED_KINDS = new Set<OwnedKind>(['config', 'hook', 'pin', 'lock']);

/** The heading the text of a moved `CLAUDE.md` goes under at the end of `AGENTS.md`. */
export const MOVED_HEADING = '## Other instructions';

export const OUTPUT_JSON_INDENT = 2;

/** Files and output kinds kept when a selected configuration does not write them. */
export const RETAINED_PATHS = new Set(['gspot.toml', '.gitignore', VERSION_FILE]);
export const RETAINED_KINDS = new Set<OwnedKind>(['hook', 'export']);

/** Format of authored config-file fields managed by the Bun integration. */
export const MERGED_CONFIGURATION_FORMAT = 'toml' as const;
