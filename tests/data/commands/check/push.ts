export const PUSH_CHECK_COMMAND = [
    'check',
    '--hook',
    'pre-push',
    '--only',
    'project/bash-syntax',
    '--json',
    '--',
    'origin',
    'unused',
] as const;
