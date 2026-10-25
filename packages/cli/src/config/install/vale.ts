import { VALE_PACKAGES } from '#cli/config/generation/configurations/general/prose.ts';

export const VALE_PACKAGE_FOLDERS = [...VALE_PACKAGES, 'config/dictionaries'] as const;

export const VALE_INSTALL_ARGUMENTS = ['sync'] as const;

export const VALE_INSTALL_PREFIX = 'vale-';

export const VALE_ARCHIVE_LIMIT = 8 * 1024 * 1024;
