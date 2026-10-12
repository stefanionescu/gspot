import { SETTINGS_FILE, VERSION_PIN_FILE } from '#cli/config/system/locations.ts';

export const DIFF_CONTEXT_LINES = 2;
export const RETAINED_PATHS = new Set([SETTINGS_FILE, '.gitignore', VERSION_PIN_FILE]);

export const CONFLICT_MARKERS = /^(?:<{7}|={7}|>{7})(?: |$)/mu;
