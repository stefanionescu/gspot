export const VALE_ARGUMENTS = ['--output', 'JSON', '--no-exit'] as const;

export const SCRIPT_GRAMMAR = { mode: 'stdin', extension: '.py' } as const;

export const VALE_ERROR_LINE = /(?:^E\d+)|(?:not found)|(?:error)/iu;
