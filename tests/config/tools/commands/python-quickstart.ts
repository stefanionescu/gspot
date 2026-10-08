/** The unfinished source pasted into the Python tutorial. */
export const INVALID_SOURCE = 'def total(items):\n    return sum(items\n';

/** Arguments for initializing the tutorial with its explicit configuration. */
export const INITIALIZE = ['gspot', 'init', '--yes', '--configurations', 'python'];

/** Create the project and its own environment before the first commit. */
export const PROJECT_COMMANDS = [
    ['uv', 'init', '--lib'],
    ['uv', 'sync'],
];
