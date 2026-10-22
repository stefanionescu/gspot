/** The longest install output that gspot shows after it removes credentials. */
export const INSTALL_OUTPUT_LIMIT = 4000;

export const URL_CREDENTIALS = /(https?:\/\/)[^\s/@]+@/giu;

/** A URL password cannot enter a portable tool lockfile. */
export const LOCKFILE_URL_PASSWORD = /https?:\/\/[^\s"'/:]*:[^\s"'/]+@/iu;

export const REDACTED = '[redacted]';
