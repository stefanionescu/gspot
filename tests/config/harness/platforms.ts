/** Whether the platform keeps POSIX shells, links, and modes. */
export const isPosix = process.platform !== 'win32';

/** Whether the tests run on macOS. */
export const isMacos = process.platform === 'darwin';
