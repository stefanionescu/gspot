// The literal values integration/tools/tools reads: names, patterns, limits, and tables.

export const HELP_TIMEOUT_MS = 30_000;
/** How long the private tool projects of every exercised tool may take to install; a Windows runner is the slowest. */
export const INSTALL_TIMEOUT_MS = 180_000;
/** How long one native lint run may take; a cold SwiftLint start on an arm64 runner passes ten seconds. */
export const LINT_TIMEOUT_MS = 60_000;
