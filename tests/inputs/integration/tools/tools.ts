// The literal values integration/tools/tools reads: names, patterns, limits, and tables.
import { WINDOWS_SLOWDOWN } from '#tests/inputs/cli.ts';

export const HELP_TIMEOUT_MS = 30_000;
/** How long the private tool projects of every exercised tool may take to install. */
export const INSTALL_TIMEOUT_MS = 300_000 * WINDOWS_SLOWDOWN;
/** How long one native lint run may take; a cold SwiftLint start on an arm64 runner passes ten seconds. */
export const LINT_TIMEOUT_MS = 60_000;
