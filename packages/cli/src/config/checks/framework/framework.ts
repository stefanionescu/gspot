export const FAILED_CHECK_LINE = /^✖ (?<description>.+)$/u;

export const PASSED_CHECKS_LINE = /^\d+\/\d+ checks passed\./u;

export const EXPO_PACKAGE = 'expo';

export const EXPO_DOCTOR_COMMAND = ['expo-doctor'] as const;

export const BLOCK_END_PREFIXES = ['Advice:', '✔ ', '✖ '] as const;

export const UNINSTALLED_EXPO_MESSAGE =
    'Install the project dependencies of this scope; Expo Doctor reads an installed Expo project.';

export const FAILED_CHECK_RULE = 'failed-check';

export const CAUSE_MARKS = ['Please install', 'FATAL', 'Error:', '⨯'] as const;

export const SHOWN_LINES = 3;

export const MARKED_LINES = 2;

export const NEXT_TYPEGEN_COMMAND = ['next', 'typegen'] as const;

export const CI_ENVIRONMENT = { CI: '1' } as const;

export const TYPESCRIPT_TSC_CHECK = 'typescript/tsc';

export const TSC_TOOL = 'tsc';

export const REACT_PACKAGE = 'react';

export const REACT_DOM_PACKAGE = 'react-dom';

export const REACT_VERSIONS_RULE = 'react-versions';

export const FINDING_LINE = /^\d+ (?<message>\{.*\})$/u;

export const FAILURE_LINE = /^\d+ FAILURE (?<message>".*")$/u;

export const SVELTE_CHECK_COMMAND = [
    'svelte-check',
    '--workspace',
    '.',
    '--output',
    'machine-verbose',
    '--fail-on-warnings',
] as const;

export const SVELTE_TSCONFIG_FLAG = '--tsconfig';

export const SVELTE_CHECK_RULE = 'svelte-check';
