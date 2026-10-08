export const DEPRECATION_PROJECT = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"target":"ESNext","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["*.ts"]}\n',
    'api.ts':
        '/** @deprecated Use current instead. */\nexport function legacy(value: number): number { return value; }\nexport const current = 1;\n/** @deprecated Use current instead. */\nexport const old = 1;\n/** @deprecated Use current instead. */\nexport class Old {}\nexport const object = {\n /** @deprecated Use current instead. */\n old: 1,\n current: 1,\n};\n/** @deprecated Use current instead. */\nexport type OldType = { value: number };\n/** @deprecated Use a string input. */\nexport function overloaded(value: number): number;\nexport function overloaded(value: string): string;\nexport function overloaded(value: number | string): number | string { return value; }\n',
    'deprecated.ts':
        "import { legacy as oldFunction, old, Old, object } from './api.js';\nexport const result = oldFunction(old);\nexport const instance = new Old();\nexport const value = object.old;\nexport const computed = object['old'];\n",
    'type-reference.ts': "import type { OldType } from './api.js';\nexport const result: OldType = { value: 1 };\n",
    'overload-deprecated.ts': "import { overloaded } from './api.js';\nexport const result = overloaded(1);\n",
    'overload-current.ts': "import { overloaded } from './api.js';\nexport const result = overloaded('current');\n",
    'current.ts': "import { current, object } from './api.js';\nexport const result = current + object.current;\n",
};

export const DEPRECATION_FINDINGS = [
    { file: 'api.ts', findings: [] },
    { file: 'current.ts', findings: [] },
    {
        file: 'deprecated.ts',
        findings: [
            { ruleId: '@typescript-eslint/no-deprecated', line: 2, column: 23, severity: 2 },
            { ruleId: '@typescript-eslint/no-deprecated', line: 2, column: 35, severity: 2 },
            { ruleId: '@typescript-eslint/no-deprecated', line: 3, column: 29, severity: 2 },
            { ruleId: '@typescript-eslint/no-deprecated', line: 4, column: 29, severity: 2 },
            { ruleId: '@typescript-eslint/no-deprecated', line: 5, column: 32, severity: 2 },
        ],
    },
    { file: 'overload-current.ts', findings: [] },
    {
        file: 'overload-deprecated.ts',
        findings: [{ ruleId: '@typescript-eslint/no-deprecated', line: 2, column: 23, severity: 2 }],
    },
    {
        file: 'type-reference.ts',
        findings: [{ ruleId: '@typescript-eslint/no-deprecated', line: 2, column: 22, severity: 2 }],
    },
];

export const DEPRECATION_CORRECTION = "import { current } from './api.js';\nexport const result = current;\n";

export const DEPRECATION_RULE_NAMES = ['@typescript-eslint/no-deprecated', 'sonarjs/deprecation'];
export const DEPRECATION_SEVERITIES = [2, 0];
