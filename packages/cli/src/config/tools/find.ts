/** Installation instructions for systems without mise. */
export const MISE_INSTALL_URL = 'https://mise.jdx.dev/getting-started.html';

export const MISE_PROGRAM = 'mise';
export const MISE_SHIMS_FOLDER = 'shims';
export const MISE_WHICH = 'which';

export const NPM_BIN_FOLDER = 'node_modules/.bin';
export const MISE_BIN_PATHS_ARGUMENTS = ['mise', 'bin-paths'] as const;
export const AVAILABLE_TOOL_STATES: ReadonlySet<string> = new Set(['ok', 'system', 'newer']);
