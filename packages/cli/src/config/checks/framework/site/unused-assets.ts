import { SYMLINK_MODE, ENTRY_FILE_MODES } from '#cli/config/files/modes.ts';

export const REGULAR_FILE_MODES: ReadonlySet<string> = new Set(
    Object.keys(ENTRY_FILE_MODES).filter((mode) => mode !== SYMLINK_MODE),
);

export const TEXT_SUFFIXES = new Set([
    '.htm',
    '.html',
    '.css',
    '.scss',
    '.js',
    '.mjs',
    '.jsx',
    '.ts',
    '.tsx',
    '.astro',
    '.vue',
    '.svelte',
    '.json',
    '.webmanifest',
    '.xml',
    '.txt',
    '.md',
    '.toml',
    '.yml',
    '.yaml',
]);

export const ASSET_FOLDER = /(?:^|\/)(?:assets|public|static)\//u;
