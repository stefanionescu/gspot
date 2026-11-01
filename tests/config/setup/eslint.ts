export const RULE_TESTER_ROOT = '/repo';

export const RULE_TESTER_PARSER_OPTIONS = {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
} as const;

export const TYPED_RULE_FOLDER_PREFIX = 'typed-rules-';

export const TYPED_RULE_FILES = ['file.ts', 'react.tsx'] as const;

export const TYPED_RULE_TSCONFIG = JSON.stringify({
    compilerOptions: { strict: true, target: 'esnext', module: 'nodenext', lib: ['esnext', 'dom'], jsx: 'preserve' },
    include: ['*.ts', '*.tsx'],
});
