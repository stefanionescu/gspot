const TYPED_NODE_SCRIPT = `const unused: number = 1;
console.log("result");
process.exit(0);
`;

export const ENGINE_SCOPES = `[[tools.eslint.override]]
paths = ["browser/**"]
runtime = "browser"
[[scope]]
path = "old"
[[scope]]
path = "new"
[[scope]]
path = "forced"
[[scope]]
path = "old/legacy"
[[scope]]
path = "browser"
`;

export const ENGINE_PACKAGES = {
    'package.json': '{"private":true,"type":"module","engines":{"node":">=18.0.0"}}',
    'old/package.json': '{"private":true,"type":"module","engines":{"node":">=18.0.0"}}',
    'new/package.json': '{"private":true,"type":"module","engines":{"node":">=22.0.0"}}',
    'forced/package.json': '{"private":true,"type":"module","engines":{"node":">=18.0.0"}}',
    'old/legacy/package.json': '{"private":true,"type":"module","engines":{"node":">=22.0.0"}}',
} as const;

export const ENGINE_PATHS = [
    'old/source.js',
    'old/source.cjs',
    'new/source.js',
    'forced/source.js',
    'old/legacy/source.js',
    'browser/source.js',
] as const;

export const ENGINE_SOURCE = 'export const grouped = Object.groupBy([1], String);\nprocess.loadEnvFile();\n';

export const ENGINE_FINDINGS = [
    { ruleId: 'n/no-unsupported-features/es-builtins', line: 1 },
    { ruleId: 'n/no-unsupported-features/node-builtins', line: 2 },
] as const;

export const ENGINE_PHASES = [
    { reported: ['old/source.js', 'old/source.cjs', 'forced/source.js'], corrections: [] },
    { reported: [], corrections: ['old/source.js', 'old/source.cjs', 'forced/source.js'] },
] as const;

const NODE_SCRIPT_SOURCE = `#!/usr/bin/env node
const unused = 1;
console.log(process.cwd());
process.exit(0);
`;

const NODE_SCRIPT_CORRECTED = `#!/usr/bin/env node
console.log(process.cwd());
process.exit(0);
`;

const NODE_SCRIPT_OUTPUT = 'console.log("result");\nprocess.exit(0);\n';

export const NODE_SCRIPT_CASES = [
    {
        file: 'scripts/run[one]',
        recommended: [{ ruleId: 'no-unused-vars', line: 2 }],
        corrected: NODE_SCRIPT_CORRECTED,
    },
    {
        file: 'scripts/run{one,two}',
        recommended: [{ ruleId: 'no-unused-vars', line: 2 }],
        corrected: NODE_SCRIPT_CORRECTED,
    },
    {
        file: 'scripts/run.task',
        recommended: [{ ruleId: 'no-unused-vars', line: 2 }],
        corrected: NODE_SCRIPT_CORRECTED,
    },
    {
        file: 'child/scripts/run',
        recommended: [{ ruleId: 'no-unused-vars', line: 2 }],
        corrected: NODE_SCRIPT_CORRECTED,
    },
    {
        file: 'scripts/run.ts',
        recommended: [{ ruleId: '@typescript-eslint/no-unused-vars', line: 2 }],
        corrected: NODE_SCRIPT_CORRECTED,
    },
    {
        file: 'scripts/typed.ts',
        recommended: [{ ruleId: '@typescript-eslint/no-unused-vars', line: 1 }],
        corrected: NODE_SCRIPT_OUTPUT,
    },
    {
        file: 'scripts/run.js',
        recommended: [{ ruleId: 'no-unused-vars', line: 1 }],
        corrected: NODE_SCRIPT_OUTPUT,
    },
    {
        file: 'build.config.ts',
        recommended: [{ ruleId: '@typescript-eslint/no-unused-vars', line: 1 }],
        corrected: NODE_SCRIPT_OUTPUT,
    },
    {
        file: 'src/source.ts',
        recommended: [{ ruleId: '@typescript-eslint/no-unused-vars', line: 1 }],
        corrected: 'export const result = 1;\n',
        all: [
            { ruleId: 'n/no-process-exit', line: 3 },
            { ruleId: 'no-console', line: 2 },
        ],
    },
] as const;

export const UNLINTED_FILES = [
    'scripts/runo',
    'scripts/runone',
    'scripts/plain',
    'scripts/python',
    'emitted/run',
    'vendor/run',
] as const;

export const NODE_SCRIPT_FILES = {
    '.gitattributes': 'emitted/** linguist-generated\nvendor/** linguist-vendored\n',
    'package.json': '{"private":true,"type":"module","engines":{"node":">=22.0.0"}}',
    'child/package.json': '{"private":true,"type":"module","engines":{"node":">=18.0.0"}}',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["scripts/*.ts","build.config.ts","src/*.ts"]}',
    'scripts/run[one]': NODE_SCRIPT_SOURCE,
    'scripts/run{one,two}': NODE_SCRIPT_SOURCE,
    'scripts/run.task': NODE_SCRIPT_SOURCE,
    'child/scripts/run': NODE_SCRIPT_SOURCE,
    'scripts/typed.ts': TYPED_NODE_SCRIPT,
    'scripts/run.js': `const unused = 1;
console.log("result");
process.exit(0);
`,
    'build.config.ts': TYPED_NODE_SCRIPT,
    'src/source.ts': TYPED_NODE_SCRIPT,
    'scripts/run.ts': `#!/usr/bin/env node
const unused: number = 1;
console.log(process.cwd());
process.exit(0);
`,
    'scripts/runo': '#!/usr/bin/env bash\necho ready\n',
    'scripts/runone': '#!/usr/bin/env bash\necho ready\n',
    'scripts/plain': 'const unused = 1;\n',
    'scripts/python': '#!/usr/bin/env python3\nprint("ready")\n',
    'emitted/run': NODE_SCRIPT_SOURCE,
    'vendor/run': NODE_SCRIPT_SOURCE,
} as const;

export const NODE_SCRIPT_TABLES = `[javascript]
script_files = ["scripts/**", "child/scripts/**", "build.config.ts"]

[limits.javascript]
trivial_function_statements = 3
function_parameters = 2

[limits.typescript]
function_parameters = 5

[[scope]]
path = "child"
configurations = ["javascript"]

[scope.limits.javascript]
trivial_function_statements = { value = 1, reason = "The child exercises the scoped structural limit." }
`;

export const EXTENSIONLESS_SCRIPT_CASES = [
    {
        file: 'scripts/syntax',
        source: '#!/usr/bin/env node\nconst =;\n',
        corrected: '#!/usr/bin/env node\nconsole.log(process.cwd());\n',
        recommended: [{ ruleId: null, line: 2 }],
    },
    {
        file: 'scripts/globals',
        source: '#!/usr/bin/env node\nconsole.log(document.title);\n',
        corrected: '#!/usr/bin/env node\nconsole.log(process.cwd());\n',
        recommended: [{ ruleId: 'no-undef', line: 2 }],
    },
    {
        file: 'scripts/engine',
        source: '#!/usr/bin/env node\nconsole.log(Object.groupBy([1], String));\n',
        corrected: '#!/usr/bin/env node\nconsole.log(Object.groupBy([1], String));\n',
        recommended: [],
    },
    {
        file: 'child/scripts/engine',
        source: '#!/usr/bin/env node\nconsole.log(Object.groupBy([1], String));\n',
        corrected: '#!/usr/bin/env node\nconsole.log(Object.fromEntries([["group", [1]]]));\n',
        recommended: [{ ruleId: 'n/no-unsupported-features/es-builtins', line: 2 }],
    },
    {
        file: 'scripts/structural',
        source: `#!/usr/bin/env node
function value() { const result = process.cwd(); return result; }
console.log(value());
`,
        corrected: '#!/usr/bin/env node\nconsole.log(process.cwd());\n',
        recommended: [],
        all: [{ ruleId: 'gspot/no-trivial-functions', line: 2 }],
    },
    {
        file: 'child/scripts/structural',
        source: `#!/usr/bin/env node
function value() { const result = process.cwd(); return result; }
console.log(value());
`,
        corrected: `#!/usr/bin/env node
function value() { const result = process.cwd(); return result; }
console.log(value());
`,
        recommended: [],
    },
    {
        file: 'scripts/parameters',
        source: '#!/usr/bin/env node\nexport function sum(first, second, third) { const partial = first + second; const total = partial + third; console.log(total); return total; }\n',
        corrected:
            '#!/usr/bin/env node\nexport function sum(first, second) { const partial = first + second; const total = partial * 2; console.log(total); return total; }\n',
        recommended: [],
        all: [{ ruleId: 'max-params', line: 2 }],
    },
    {
        file: 'scripts/imports',
        source: `#!/usr/bin/env node
import { value } from "../source";
console.log(value);
`,
        corrected: `#!/usr/bin/env node
import { value } from "../source.js";
console.log(value);
`,
        recommended: [{ ruleId: 'n/file-extension-in-import', line: 2 }],
    },
] as const;

export const NODE_SCRIPT_RULES = [
    'no-unused-vars',
    '@typescript-eslint/no-unused-vars',
    'sonarjs/no-unused-vars',
    'n/no-process-exit',
    'unicorn/no-process-exit',
    'no-console',
] as const;

export const EXTENSIONLESS_SCRIPT_RULES = [
    'no-undef',
    'max-params',
    'gspot/no-trivial-functions',
    'n/no-unsupported-features/es-builtins',
    'n/file-extension-in-import',
] as const;

export const PACKAGE_MANAGER_LEVELS = [
    { level: 'recommended', severity: 0 },
    { level: 'all', severity: 2 },
] as const;
