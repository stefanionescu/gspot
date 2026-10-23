export const VALE_TOOL = 'vale';

export const VALE_ARGUMENTS = ['--output', 'JSON', '--no-exit'] as const;

export const SCRIPT_GRAMMAR = { mode: 'stdin', extension: '.py' } as const;

export const PROSE_GRAMMARS = {
    '.md': { mode: 'path', extension: '.md' },
    '.mdx': { mode: 'path', extension: '.md' },
    '.ts': { mode: 'path', extension: '.ts', format: 'md' },
    '.tsx': { mode: 'path', extension: '.ts', format: 'md' },
    '.mts': { mode: 'stdin', extension: '.ts' },
    '.cts': { mode: 'stdin', extension: '.ts' },
    '.js': { mode: 'path', extension: '.js', format: 'md' },
    '.mjs': { mode: 'stdin', extension: '.js' },
    '.cjs': { mode: 'stdin', extension: '.js' },
    '.jsx': { mode: 'path', extension: '.js', format: 'md' },
    '.swift': { mode: 'path', extension: '.swift', format: 'md' },
    '.py': { mode: 'path', extension: '.py', format: 'md' },
    '.css': { mode: 'path', extension: '.css', format: 'md' },
    '.sh': { mode: 'path', extension: '.sh', format: 'py' },
    '.bash': { mode: 'path', extension: '.bash', format: 'py' },
    '.zsh': { mode: 'path', extension: '.zsh', format: 'py' },
    '.sql': { mode: 'path', extension: '.sql', format: 'lua' },
    '.pgsql': { mode: 'path', extension: '.pgsql', format: 'lua' },
    '.psql': { mode: 'path', extension: '.psql', format: 'lua' },
} as const;

export const VALE_ERROR_LINE = /(?:^E\d+)|(?:not found)|(?:error)/iu;
