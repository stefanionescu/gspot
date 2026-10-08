import type { ArchitectureToolCase } from '#tests/types/generation/configuration-files.ts';

export const ARCHITECTURE_CASES: ArchitectureToolCase[] = [
    { level: 'recommended', declarations: 'none' },
    { level: 'recommended', declarations: 'root' },
    { level: 'recommended', declarations: 'scoped' },
    { level: 'all', declarations: 'none' },
    { level: 'all', declarations: 'root' },
    { level: 'all', declarations: 'scoped' },
];

export const ARCHITECTURE_POLICIES = {
    none: '[scope."apps/api"]\nconfigurations = ["typescript"]\n',
    root: '[[architecture.modules]]\nname = "app"\npaths = ["app/**"]\nmay_import = ["app"]\n[[architecture.modules]]\nname = "storage"\npaths = ["storage/**"]\n[scope."apps/api"]\nconfigurations = ["typescript"]\n',
    scoped: '[scope."apps/api"]\nconfigurations = ["typescript"]\n[[scope."apps/api".architecture.modules]]\nname = "app"\npaths = ["app/**"]\nmay_import = ["app"]\n[[scope."apps/api".architecture.modules]]\nname = "storage"\npaths = ["storage/**"]\n',
};

export const ARCHITECTURE_PROJECT = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["app/**/*.ts","storage/**/*.ts"]}\n',
    'apps/api/tsconfig.json':
        '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["app/**/*.ts","storage/**/*.ts"]}\n',
    'app/source.ts': "import { value } from '../storage/value.js';\nexport const result = value;\n",
    'storage/value.ts': 'export const value = 1;\n',
    'app/value.ts': 'export const value = 2;\n',
    'apps/api/app/source.ts': "import { value } from '../storage/value.js';\nexport const result = value;\n",
    'apps/api/storage/value.ts': 'export const value = 1;\n',
    'apps/api/app/value.ts': 'export const value = 2;\n',
};

export const ARCHITECTURE_CORRECTION = "import { value } from './value.js';\nexport const result = value;\n";

export const ARCHITECTURE_SCRIPT = `import { ESLint } from 'eslint';
const eslint = new ESLint({ overrideConfigFile: '.gspot/config/eslint.config.mjs' });
const files = ['app/source.ts', 'apps/api/app/source.ts'];
const configured = [];
for (const file of files) {
    const config = await eslint.calculateConfigForFile(file);
    configured.push({ plugin: Object.hasOwn(config.plugins, 'boundaries'),
        classic: Object.hasOwn(config.settings, 'import/resolver'),
        modern: Object.hasOwn(config.settings, 'import-x/resolver-next') });
}
const results = await eslint.lintFiles(files);
process.stdout.write(JSON.stringify({ configured,
    findings: results.map(({ messages }) => messages
        .filter(({ ruleId, fatal }) => ruleId === 'boundaries/dependencies' || fatal)
        .map(({ ruleId, line, column, severity }) => ({ ruleId, line, column, severity }))),
}));
`;
