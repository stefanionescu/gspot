/** NUL, a byte that is not valid UTF-8, LF, and CR exercise binary preservation; the batch adds an asterisk, and restoration uses start-of-heading before LF. */
export const OWNERSHIP_BYTES = {
    replacement: [0, 255, 10, 13],
    batch: [0, 255, 10, 13, 42],
    restoration: [0, 255, 1, 10],
};
