// Expo Doctor prints each failed check on a line of its own, then the issues it found, then its advice.
export const FAILED_CHECK = /^✖ (?<description>.+)$/u;

/** The summary that closes a failed Doctor check's issue block. */
export const PASSED_CHECKS = /^\d+\/\d+ checks passed\./u;
