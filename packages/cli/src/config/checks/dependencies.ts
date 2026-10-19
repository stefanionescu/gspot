export const LOCKFILE_URL = /\b(?:https?|git\+https?|git\+ssh|git):\/\/[^\s"',)\]]+/gu;

export const NPM_DOWNLOAD = /"resolved"\s*:\s*"([^"]+)"/gu;

export const REACT_PACKAGE = 'react';
export const REACT_DOM_PACKAGE = 'react-dom';

/** The mise files that pin tools, in the order mise reads them within one folder. */
export const MISE_FILES = [
    'mise.toml',
    '.mise.toml',
    'mise/config.toml',
    '.mise/config.toml',
    '.config/mise.toml',
] as const;
export const NPM_TOOL_PREFIX = 'npm:';
