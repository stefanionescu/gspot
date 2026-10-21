import { STRICT_COMPILER_OPTIONS } from '#tests/data/checks/typescript/projects.ts';

const PORT_SOURCE =
    '// The port the service listens on.\n\n/** The port, read once. */\nexport const port = Number("8080") as number;\n';

export const COALESCING_SOURCE = `export function fallback(value) {
    const alternate = value || {};
    return alternate ?? {};
}
export const known = (value) => value ?? { known: true };
`;

export const COALESCING_FIXED = `export function fallback(value) {
    if (value === undefined) return;
    return value;
}
export const known = (value) => value ?? { known: true };
`;

export const TYPE_EXPORT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"strict":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["index.ts","value.ts"]}\n',
    'value.ts': 'export type Shape = { name: string };\nexport const value: Shape = { name: "example" };\n',
    'index.ts':
        'import { value, Shape } from "./value.js";\nexport { value };\nexport { Shape } from "./value.js";\nexport const shape: Shape = value;\n',
} as const;

/** A root TypeScript project, and a TypeScript scope under a root without TypeScript. */
export const TYPED_RULE_PROJECTS = [
    {
        name: 'a root TypeScript project',
        configurations: ['typescript'],
        tables: '',
        files: {
            'package.json': '{"private":true,"type":"module"}\n',
            'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["**/*.ts"]}\n',
            'source.ts': PORT_SOURCE,
        },
        file: 'source.ts',
    },
    {
        name: 'a TypeScript scope under a root without TypeScript',
        configurations: [],
        tables: '[[scope]]\npath = "api"\nconfigurations = [ "typescript" ]\n',
        files: {
            'package.json': '{"name":"example","private":true,"type":"module","workspaces":["api"]}\n',
            'api/package.json': '{"name":"api","private":true,"type":"module"}\n',
            'api/tsconfig.json': JSON.stringify({ compilerOptions: STRICT_COMPILER_OPTIONS, include: ['src'] }) + '\n',
            'api/src/port.ts': PORT_SOURCE,
        },
        file: 'api/src/port.ts',
    },
] as const;

export const LEVEL_RULE_OPTIONS =
    '[limits.javascript]\ntrivial_function_statements = 4\n[tools.eslint.rules]\n"n/no-process-exit" = []\n"jsdoc/require-description" = []\n';

export const PACKAGE_MANAGER_LEVELS = [
    { level: 'recommended', severity: 0 },
    { level: 'all', severity: 2 },
] as const;

/** Typed promise statements distinguish accepted void expressions from an unhandled promise. */
export const CONFIGURATION_RULE_OPTIONS = {
    tables: '[tools.eslint.rules]\n"@typescript-eslint/no-floating-promises" = [{ ignoreVoid = true }]\n',
    files: {
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json':
            '{"compilerOptions":{"strict":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["source.ts"]}\n',
        'source.ts': 'void Promise.resolve();\nPromise.resolve();\n',
    },
} as const;
