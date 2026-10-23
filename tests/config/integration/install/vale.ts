import { dirname } from 'node:path';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

export const AUTHORED_STYLE_PATH = `${dirname(GSPOT_PATHS.valeConfigFile)}/styles/Google/legacy.yml`;

export const AUTHORED_VALE_FILES = {
    check: '',
    files: { 'authored.txt': 'keep\n', [AUTHORED_STYLE_PATH]: 'authored legacy bytes\n' },
} as const;

export const GOOGLE_TERMS_PATH = `${GSPOT_PATHS.valePackages}/Google/terms.yml`;
