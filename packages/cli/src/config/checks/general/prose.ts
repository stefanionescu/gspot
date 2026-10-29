export const VALE_ARGUMENTS = ['--output', 'JSON', '--no-exit'] as const;

export const SCRIPT_GRAMMAR = { mode: 'stdin', extension: '.py' } as const;

export const VALE_ERROR_LINE = /(?:^E\d+)|(?:not found)|(?:error)/iu;

export const VALE_PACKAGES_MESSAGE = 'The Vale packages are not installed. Run gspot install.';

export const VALE_NAME = 'Vale';

export const NO_OUTPUT = 'no output';
