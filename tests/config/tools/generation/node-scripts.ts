export const NODE_SCRIPT_SOURCE =
    '#!/usr/bin/env node\nconst unused = 1;\nconsole.log(process.cwd());\nprocess.exit(0);\n';
export const NODE_SCRIPT_CORRECTED = '#!/usr/bin/env node\nconsole.log(process.cwd());\nprocess.exit(0);\n';

export const NODE_SCRIPT_PATHS = [
    'scripts/run[one]',
    'scripts/run{one,two}',
    'scripts/run.task',
    'child/scripts/run',
    'scripts/run.ts',
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
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["scripts/*.ts"]}',
    'scripts/run[one]': NODE_SCRIPT_SOURCE,
    'scripts/run{one,two}': NODE_SCRIPT_SOURCE,
    'scripts/run.task': NODE_SCRIPT_SOURCE,
    'child/scripts/run': NODE_SCRIPT_SOURCE,
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
[tools.eslint]
script_files = ["scripts/**", "child/scripts/**"]
[[generated]]
paths = ["emitted/**"]
reason = "The build owns these outputs."
[[vendored]]
paths = ["vendor/**"]
reason = "These scripts belong to a dependency."
[[scope]]
path = "child"
configurations = ["javascript"]
[scope.limits.javascript]
min_function_statements = 1
[limits.javascript]
min_function_statements = 3
function_parameters = 2
[limits.typescript]
function_parameters = 5
`;

export const NODE_SCRIPT_LINT_SOURCE = String.raw`import { ESLint } from 'eslint';
const eslint = new ESLint({ overrideConfigFile: '.gspot/config/eslint.config.mjs' });
const [paths, controls] = JSON.parse(process.argv[1]);
const results = await eslint.lintFiles(paths);
const configurations = await Promise.all(controls.map(async (file) => ({ file, matched: await eslint.calculateConfigForFile(file) !== undefined })));
process.stdout.write(JSON.stringify({ results: results.map(({ filePath, messages }) => ({
    file: filePath.slice(process.cwd().length + 1).replaceAll('\\', '/'),
    findings: messages.filter(({ ruleId }) => ruleId === null || ['no-unused-vars', '@typescript-eslint/no-unused-vars',
        'sonarjs/no-unused-vars', 'n/no-process-exit', 'unicorn/no-process-exit', 'no-console'].includes(ruleId))
        .map(({ ruleId, line, severity }) => ({ ruleId, line, severity }))
        .toSorted((left, right) => left.ruleId.localeCompare(right.ruleId)),
})), configurations }));
`;

export const NODE_SCRIPT_CONTRACT_SOURCE = String.raw`import { ESLint } from 'eslint';
const eslint = new ESLint({ overrideConfigFile: '.gspot/config/eslint.config.mjs' });
const results = await eslint.lintFiles(JSON.parse(process.argv[1]));
process.stdout.write(JSON.stringify(results.map(({ filePath, messages }) => ({
    file: filePath.slice(process.cwd().length + 1).replaceAll('\\', '/'),
    findings: messages.filter(({ ruleId }) => ruleId === null || ['no-undef', 'max-params', 'gspot/no-trivial-functions',
        'n/no-unsupported-features/es-builtins', 'gspot/import-extensions'].includes(ruleId))
        .map(({ ruleId, line, severity }) => ({ ruleId, line, severity }))
        .toSorted((left, right) => left.ruleId.localeCompare(right.ruleId) || left.line - right.line),
}))));
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
        routine: [{ ruleId: 'gspot/import-extensions', line: 2, severity: 2 }],
        strict: [],
    },
];
