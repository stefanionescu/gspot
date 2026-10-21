// Highest-precedence file first within each folder.
export const MISE_FILES = [
    '.mise.local.toml',
    'mise.local.toml',
    '.mise.toml',
    'mise.toml',
    'mise/config.toml',
    '.mise/config.toml',
    '.config/mise.toml',
    '.config/mise/config.toml',
] as const;

export const LOCKFILE_UPDATE_COMMANDS = {
    'bun.lock': 'bun install',
    'package-lock.json': 'npm install',
    'pnpm-lock.yaml': 'pnpm install',
} as const;

export const LOCKFILE_URL = /\b(?:https?|git\+https?|git\+ssh|git):\/\/[^\s"',)\]]+/gu;

export const NPM_DOWNLOAD = /"resolved"\s*:\s*"([^"]+)"/gu;

export const REACT_PACKAGE = 'react';

export const REACT_DOM_PACKAGE = 'react-dom';

export const NPM_TOOL_PREFIX = 'npm:';
