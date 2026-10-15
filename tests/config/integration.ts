/** Metadata for the npm packages packed before the test workers start. */
export const TEST_RUN_FOLDER_NAME = 'gspot-test-run';
export const TOOL_PATHS_FILE = 'tool-paths.txt';
export const GSPOT_LAUNCHER_PATH = 'bin/gspot';
export const PREPARED_SUITES = ['integration', 'e2e'] as const;

export const PACKED_PACKAGES_FILE = 'packages.json';

export const INTERRUPTED_EXIT = 130;
export const TERMINATED_EXIT = 143;

export const NPM_PACK_FLAGS = ['--ignore-scripts', '--json'] as const;
export const REGISTRY_HOST = '127.0.0.1';
export const UPSTREAM_REGISTRY = 'https://registry.npmjs.org/';
export const GSPOT_PACKAGE_SCOPE = '@gspothq/';

export const PINNED_TOOLS_FILE = 'mise.toml';
export const MISE_TRUST = ['mise', 'trust'] as const;
export const MISE_INSTALL = ['mise', 'install'] as const;
export const MISE_BIN_PATHS = ['mise', 'bin-paths'] as const;

export const HTTP_REDIRECT = 302;
