import { HOOKS_CHANGED_NOTE, INSTALL_NEEDED_NOTE } from '#cli/config/apply/files/generated.ts';

export const INIT_INSTALL_NOTES: ReadonlySet<string> = new Set([HOOKS_CHANGED_NOTE, INSTALL_NEEDED_NOTE]);

export const ORIGIN_URL_SETTING = 'remote.origin.url';

export const REMOTE_URL_SCHEME = /^(?:https?|ssh):\/\//u;

export const REMOTE_URL_USER = /^[^@/]+@/u;
