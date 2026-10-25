import { HOOKS_CHANGED_NOTE, INSTALL_FIRST_NOTE } from '#cli/config/generation/write.ts';

export const INIT_INSTALL_NOTES: ReadonlySet<string> = new Set([HOOKS_CHANGED_NOTE, INSTALL_FIRST_NOTE]);

export const ORIGIN_URL_SETTING = 'remote.origin.url';

export const REMOTE_URL_SCHEME = /^(?:https?|ssh):\/\//u;

export const REMOTE_URL_USER = /^[^@/]+@/u;
