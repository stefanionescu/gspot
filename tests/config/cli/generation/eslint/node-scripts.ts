export const NODE_SCRIPT_SOURCE =
    '#!/usr/bin/env node\nconst unused = 1;\nconsole.log(process.cwd());\nprocess.exit(0);\n';
export const NODE_SCRIPT_CORRECTED = '#!/usr/bin/env node\nconsole.log(process.cwd());\nprocess.exit(0);\n';

export const NODE_SCRIPT_OUTPUT = 'console.log("result");\nprocess.exit(0);\n';

export const NODE_SCRIPT_CASES = [
    {
        file: 'scripts/run[one]',
        unused: { ruleId: 'no-unused-vars', line: 2, severity: 2 },
        corrected: NODE_SCRIPT_CORRECTED,
        strict: [],
    },
    {
        file: 'scripts/run{one,two}',
        unused: { ruleId: 'no-unused-vars', line: 2, severity: 2 },
        corrected: NODE_SCRIPT_CORRECTED,
        strict: [],
    },
    {
        file: 'scripts/run.task',
        unused: { ruleId: 'no-unused-vars', line: 2, severity: 2 },
        corrected: NODE_SCRIPT_CORRECTED,
        strict: [],
    },
    {
        file: 'child/scripts/run',
        unused: { ruleId: 'no-unused-vars', line: 2, severity: 2 },
        corrected: NODE_SCRIPT_CORRECTED,
        strict: [],
    },
    {
        file: 'scripts/run.ts',
        unused: { ruleId: '@typescript-eslint/no-unused-vars', line: 2, severity: 2 },
        corrected: NODE_SCRIPT_CORRECTED,
        strict: [],
    },
    {
        file: 'scripts/typed.ts',
        unused: { ruleId: '@typescript-eslint/no-unused-vars', line: 1, severity: 2 },
        corrected: NODE_SCRIPT_OUTPUT,
        strict: [],
    },
    {
        file: 'scripts/run.js',
        unused: { ruleId: 'no-unused-vars', line: 1, severity: 2 },
        corrected: NODE_SCRIPT_OUTPUT,
        strict: [],
    },
    {
        file: 'build.config.ts',
        unused: { ruleId: '@typescript-eslint/no-unused-vars', line: 1, severity: 2 },
        corrected: NODE_SCRIPT_OUTPUT,
        strict: [],
    },
    {
        file: 'src/source.ts',
        unused: { ruleId: '@typescript-eslint/no-unused-vars', line: 1, severity: 2 },
        corrected: 'export const result = 1;\n',
        strict: [
            { ruleId: 'n/no-process-exit', line: 3, severity: 2 },
            { ruleId: 'no-console', line: 2, severity: 2 },
            { ruleId: 'unicorn/no-process-exit', line: 3, severity: 2 },
        ],
    },
];
export const NODE_SCRIPT_CONTROLS = [
    'scripts/runo',
    'scripts/runone',
    'scripts/plain',
    'scripts/python',
    'emitted/run',
    'vendor/run',
] as const;

export const NODE_SCRIPT_FILES = {
    'package.json': '{"private":true,"type":"module","engines":{"node":">=22.0.0"}}',
    'child/package.json': '{"private":true,"type":"module","engines":{"node":">=18.0.0"}}',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["scripts/*.ts","build.config.ts","src/*.ts"]}',
    'scripts/run[one]': NODE_SCRIPT_SOURCE,
    'scripts/run{one,two}': NODE_SCRIPT_SOURCE,
    'scripts/run.task': NODE_SCRIPT_SOURCE,
    'child/scripts/run': NODE_SCRIPT_SOURCE,
    'scripts/typed.ts': 'const unused: number = 1;\nconsole.log("result");\nprocess.exit(0);\n',
    'scripts/run.js': 'const unused = 1;\nconsole.log("result");\nprocess.exit(0);\n',
    'build.config.ts': 'const unused: number = 1;\nconsole.log("result");\nprocess.exit(0);\n',
    'src/source.ts': 'const unused: number = 1;\nconsole.log("result");\nprocess.exit(0);\n',
    'scripts/run.ts': '#!/usr/bin/env node\nconst unused: number = 1;\nconsole.log(process.cwd());\nprocess.exit(0);\n',
    'scripts/runo': '#!/usr/bin/env bash\necho ready\n',
    'scripts/runone': '#!/usr/bin/env bash\necho ready\n',
    'scripts/plain': 'const unused = 1;\n',
    'scripts/python': '#!/usr/bin/env python3\nprint("ready")\n',
    'emitted/run': NODE_SCRIPT_SOURCE,
    'vendor/run': NODE_SCRIPT_SOURCE,
};

export const NODE_SCRIPT_TABLES = `[agent_rules]
enabled = false
[architecture.roles]
scripts = ["scripts/**", "child/scripts/**", "build.config.ts"]
[[generated]]
paths = ["emitted/**"]
reason = "The build owns these outputs."
[[vendored]]
paths = ["vendor/**"]
reason = "These scripts belong to a dependency."
[scope."child"]
configurations = ["javascript"]
[scope."child".reasons]
"limits.javascript.min_function_statements" = "The child exercises the scoped structural floor."
[scope."child".limits.javascript]
min_function_statements = 1
[limits.javascript]
min_function_statements = 3
function_parameters = 2
[limits.typescript]
function_parameters = 5
`;

export const NODE_SCRIPT_CONTRACTS = [
    {
        file: 'scripts/syntax',
        source: '#!/usr/bin/env node\nconst =;\n',
        corrected: '#!/usr/bin/env node\nconsole.log(process.cwd());\n',
        routine: [{ ruleId: null, line: 2, severity: 2 }],
        strict: [],
    },
    {
        file: 'scripts/globals',
        source: '#!/usr/bin/env node\nconsole.log(document.title);\n',
        corrected: '#!/usr/bin/env node\nconsole.log(process.cwd());\n',
        routine: [{ ruleId: 'no-undef', line: 2, severity: 2 }],
        strict: [],
    },
    {
        file: 'scripts/engine',
        source: '#!/usr/bin/env node\nconsole.log(Object.groupBy([1], String));\n',
        corrected: '#!/usr/bin/env node\nconsole.log(Object.groupBy([1], String));\n',
        routine: [],
        strict: [],
    },
    {
        file: 'child/scripts/engine',
        source: '#!/usr/bin/env node\nconsole.log(Object.groupBy([1], String));\n',
        corrected: '#!/usr/bin/env node\nconsole.log(Object.fromEntries([["group", [1]]]));\n',
        routine: [{ ruleId: 'n/no-unsupported-features/es-builtins', line: 2, severity: 2 }],
        strict: [],
    },
    {
        file: 'scripts/structural',
        source: '#!/usr/bin/env node\nfunction value() { const result = process.cwd(); return result; }\nconsole.log(value());\n',
        corrected: '#!/usr/bin/env node\nconsole.log(process.cwd());\n',
        routine: [],
        strict: [{ ruleId: 'gspot/no-trivial-functions', line: 2, severity: 2 }],
    },
    {
        file: 'child/scripts/structural',
        source: '#!/usr/bin/env node\nfunction value() { const result = process.cwd(); return result; }\nconsole.log(value());\n',
        corrected:
            '#!/usr/bin/env node\nfunction value() { const result = process.cwd(); return result; }\nconsole.log(value());\n',
        routine: [],
        strict: [],
    },
    {
        file: 'scripts/parameters',
        source: '#!/usr/bin/env node\nexport function sum(first, second, third) { return first + second + third; }\n',
        corrected: '#!/usr/bin/env node\nexport function sum(first, second) { return first + second; }\n',
        routine: [],
        strict: [{ ruleId: 'max-params', line: 2, severity: 2 }],
    },
    {
        file: 'scripts/imports',
        source: '#!/usr/bin/env node\nimport { value } from "../source";\nconsole.log(value);\n',
        corrected: '#!/usr/bin/env node\nimport { value } from "../source.js";\nconsole.log(value);\n',
        routine: [{ ruleId: 'n/file-extension-in-import', line: 2, severity: 2 }],
        strict: [],
    },
];

/** Raw native reports retain every diagnostic and the host's filename spelling. */

/** Native configuration applicability exposes unintended neighboring filename matches. */

/** POSIX report roots exercise filename normalization with and without literal backslashes. */
export const NODE_SCRIPT_NATIVE_ROOTS = ['project', String.raw`project\files`];

export const NODE_SCRIPT_RULES = [
    'no-unused-vars',
    '@typescript-eslint/no-unused-vars',
    'sonarjs/no-unused-vars',
    'n/no-process-exit',
    'unicorn/no-process-exit',
    'no-console',
];
export const NODE_CONTRACT_RULES = [
    'no-undef',
    'max-params',
    'gspot/no-trivial-functions',
    'n/no-unsupported-features/es-builtins',
    'n/file-extension-in-import',
];
