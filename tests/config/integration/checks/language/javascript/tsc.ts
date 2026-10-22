import { BASE_INSTALLED_FILES } from '#tests/config/setup/sandboxes.ts';

export const JAVASCRIPT_PROJECT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    '.gspot/node_modules/@types/private/index.d.ts': 'declare const privateValue: number;\n',
} as const;

const JSCONFIG_SCOPE_TABLES = `[[scope]]
path = "app"

configurations = ["javascript"]
`;

const FORMAT_SOURCE = '/** @param {string} value */\nexport function format(value) { return value.toUpperCase(); }\n';

const PRIVATE_TYPES_FINDING = {
    file: 'source.js',
    line: 3,
    column: 23,
    rule: 'TS2304',
    message: "Cannot find name 'privateValue'.",
} as const;

const ARGUMENT_TYPE_FINDING = {
    file: 'source.js',
    line: 2,
    column: 28,
    rule: 'TS2345',
    message: "Argument of type 'number' is not assignable to parameter of type 'string'.",
} as const;

export const JSCONFIG_CASES = [
    {
        name: 'JSX syntax with project-owned element declarations',
        scope: '',
        tables: '',
        files: {
            'source.jsx': 'export const view = <section value="wrong" />;\nexport const secret = privateValue;\n',
            'node_modules/@types/domain/index.d.ts':
                'declare namespace JSX { interface IntrinsicElements { section: { value: number } } }\n',
        },
        sourceFile: 'source.jsx',
        correctedSource: 'export const view = <section value={1} />;\nexport const secret = 1;\n',
        diagnostics: [
            {
                file: 'source.jsx',
                line: 1,
                column: 30,
                rule: 'TS2322',
                message: "Type 'string' is not assignable to type 'number'.",
            },
            { file: 'source.jsx', line: 2, column: 23, rule: 'TS2304', message: "Cannot find name 'privateValue'." },
        ],
    },
    {
        name: 'extensionless bundled imports with no public ambient type directory',
        scope: '',
        tables: '[tools.eslint]\nimport_extension = "extensionless"\n',
        files: {
            'source.js': `import { format } from './value';
export const text = format(42);
export const secret = privateValue;
`,
            'value.js': FORMAT_SOURCE,
        },
        sourceFile: 'source.js',
        correctedSource: `import { format } from './value';
export const text = format('42');
export const secret = 1;
`,
        diagnostics: [ARGUMENT_TYPE_FINDING, PRIVATE_TYPES_FINDING],
    },
    {
        name: 'scope TypeScript aliases and custom ambient roots without duplicate TypeScript diagnostics',
        scope: 'app',
        tables: JSCONFIG_SCOPE_TABLES,
        files: {
            'app/tsconfig.json': '{"extends":"../config/compiler.json"}\n',
            'config/compiler.json':
                '{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","baseUrl":".","paths":{"@scope/*":["../app/*.js"]},"types":["domain"],"typeRoots":["../ambient,types"],"incremental":true,"tsBuildInfoFile":"../app/authored.cache"},"files":["../shared/globals.d.ts"],"include":["../app/*.ts"]}\n',
            'shared/globals.d.ts': 'declare const sharedValue: number;\n',
            'ambient,types/domain/index.d.ts': 'declare const accepted: number;\n',
            'app/source.js': `import { format } from '@scope/value';
export const text = format(42);
export const total = accepted + sharedValue;
export const secret = privateValue;
`,
            'app/value.js': FORMAT_SOURCE,
            'app/other.ts': 'export const duplicate: number = "wrong";\n',
            'app/authored.cache': 'Keep the authored metadata.\n',
        },
        sourceFile: 'app/source.js',
        correctedSource: `import { format } from '@scope/value';
export const text = format('42');
export const total = accepted + sharedValue;
export const secret = 1;
`,
        diagnostics: [
            { ...ARGUMENT_TYPE_FINDING, file: 'app/source.js' },
            { ...PRIVATE_TYPES_FINDING, file: 'app/source.js', line: 4 },
        ],
    },
    {
        name: 'authored JavaScript settings take precedence over TypeScript aliases',
        scope: 'app',
        tables: JSCONFIG_SCOPE_TABLES,
        files: {
            'app/jsconfig.json':
                '{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","baseUrl":".","paths":{"@scope/*":["values/*.js"]}},"include":["source.js","values/*.js"]}\n',
            'app/tsconfig.json':
                '{"compilerOptions":{"baseUrl":".","paths":{"@scope/*":["ts-owned/*.js"]}},"include":["other.ts"]}\n',
            'app/other.ts': 'export const duplicate: number = "wrong";\n',
            'app/values/value.js': FORMAT_SOURCE,
            'app/ts-owned/value.js': '/** @param {number} value */\nexport function format(value) { return value; }\n',
            'app/source.js': `import { format } from '@scope/value';
export const text = format(42);
export const secret = privateValue;
`,
        },
        sourceFile: 'app/source.js',
        correctedSource: `import { format } from '@scope/value';
export const text = format('42');
export const secret = 1;
`,
        diagnostics: [
            { ...ARGUMENT_TYPE_FINDING, file: 'app/source.js' },
            { ...PRIVATE_TYPES_FINDING, file: 'app/source.js' },
        ],
    },
    {
        name: 'Node imports require explicit suffixes',
        scope: '',
        tables: '',
        files: {
            'source.js': `import { format } from './value';
export const text = format('42');
export const secret = privateValue;
`,
            'value.js': FORMAT_SOURCE,
        },
        sourceFile: 'source.js',
        correctedSource: `import { format } from './value.js';
export const text = format('42');
export const secret = 1;
`,
        diagnostics: [
            {
                file: 'source.js',
                line: 1,
                column: 24,
                rule: 'TS2835',
                message:
                    "Relative import paths need explicit file extensions in ECMAScript imports when '--moduleResolution' is 'node16' or 'nodenext'. Did you mean './value.js'?",
            },
            PRIVATE_TYPES_FINDING,
        ],
    },
] as const;

export const AUTHORED_JSCONFIG_FILES = {
    'jsconfig.json': '{"extends":"./base.json"}\n',
    'base.json':
        '{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","baseUrl":".","paths":{"@shape/*":["source/*"]},"types":["domain"],"incremental":true,"tsBuildInfoFile":"authored/cache.tsbuildinfo"},"include":["source/**/*.js"],"exclude":["excluded"]}',
    'excluded/source.js': 'UnknownDependency();\n',
} as const;

export const AUTHORED_JSCONFIG_CASES = [
    { name: 'without an authored jsconfig', authored: false },
    { name: 'with an authored jsconfig', authored: true },
] as const;

export const SCOPE_JSCONFIG_PATHS = [
    '.gspot/configurations/language/javascript/jsconfig.json',
    '.gspot/configurations/language/javascript/scopes/app/child/jsconfig.json',
    '.gspot/configurations/language/javascript/scopes/app/jsconfig.json',
    '.gspot/configurations/language/javascript/scopes/sibling/jsconfig.json',
] as const;

/** A project imports a declaration file from outside the folder of its jsconfig. */
export const IMPORTED_AMBIENT_FILES = {
    'base.json':
        '{"compilerOptions":{"strict":true,"types":[],"allowJs":true,"checkJs":true,"noEmit":true,"baseUrl":".","paths":{"shared-api":["types/api.d.ts"]}}}',
    'types/api.d.ts': 'export declare const amount: number;\n',
    'apps/web/jsconfig.json': '{"extends":"../../base.json","files":["src/main.js"]}',
    'apps/web/src/main.js': 'import { amount } from "shared-api"; export const total = amount.toFixed();\n',
    'sibling/bad.js': 'unknownValue();\n',
} as const;

export const JSCONFIG_SANDBOX = { configurations: ['javascript'], level: 'all', files: BASE_INSTALLED_FILES } as const;

/** The javascript/tsc results when the project has no TypeScript of its own. */
export const OWN_TYPESCRIPT_RESULTS = [
    {
        check: 'javascript/tsc',
        status: 'failed',
        findings: [
            {
                file: 'source.js',
                line: 1,
                column: 22,
                rule: 'TS2304',
                message: "Cannot find name 'missing'.",
                fixable: false,
            },
        ],
    },
] as const;
