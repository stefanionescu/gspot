export const BYTE_ORDER_MARK = '\uFEFF';

export const KEY_QUOTES = ['"', '`'];

export const VALUE_QUOTES = ['"""', '`'];

export const URL_PACKAGE = /^https?:\/\//u;

export const ZIP_PACKAGE = /\.zip$/u;

/** Vale packages that also install shared files outside their style folder. */
export const PACKAGE_FOLDERS: Record<string, string[]> = { Harper: ['config/dictionaries'] };
