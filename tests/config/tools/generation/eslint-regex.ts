export const REGEX_PROJECT = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"target":"ESNext","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["*.ts"]}\n',
    'regex-exponential.js': 'export const pattern = /^(a+)+$/;\n',
    'regex-exponential.ts': 'export const pattern = /^(a+)+$/;\n',
    'regex-polynomial.js': 'export const pattern = /^a*a*$/;\n',
    'regex-polynomial.ts': 'export const pattern = /^a*a*$/;\n',
    'regex-safe.js': 'export const pattern = /^(a+z)+$/;\n',
    'regex-safe.ts': 'export const pattern = /^(a+z)+$/;\n',
    'regex-bounded.js': 'export const pattern = /^(a{1,2}){1,2}$/;\n',
    'regex-bounded.ts': 'export const pattern = /^(a{1,2}){1,2}$/;\n',
    'regex-constructor.js': "export const pattern = new RegExp('^(a+)+$');\n",
    'regex-constructor.ts': "export const pattern = new RegExp('^(a+)+$');\n",
    'regex-template.js': 'export const pattern = new RegExp(`^(a+)+$`);\n',
    'regex-template.ts': 'export const pattern = new RegExp(`^(a+)+$`);\n',
    'regex-unicode.js': 'export const pattern = /^[a&&a]+$/v;\n',
    'regex-unicode.ts': 'export const pattern = /^[a&&a]+$/v;\n',
};

export const REGEX_FINDINGS = [
    { file: 'regex-bounded.js', findings: [] },
    { file: 'regex-bounded.ts', findings: [] },
    {
        file: 'regex-constructor.js',
        findings: [{ ruleId: 'regexp/no-super-linear-backtracking', line: 1, column: 38, severity: 2 }],
    },
    {
        file: 'regex-constructor.ts',
        findings: [{ ruleId: 'regexp/no-super-linear-backtracking', line: 1, column: 38, severity: 2 }],
    },
    {
        file: 'regex-exponential.js',
        findings: [{ ruleId: 'regexp/no-super-linear-backtracking', line: 1, column: 27, severity: 2 }],
    },
    {
        file: 'regex-exponential.ts',
        findings: [{ ruleId: 'regexp/no-super-linear-backtracking', line: 1, column: 27, severity: 2 }],
    },
    {
        file: 'regex-polynomial.js',
        findings: [{ ruleId: 'regexp/no-super-linear-backtracking', line: 1, column: 26, severity: 2 }],
    },
    {
        file: 'regex-polynomial.ts',
        findings: [{ ruleId: 'regexp/no-super-linear-backtracking', line: 1, column: 26, severity: 2 }],
    },
    { file: 'regex-safe.js', findings: [] },
    { file: 'regex-safe.ts', findings: [] },
    {
        file: 'regex-template.js',
        findings: [{ ruleId: 'regexp/no-super-linear-backtracking', line: 1, column: 35, severity: 2 }],
    },
    {
        file: 'regex-template.ts',
        findings: [{ ruleId: 'regexp/no-super-linear-backtracking', line: 1, column: 35, severity: 2 }],
    },
    { file: 'regex-unicode.js', findings: [] },
    { file: 'regex-unicode.ts', findings: [] },
];

export const REGEX_CORRECTION = 'export const pattern = /^a+$/;\n';

export const REGEX_SCRIPT = `import { basename } from 'node:path';
import { ESLint } from 'eslint';
const eslint = new ESLint({ overrideConfigFile: '.gspot/config/eslint.config.mjs' });
const names = ["regexp/no-super-linear-backtracking", "sonarjs/slow-regex", "security/detect-unsafe-regex"];
const config = await eslint.calculateConfigForFile("regex-exponential.js");
const results = await eslint.lintFiles(["regex-exponential.js", "regex-exponential.ts", "regex-polynomial.js", "regex-polynomial.ts", "regex-safe.js", "regex-safe.ts", "regex-bounded.js", "regex-bounded.ts", "regex-constructor.js", "regex-constructor.ts", "regex-template.js", "regex-template.ts", "regex-unicode.js", "regex-unicode.ts"].sort());
process.stdout.write(JSON.stringify({ severities: names.map((name) => config.rules[name][0]),
    files: results.map(({ filePath, messages }) => ({ file: basename(filePath),
        findings: messages.filter(({ ruleId, fatal }) => names.includes(ruleId) || fatal)
            .map(({ ruleId, line, column, severity }) => ({ ruleId, line, column, severity })),
    })),
}));
`;
