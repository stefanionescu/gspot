export const JAVASCRIPT_ENVIRONMENT_FIELDS: ReadonlySet<string> = new Set([
    'process.env',
    'Bun.env',
    'import.meta.env',
]);

export const JAVASCRIPT_ENVIRONMENT_GETTERS: ReadonlySet<string> = new Set(['Deno.env.get']);

export const OS_ENVIRONMENT_MEMBERS = { environ: 'environ', getenv: 'getenv' } as const;

export const PYTHON_IMPORT_NODES = new Set(['import_statement', 'import_from_statement', 'future_import_statement']);

export const PYTHON_SCOPE_NODES: ReadonlySet<string> = new Set(['function_definition', 'class_definition', 'lambda']);

export const OS_MODULE = 'os';

export const SWIFT_ENV_READ = 'ProcessInfo.processInfo.environment';

export const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/u;
