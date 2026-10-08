import type { OwnedKind } from '#cli/types/lifecycle/ownership.ts';
import { POLICY_FILE, VERSION_FILE } from '#cli/config/platform/locations.ts';

/** The kinds of file a gspot write owns. */
export const OWNED_KINDS = ['tool_file', 'block', 'merge', 'policy', 'pin', 'hook', 'lock'] as const;

// The kinds gspot adopts when the file already holds the exact bytes it writes, so a prune leaves it in place outside
// `.gspot`. A block or merged fields are taken out by themselves, and gspot.toml stays.
export const ADOPTED_KINDS = new Set<OwnedKind>(['tool_file', 'hook', 'pin', 'lock']);

/** The heading the text of a moved `CLAUDE.md` goes under at the end of `AGENTS.md`. */
export const MOVED_HEADING = '## Other instructions';

export const OWNERSHIP_JSON_INDENT = 2;

/** Files kept when a selected configuration does not write them. */
export const RETAINED_PATHS = new Set([POLICY_FILE, '.gitignore', VERSION_FILE]);

/** Native formats of authored configuration fields managed by lifecycle merges. */
export const MERGED_CONFIGURATION_FORMATS = ['toml', 'json'] as const;
