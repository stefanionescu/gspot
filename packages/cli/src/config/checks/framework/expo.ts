// Expo Doctor prints each failed check on a line of its own, then the issues it found, then its advice.
export const FAILED_CHECK = /^✖ (?<description>.+)$/u;

/** The summary that closes a failed Doctor check's issue block. */
export const PASSED_CHECKS = /^\d+\/\d+ checks passed\./u;

export const EXPO_PACKAGE_JSON = 'expo/package.json';

export const EXPO_DOCTOR_COMMAND = ['expo-doctor'] as const;

export const BLOCK_END_PREFIXES = ['Advice:', '✔ ', '✖ '] as const;
