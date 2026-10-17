// Expo Doctor prints each failed check on its own line, then what it found, then its advice.
export const FAILED_CHECK = /^✖ (?<description>.+)$/u;

/** The summary line that ends the block of a failed Doctor check. */
export const PASSED_CHECKS = /^\d+\/\d+ checks passed\./u;

export const EXPO_PACKAGE_JSON = 'expo/package.json';

export const EXPO_DOCTOR_COMMAND = ['expo-doctor'] as const;

export const BLOCK_END_PREFIXES = ['Advice:', '✔ ', '✖ '] as const;
