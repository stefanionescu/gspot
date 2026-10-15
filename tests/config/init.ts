import { CLEAN_BASH_SCRIPT } from '#tests/config/bash/tools.ts';

/** Authored lint jobs that suppress automatic CI selection but must not override a provider flag. */
export const LINT_JOBS = [
    { name: 'a GitLab lint job', path: '.gitlab-ci.yml', content: 'quality:\n  script: npm run lint\n' },
    {
        name: 'a GitHub lint job',
        path: '.github/workflows/application.yml',
        content: `on: push
jobs:
  quality:
    runs-on: ubuntu-24.04
    steps:
      - run: npm run lint
`,
    },
] as const;

/** Repository CI signals and the provider each signal selects. */
export const CI_PREFERENCE_CASES = [
    [
        'a GitHub workflow before a GitLab remote',
        ['.github/workflows/build.yml'],
        '',
        'git@gitlab.com:example/repo.git',
        'github',
    ],
    [
        'tracked GitLab before GitHub',
        ['.gitlab-ci.yml', '.github/workflows/build.yml'],
        '',
        'git@github.com:example/repo.git',
        'gitlab',
    ],
    ['GitHub remote with untracked GitLab', [], '.gitlab-ci.yml', 'git@github.com:example/repo.git', 'github'],
    [
        'GitHub remote with unrelated Bitbucket configuration',
        ['bitbucket-pipelines.yml'],
        '',
        'git@github.com:example/repo.git',
        'github',
    ],
    ['GitHub SSH remote', [], '', 'git@github.com:example/repo.git', 'github'],
    ['unrecognized remote host', [], '', 'https://github.com.example.com/example/repo.git', 'none'],
] as const;

export const INIT_CONFIGURATIONS = [
    'typescript',
    'javascript',
    'react',
    'nextjs',
    'css',
    'html',
    'markdown',
    'prose',
    'spelling',
    'commits',
    'files',
    'naming',
    'format',
    'docs',
    'secrets',
    'dependencies',
    'licenses',
] as const;

export const SDK_DESTINATIONS = [
    { sdk: 'iphoneos', destination: 'generic/platform=iOS Simulator' },
    { sdk: 'iphonesimulator', destination: 'generic/platform=iOS Simulator' },
    { sdk: 'macosx', destination: 'platform=macOS' },
    { sdk: 'watchos', destination: 'generic/platform=watchOS Simulator' },
    { sdk: 'watchsimulator', destination: 'generic/platform=watchOS Simulator' },
    { sdk: 'xros', destination: 'generic/platform=visionOS Simulator' },
    { sdk: 'xrsimulator', destination: 'generic/platform=visionOS Simulator' },
] as const;

export const TEMPLATE_SWIFT_CHOICES = [
    { name: 'selected project', xcode: { project: 'Chosen.xcodeproj' }, destination: 'platform=macOS' },
    {
        name: 'manual destination',
        xcode: { project: 'Chosen.xcodeproj', destination: 'custom destination' },
        destination: 'custom destination',
    },
] as const;

export const FORMAT_FILE_CASES = [
    {
        name: 'no formatter configuration',
        files: {},
        expected: { indent_width: 4, print_width: 120, quotes: 'single' },
    },
    {
        name: 'Prettier dependency without configuration',
        files: { 'package.json': '{"devDependencies":{"prettier":"3.8.1"}}' },
        expected: { indent_width: 2, print_width: 80, quotes: 'double' },
    },
    {
        name: 'partial Prettier JSON configuration',
        files: { '.prettierrc.json': '{"tabWidth":3}' },
        expected: { indent_width: 3, print_width: 80, quotes: 'double' },
    },
    {
        name: 'Prettier package configuration',
        files: { 'package.json': '{"prettier":{"tabWidth":6,"printWidth":100,"singleQuote":true}}' },
        expected: { indent_width: 6, print_width: 100, quotes: 'single' },
    },
    {
        name: 'Prettier JavaScript configuration',
        files: { 'prettier.config.mjs': 'export default { tabWidth: 3, printWidth: 90, singleQuote: false };' },
        expected: { indent_width: 2, print_width: 80, quotes: 'double' },
    },
    {
        name: 'EditorConfig without indent_style',
        files: {
            '.editorconfig': `root = true
[*]
indent_size = 3
max_line_length = 96
`,
        },
        expected: { indent_width: 3, print_width: 96, quotes: 'single' },
    },
    {
        name: 'Prettier precedence over EditorConfig',
        files: {
            '.prettierrc.json': '{"singleQuote":true}',
            '.editorconfig': `root = true
[*]
indent_size = 6
max_line_length = 96
`,
        },
        expected: { indent_width: 2, print_width: 80, quotes: 'single' },
    },
    {
        name: 'declared Prettier defaults before EditorConfig',
        files: {
            'package.json': '{"devDependencies":{"prettier":"3.8.1"}}',
            '.editorconfig': `root = true
[*]
indent_size = 6
max_line_length = 96
`,
        },
        expected: { indent_width: 2, print_width: 80, quotes: 'double' },
    },
] as const;

export const SCOPE_FORMAT_FILES = {
    '.prettierrc.json': '{"tabWidth":2,"printWidth":90,"singleQuote":false}',
    'app/.prettierrc.json': '{"tabWidth":6,"printWidth":100,"singleQuote":true}',
    'app/source.js': 'export const app = 1;\n',
    'app/deep/source.js': 'export const deep = 1;\n',
    'sibling/source.js': 'export const sibling = 1;\n',
} as const;

export const SCOPE_FORMAT_CASES = [
    {
        name: 'repository configuration',
        template: '',
        expected: [
            ['', 2, 90, 'double'],
            ['app', 6, 100, 'single'],
            ['app/deep', 6, 100, 'single'],
            ['sibling', 2, 90, 'double'],
        ],
    },
    {
        name: 'template precedence',
        template: `[format]
print_width = 70
quotes = "double"
`,
        expected: [
            ['', 2, 70, 'double'],
            ['app', 6, 70, 'double'],
            ['app/deep', 6, 70, 'double'],
            ['sibling', 2, 70, 'double'],
        ],
    },
] as const;

/** Git-dependent plan rows belong only to a repository with a Git index. */
export const GIT_PLAN_CASES = [
    { name: 'a folder outside Git', hasGit: false },
    { name: 'a Git repository', hasGit: true },
] as const;

export const NON_JAVASCRIPT_PROJECTS = [['Python', 'source.py', 'VALUE = 1\n']] as const;

export const TOOLING_PACKAGE = '{"private":true,"devDependencies":{"prettier":"3.8.1"}}\n';

export const REPLACED_TOOL_FILES = {
    'typos.toml': `[default.extend-words]
# The device identifier API name.
udid = "udid"
`,
    '.shellcheckrc': 'disable=SC2086,SC2034\n',
    '.markdownlint.jsonc': '// Keep long prose lines.\n{ "MD013": false, "MD033": true, }\n',
    '.eslintrc.json': '{ "rules": { "eqeqeq": "error" } }\n',
    '.prettierrc': '{ "semi": false }\n',
} as const;

export const INIT_FILES = {
    ...REPLACED_TOOL_FILES,
    'scripts/a.sh': CLEAN_BASH_SCRIPT,
    'src/a.js': 'export const a = 1;\n',
    'README.md': '# test\n',
    'quality/lint.sh': CLEAN_BASH_SCRIPT,
} as const;

/** Empty and named manual language lists both retain common checks. */
export const CONFIGURATION_CHOICES = [
    { configurations: undefined },
    { configurations: [] },
    { configurations: ['python'] },
] as const;
