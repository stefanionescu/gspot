// One deadline bounds each test and its child processes.

export const TEST_TIMEOUT_MILLISECONDS = 900_000;

export const TOOL_PATHS_FILE = 'tool-paths.txt';
export const GSPOT_LAUNCHER_PATH = 'bin/gspot';
export const PACKED_PACKAGES_FILE = 'packages.json';
export const PINNED_TOOLS_FILE = 'mise.toml';
export const MISE_TRUST = ['mise', 'trust'] as const;

/** The folder for the npm packages packed before the test workers start. */
export const TEST_RUN_FOLDER_NAME = 'gspot-test-run';

export const TEST_RUN_HASH_LENGTH = 12;
