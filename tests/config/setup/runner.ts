// run folders
export const CACHE_FOLDER = 'cache';
export const CONFIG_FOLDER = 'config';
export const GIT_ISOLATION_ENVIRONMENT = {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '',
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'maintenance.auto',
    GIT_CONFIG_VALUE_0: 'false',
    GIT_CONFIG_KEY_1: 'gc.auto',
    GIT_CONFIG_VALUE_1: '0',
} as const;
export const MISSING_TEST_RUN_FOLDER = 'Set TEST_RUN_FOLDER before running the test suite.';
export const TEMPORARY_FOLDER = 'temporary';

// test registry
export const AUTHENTICATION_REQUIRED_MESSAGE = 'Authentication required';
export const GSPOT_PACKAGE_SCOPE = '@gspothq/';
export const NPM_PACK_FLAGS = ['--ignore-scripts', '--json'] as const;
export const PACKED_PUBLISH_TIME = '2025-01-01T00:00:00.000Z';
export const REGISTRY_HOST = '127.0.0.1';
export const UPSTREAM_REGISTRY = 'https://registry.npmjs.org/';

// test runner
export const GSPOT_LAUNCHER_PATH = 'bin/gspot';
export const MISE_STATE_FOLDER = 'mise-state';
export const MISE_TRUST = ['mise', 'trust'] as const;
export const PACKED_PACKAGES_FILE = 'packages.json';
export const TOOL_INSTALL_FOLDER = 'tools';
export const TOOL_PATHS_FILE = 'tool-paths.txt';
