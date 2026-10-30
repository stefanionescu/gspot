import { STRICT_COMPILER_OPTIONS } from '#tests/config/typescript.ts';
import { STYLELINT_FILES } from '#tests/config/authored-config-files.ts';

export const SETUP_CASES = [
    ['github', 0],
    ['github', 29],
    ['gitlab', 0],
    ['gitlab', 29],
] as const;

export const SETUP_ARGUMENTS = [
    '',
    'two words',
    "a'b",
    '$(touch unexpected)',
    'x; touch unexpected',
    'line\nbreak',
] as const;

export const LINUX_PIPELINE = {
    version: '1.2.3',
    packageManager: { name: 'npm' as const, version: '11.10.1' },
    operatingSystems: ['linux' as const],
    linuxRunner: 'ubuntu-24.04' as const,
    lockfiles: ['package-lock.json', 'web/pnpm-lock.yaml'],
    hasSwift: false,
    projectInstall: [],
    packageManagers: ['npm' as const, 'pnpm' as const],
};

export const LINT_STEPS = [
    'Check out source',
    'Restore caches',
    'Set up mise',
    'Install gspot',
    'Install gspot tools',
    'Save caches',
    'Lint',
] as const;

export const START_COMMANDS = [
    ['npm', 'npm@11.10.1', ['exec', '--no', '--', 'gspot']],
    ['pnpm', 'pnpm@10.32.1', ['exec', 'gspot']],
    ['yarn', 'yarn@4.13.0', ['exec', '--', 'gspot']],
    ['bun', 'bun@1.4.2', ['run', '--no-install', 'gspot']],
    ['mise', undefined, ['exec', '--', 'gspot']],
] as const;

export const HOOK_CASES = [
    ['pre-commit', []],
    ['pre-push', ['origin', 'https://example.com/repository.git']],
    ['commit-msg', ['message']],
] as const;

export const LICENSE_TOOL_CASES = [{ configurations: ['licenses'] }, { configurations: [] }] as const;

export const STYLESHEET_CASES = [
    { name: 'plain CSS', configurations: ['css'], files: { 'site.css': 'a { color: red; }' }, needsHtmlParser: true },
    {
        name: 'Vue without Stylelint',
        configurations: ['vue'],
        files: { 'Card.vue': '<template><p>Card</p></template>' },
        needsHtmlParser: false,
    },
] as const;

export const REACT_NATIVE_TSCONFIG = {
    compilerOptions: {
        ...STRICT_COMPILER_OPTIONS,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
    },
    include: ['src'],
} as const;

export const STYLELINT_PACKAGE_FIELDS = {
    project: {
        ...STYLELINT_FILES,
        'app/child/source.css': 'a { opacity: 1; }\n',
        'other/source.css': 'a { opacity: 1; }\n',
    },
    configurations: ['css'],
    tables: '[[scope]]\npath = "app"\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "other"\n',
    unchanged: ['plain/package.json'],
    changes: [
        { path: 'package.json', keys: [{ key: ['stylelint'], value: { extends: './.stylelintrc.yml' } }] },
        {
            path: 'app/child/package.json',
            keys: [
                {
                    key: ['stylelint'],
                    value: { extends: '../../.gspot/configurations/language/css/stylelint.json' },
                },
            ],
        },
        {
            path: 'app/package.json',
            keys: [{ key: ['stylelint'], value: { extends: '../.gspot/configurations/language/css/stylelint.json' } }],
        },
        {
            path: 'other/package.json',
            keys: [{ key: ['stylelint'], value: { extends: '../.gspot/configurations/language/css/stylelint.json' } }],
        },
    ],
};

export const EDITED_STYLELINT_PACKAGE = `{
  "name": "edited-project",
  "private": true,
  "type": "module",
  "stylelint": {"rules":{"property-no-unknown":null}}
}
`;
