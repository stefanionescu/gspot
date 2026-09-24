/** Repository-relative paths shared by generation, execution, and lifecycle storage. */
export const CONFIGURATION_DIRECTORY = '.gspot/config';
export const STATE_DIRECTORY = '.gspot/state';
export const OWNERSHIP_FILE = `${STATE_DIRECTORY}/ownership.json`;
export const REPORT_DIRECTORY = '.gspot/reports';
export const CACHE_DIRECTORY = '.gspot/cache';
export const NODE_MODULES_DIRECTORY = '.gspot/node_modules';
export const PYTHON_ENVIRONMENT_DIRECTORY = '.gspot/.venv';
export const PRIVATE_PATHS = [
    `${NODE_MODULES_DIRECTORY}/`,
    `${PYTHON_ENVIRONMENT_DIRECTORY}/`,
    `${STATE_DIRECTORY}/`,
    `${CACHE_DIRECTORY}/`,
    `${REPORT_DIRECTORY}/`,
];
