export const ARCHITECTURE_CASES = [
    { level: 'recommended', declarations: 'none' } as const,
    { level: 'recommended', declarations: 'root' } as const,
    { level: 'recommended', declarations: 'scoped' } as const,
    { level: 'all', declarations: 'none' } as const,
    { level: 'all', declarations: 'root' } as const,
    { level: 'all', declarations: 'scoped' } as const,
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
