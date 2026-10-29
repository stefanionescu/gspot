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

export const SWIFT_ENVIRONMENT = 'ProcessInfo.processInfo.environment';

export const VARIABLE_NAME = /^[A-Z_][A-Z0-9_]*$/u;

export const PYTHON_STRING_ESCAPE = /\\(?:x([\da-f]{2})|u([\da-f]{4})|U([\da-f]{8})|([0-7]{1,3})|([\s\S]))/giu;
export const PYTHON_STRING_ESCAPES: Readonly<Record<string, string>> = {
    n: '\n',
    r: '\r',
    t: '\t',
    b: '\b',
    f: '\f',
    v: '\v',
    a: '\u0007',
    '\\': '\\',
    "'": "'",
    '"': '"',
    '\n': '',
};

export const COMPONENT_EXTENSION = /\.(?:vue|svelte|astro)$/u;
export const COMPONENT_SCRIPT = /<script(?<attributes>[^>]*)>(?<body>[\s\S]*?)<\/script\s*>/giu;
export const SCRIPT_LANGUAGE = /\blang\s*=\s*["'](?<language>[^"']+)["']/iu;

export const HEXADECIMAL_RADIX = 16;
export const OCTAL_RADIX = 8;
export const MAXIMUM_CODE_POINT = 0x10_ff_ff;
