import { VALE_PACKAGES } from '#cli/config/generation/configurations/general/prose.ts';

export const VALE_PACKAGE_FOLDERS = [...VALE_PACKAGES, 'config/dictionaries'] as const;

export const VALE_INSTALL_ARGUMENTS = ['sync'] as const;

export const VALE_INSTALL_PREFIX = 'vale-';

export const VALE_STYLES_PATH_PATTERN = /^StylesPath[\t ]*=([^\r\n]*)$/gmu;
