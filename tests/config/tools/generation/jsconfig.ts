import type { JsconfigCase } from '#tests/types/tools/generation/jsconfig.ts';

const SCOPE_TABLE = '[[scope]]\npath = "app"\nconfigurations = ["javascript"]\n';
const FORMAT_SOURCE = '/** @param {string} value */\nexport function format(value) { return value.toUpperCase(); }\n';
const PRIVATE_DIAGNOSTIC = {
    file: 'source.js',
    line: 3,
    column: 23,
    rule: 'TS2304',
    message: "Cannot find name 'privateValue'.",
};
const CALL_DIAGNOSTIC = {
    file: 'source.js',
    line: 2,
    column: 28,
    rule: 'TS2345',
    message: "Argument of type 'number' is not assignable to parameter of type 'string'.",
};

export const JAVASCRIPT_PROJECT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    '.gspot/node_modules/@types/private/index.d.ts': 'declare const privateValue: number;\n',
};

export const JAVASCRIPT_COMPILER_CASES: JsconfigCase[] = [
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
        tables: '[tools.eslint.import_extensions]\n"**/*" = "extensionless"\n',
        files: {
            'source.js':
                "import { format } from './value';\nexport const text = format(42);\nexport const secret = privateValue;\n",
            'value.js': FORMAT_SOURCE,
        },
        sourceFile: 'source.js',
        correctedSource:
            "import { format } from './value';\nexport const text = format('42');\nexport const secret = 1;\n",
        diagnostics: [CALL_DIAGNOSTIC, PRIVATE_DIAGNOSTIC],
    },
    {
        name: 'scope TypeScript aliases and custom ambient roots without duplicate TypeScript diagnostics',
        scope: 'app',
        tables: SCOPE_TABLE,
        files: {
            'app/tsconfig.json': '{"extends":"../config/compiler.json"}\n',
            'config/compiler.json':
                '{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","baseUrl":".","paths":{"@scope/*":["../app/*.js"]},"types":["domain"],"typeRoots":["../ambient,types"],"incremental":true,"tsBuildInfoFile":"../app/authored.cache"},"files":["../shared/globals.d.ts"],"include":["../app/*.ts"]}\n',
            'shared/globals.d.ts': 'declare const sharedValue: number;\n',
            'ambient,types/domain/index.d.ts': 'declare const accepted: number;\n',
            'app/source.js':
                "import { format } from '@scope/value';\nexport const text = format(42);\nexport const total = accepted + sharedValue;\nexport const secret = privateValue;\n",
            'app/value.js': FORMAT_SOURCE,
            'app/other.ts': 'export const duplicate: number = "wrong";\n',
            'app/authored.cache': 'Keep the authored metadata.\n',
        },
        sourceFile: 'app/source.js',
        correctedSource:
            "import { format } from '@scope/value';\nexport const text = format('42');\nexport const total = accepted + sharedValue;\nexport const secret = 1;\n",
        diagnostics: [
            { ...CALL_DIAGNOSTIC, file: 'app/source.js' },
            { ...PRIVATE_DIAGNOSTIC, file: 'app/source.js', line: 4 },
        ],
    },
    {
        name: 'authored JavaScript settings take precedence over TypeScript aliases',
        scope: 'app',
        tables: SCOPE_TABLE,
        files: {
            'app/jsconfig.json':
                '{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","baseUrl":".","paths":{"@scope/*":["values/*.js"]}},"include":["source.js","values/*.js"]}\n',
            'app/tsconfig.json':
                '{"compilerOptions":{"baseUrl":".","paths":{"@scope/*":["ts-owned/*.js"]}},"include":["other.ts"]}\n',
            'app/other.ts': 'export const duplicate: number = "wrong";\n',
            'app/values/value.js': FORMAT_SOURCE,
            'app/ts-owned/value.js': '/** @param {number} value */\nexport function format(value) { return value; }\n',
            'app/source.js':
                "import { format } from '@scope/value';\nexport const text = format(42);\nexport const secret = privateValue;\n",
        },
        sourceFile: 'app/source.js',
        correctedSource:
            "import { format } from '@scope/value';\nexport const text = format('42');\nexport const secret = 1;\n",
        diagnostics: [
            { ...CALL_DIAGNOSTIC, file: 'app/source.js' },
            { ...PRIVATE_DIAGNOSTIC, file: 'app/source.js' },
        ],
    },
    {
        name: 'an unused extensionless file class retains native Node suffix requirements',
        scope: '',
        tables: '[tools.eslint.import_extensions]\n"unused/**" = "extensionless"\n',
        files: {
            'source.js':
                "import { format } from './value';\nexport const text = format('42');\nexport const secret = privateValue;\n",
            'value.js': FORMAT_SOURCE,
        },
        sourceFile: 'source.js',
        correctedSource:
            "import { format } from './value.js';\nexport const text = format('42');\nexport const secret = 1;\n",
        diagnostics: [
            {
                file: 'source.js',
                line: 1,
                column: 24,
                rule: 'TS2835',
                message:
                    "Relative import paths need explicit file extensions in ECMAScript imports when '--moduleResolution' is 'node16' or 'nodenext'. Did you mean './value.js'?",
            },
            PRIVATE_DIAGNOSTIC,
        ],
    },
];
