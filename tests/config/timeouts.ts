// Every time limit of the tests, from one command to the whole acceptance run. Windows takes longer.
/** How much longer every tool limit is on Windows, where sandbox installs and tool runs take several times as long. */
export const WINDOWS_SLOWDOWN = process.platform === 'win32' ? 2 : 1;

/** How long a planted-repository test may take: it spawns real tools. */
export const PLANTED_TIMEOUT_MS = 60_000 * WINDOWS_SLOWDOWN;

export const SETUP_MS = 60_000;

export const HELP_TIMEOUT_MS = 30_000;

/** How long the private tool projects of every exercised tool may take to install. */
export const INSTALL_TIMEOUT_MS = 300_000 * WINDOWS_SLOWDOWN;

/** How long one native lint run may take; a cold SwiftLint start on an arm64 runner passes ten seconds. */
export const LINT_TIMEOUT_MS = 60_000;

// A consumer installs every tool through the local registry, which fetches each package from npm the first time.
export const RELEASE_TIMEOUT_MS = 600_000;

export const STARTUP_MS = 30_000;

export const REQUEST_MS = 1000;

export const SHUTDOWN_MS = 5000;

/** How long the whole source acceptance run may take. */
export const ACCEPTANCE_TIMEOUT_MS = 90 * 60_000;

/** How long the package acceptance run may take. */
export const PACKAGE_RUN_TIMEOUT_MS = 30 * 60_000;

/** How long a gspot command from source may take while it serves the workspace plugin. */
export const SOURCE_COMMAND_TIMEOUT_MS = 10 * 60_000;
