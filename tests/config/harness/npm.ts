import type { RegistryPackage } from '#automation/types/registry.ts';
// The authored files every package project starts from.
export const AUTHORED_FILES = {
    'other/package.json': '{"private":true,"packageManager":"npm@99.0.0"}',
    'source.js': 'export const greeting="hello";',
    'node_modules/authored.txt': 'keep project dependencies',
};

export const EDITORCONFIG_PACKAGE: RegistryPackage = {
    name: 'editorconfig-checker',
    source: 'editorconfig-checker@7.0.0',
    version: '7.0.0',
    bin: { ec: 'dist/index.js', 'editorconfig-checker': 'dist/index.js' },
};

/** The package managers, manifest paths, and runners a package project test covers. */
export const PACKAGE_PROJECTS = [
    ['npm', 'package.json', 'mise'],
    ['bun', 'package.json', 'mise'],
    ['pnpm', 'package.json', 'mise'],
    ['yarn', 'package.json', 'mise'],
    ['npm', 'apps/web/package.json', 'mise'],
    ['npm', 'package.json', 'none'],
] as const;

export const VERSION_TIMEOUT_MS = 15_000;

/** Package-manager fixtures exercise Prettier and native EditorConfig acquisition, not application analyzers. */
export const EXCLUDED_PACKAGE_CHECKS = [
    'files/v8r',
    'javascript/eslint',
    'javascript/tsc',
    'javascript/knip',
    'javascript/rules-off',
];
