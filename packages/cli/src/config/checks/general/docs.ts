// The literal values checks/general/docs reads: names, patterns, limits, and tables.

export const RUN_TOKEN = /\b(?<runner>mise|bun|npm|pnpm|yarn) run (?<task>[\w:.-]+)/gu;

export const FILE_EXTENSION = /\.[a-z0-9]+$/iu;

export const BANNED_HEADINGS = [
    'table of contents',
    'project structure',
    'repository layout',
    'directory structure',
    'file map',
    'codebase map',
];
export const START_WORDS = ['install', 'setup', 'start', 'requirements'];
export const CONTENTS_HEADINGS = 6;
export const CONTENTS_HEADING = 'contents';
export const LICENSE_NAMES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'];
