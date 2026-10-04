import { MISE_CONFIG_PATH } from '#cli/config/platform/locations.ts';

export const MISE_FILES = ['mise.toml', '.mise.toml', '.config/mise/config.toml', MISE_CONFIG_PATH];

export const RUN_TOKEN = /\b(?<runner>mise|bun|npm|pnpm|yarn) run (?<task>[\w:.-]+)/gu;

export const FILE_EXTENSION = /\.[a-z0-9]+$/iu;

export const START_WORDS = ['install', 'setup', 'start', 'requirements'];

export const CONTENTS_TITLE = 'contents';

export const LICENSE_NAMES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'];

export const BANNED_HEADINGS = [
    'table of contents',
    'project structure',
    'repository layout',
    'directory structure',
    'file map',
    'codebase map',
];

// A README section is a second-level heading.
export const SECTION_DEPTH = 2;
