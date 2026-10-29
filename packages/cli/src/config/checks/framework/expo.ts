export const FAILED_CHECK_LINE = /^✖ (?<description>.+)$/u;

export const PASSED_CHECKS_LINE = /^\d+\/\d+ checks passed\./u;

export const EXPO_PACKAGE = 'expo';

export const EXPO_DOCTOR_COMMAND = ['expo-doctor'] as const;

export const BLOCK_END_PREFIXES = ['Advice:', '✔ ', '✖ '] as const;

export const UNINSTALLED_EXPO_MESSAGE =
    'Install the project dependencies of this scope; Expo Doctor reads an installed Expo project.';

export const FAILED_CHECK_RULE = 'failed-check';
