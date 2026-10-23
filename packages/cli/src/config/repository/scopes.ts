import { ALL_FILES_GLOB } from '#cli/config/system/assets.ts';

export const EVERY_FILE_GLOBS = ['**', ALL_FILES_GLOB] as const;

export const ROOT_SCOPE = { path: '', origin: 'root' } as const;
