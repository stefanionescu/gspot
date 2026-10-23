import { dirname } from 'node:path';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

/** A style file of your own inside the folder of the Google style, which install keeps. */
export const AUTHORED_STYLE_PATH = `${dirname(GSPOT_PATHS.valeConfigFile)}/styles/Google/legacy.yml`;

/** The authored files beside the Vale packages, which install keeps. */
export const AUTHORED_VALE_FILES = {
    check: '',
    files: { 'authored.txt': 'keep\n', [AUTHORED_STYLE_PATH]: 'authored legacy bytes\n' },
} as const;

/** A file of the installed Google package. */
export const GOOGLE_TERMS_PATH = `${GSPOT_PATHS.valePackages}/Google/terms.yml`;
