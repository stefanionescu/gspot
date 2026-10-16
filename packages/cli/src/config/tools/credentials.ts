export const REINSTALL_HINT = 'Run: gspot apply, then gspot install';

/** Limit installation diagnostic length after credential redaction. */
export const INSTALL_OUTPUT_LIMIT = 4000;

export const HTTP_URL = /^https?:\/\//u;

export const URL_CREDENTIALS = /(https?:\/\/)[^\s/@]+@/giu;

/** A URL password cannot enter a portable tool lockfile. */
export const LOCKFILE_URL_PASSWORD = /https?:\/\/[^\s"'/:]*:[^\s"'/]+@/iu;

export const REDACTED = '[redacted]';
