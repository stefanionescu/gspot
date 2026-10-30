import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/files/gspot.ts';

export const INI_HEADING_CASES = [
    ['too long', '[sqlfluffbox]\nvalue = 3\n'],
    ['incomplete', '[sqlfluff\nvalue = 3\n'],
] as const;

export const CONFLICT_FILES = {
    '.toolrc': '{}',
    'nested/.toolrc': '{}',
    'tool.config': '{}',
    'nested/tool.config': '{}',
    'app/package.json': '{"name":"app"}',
    'app/tool.config': '{}',
    'shared.json': '{"first":{},"second":{}}',
    'root.config': '{}',
    'ignored.untracked': '{}',
};

export const CONFLICT_REPLACEMENTS = ['.toolrc', 'tool.config', 'root.config', '*.untracked'];

export const ORDERED_CONFLICTS = [
    { tool: 'first', path: '.toolrc', shared: false },
    { tool: 'first', path: 'nested/.toolrc', shared: false },
    { tool: 'first', path: 'tool.config', shared: false },
    { tool: 'first', path: 'app/tool.config', shared: false },
    { tool: 'first', path: 'root.config', shared: false },
    { tool: 'first', path: 'shared.json', shared: true, key: 'first' },
    { tool: 'first', path: 'shared.json', shared: true, key: 'second' },
    { tool: 'second', path: '.toolrc', shared: false },
    { tool: 'second', path: 'nested/.toolrc', shared: false },
];

export const DUBIOUS_GIT_ENVIRONMENT = {
    GIT_TEST_ASSUME_DIFFERENT_OWNER: '1',
    LC_ALL: 'C',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'safe.directory',
    GIT_CONFIG_VALUE_0: '',
} as const;

export const ROOT_DISCOVERY_CASES = [
    {
        name: 'the nearest gspot.toml',
        files: { 'gspot.toml': 'configurations = []\n' },
        start: 'nested',
    },
    { name: 'the requested folder when no gspot.toml exists', files: {}, start: '' },
] as const;

export const SCOPE_PATHS = [
    { scope: '', path: '', repositoryPath: '' },
    { scope: '', path: 'README.md', repositoryPath: 'README.md' },
    { scope: 'app', path: '', repositoryPath: 'app/' },
    { scope: 'app', path: 'package.json', repositoryPath: 'app/package.json' },
    { scope: 'packages/app', path: 'src/main.ts', repositoryPath: 'packages/app/src/main.ts' },
    { scope: 'apps/日本語 [web]', path: 'src/hello world.ts', repositoryPath: 'apps/日本語 [web]/src/hello world.ts' },
] as const;

export const PROJECT_FILE_FOLDERS = [
    ['api/package.json', 'package.json', 'api'],
    ['package.json', 'package.json', ''],
    ['services/billing/requirements-dev.txt', 'requirements*.txt', 'services/billing'],
    ['ios/App.xcodeproj/project.pbxproj', '*.xcodeproj', 'ios'],
    ['apps/web/supabase/config.toml', 'supabase/config.toml', 'apps/web'],
    ['supabase/config.toml', 'supabase/config.toml', ''],
    ['api/package-lock.json', 'package.json', undefined],
    ['docs/supabase.md', 'supabase/config.toml', undefined],
    ['ios/App.xcworkspace/contents.xcworkspacedata', '*.xcodeproj', undefined],
    ['requirements.txt.bak', 'requirements*.txt', undefined],
] as const;

export const WORKSPACE_FILE_CASES = [
    { 'package.json': '{"workspaces":["packages/*"]}' },
    { 'package.json': '{"workspaces":{"packages":["packages/*"]}}' },
    { 'package.json': '{}', 'pnpm-workspace.yaml': 'packages: ["packages/*"]' },
    { 'package.json': '{}', 'lerna.json': '{"packages":["packages/*"]}' },
    {
        'rush.json':
            '{"projects":[{"packageName":"api","projectFolder":"packages/api"},{"packageName":"lint","projectFolder":"packages/lint"}]}',
    },
] as const;

export const PYTHON_WORKSPACE_FILES = {
    'pyproject.toml': `[project]
dependencies = ["fastapi>=1"]
[tool.uv.workspace]
members = ["api", "member-only"]
`,
    'api/pyproject.toml': `[project]
name = "api"
dependencies = ["fastapi>=1"]
`,
    'api/main.py': 'print("ready")\n',
    'member-only/main.py': 'print("not a project file")\n',
} as const;

export const TOOL_ONLY_PACKAGES = {
    'packages/process/package.json': '{"devDependencies":{"concurrently":"9.0.0"}}',
    'packages/custom/package.json': '{"devDependencies":{"eslint-plugin-custom":"1.0.0"}}',
    'packages/next/package.json': '{"devDependencies":{"@next/eslint-plugin-next":"16.0.0"}}',
    'packages/hooks/package.json': '{"devDependencies":{"husky":"9.0.0"}}',
} as const;

export const PROJECT_SCOPES: string[][] = [
    ['api', 'project'],
    ['apps/web', 'project'],
    ['ios', 'project'],
    ['services/billing', 'project'],
];

export const PROJECT_SCOPE_FILES = {
    'package.json': '{"private":true}',
    'supabase/config.toml': 'project_id = "example"\n',
    'api/package.json': '{"dependencies":{"express":"5.0.0"}}',
    'api/src/index.js': 'export {};\n',
    'ios/App.xcodeproj/project.pbxproj': '// !$*UTF8*$!\n',
    'ios/Sources/App.swift': 'import Foundation\n',
    'services/billing/pyproject.toml': '[project]\nname = "billing"\n',
    'tools/lint/package.json': '{"devDependencies":{"eslint":"10.0.0"}}',
    'apps/web/supabase/config.toml': 'project_id = "web"\n',
} as const;

export const PRIVATE_TOOL_PACKAGES = {
    'project/package.json': '{"workspaces":["**"]}',
    'project/packages/app/package.json': '{"name":"application"}',
    'project/.gspot/package.json': '{"name":"private-tools"}',
    'project/.gspot/.venv/bin/.keep': '',
    'outside/python': 'The interpreter belongs outside the repository.\n',
} as const;

export const LINKED_HOOK_FILES = [
    { path: '.lefthook.yml', kind: 'lefthook' },
    { path: '.pre-commit-config.yaml', kind: 'pre-commit' },
] as const;

export const HUSKY_STUBS = {
    '.husky/_/.gitignore': '*\n',
    '.husky/_/h': '#!/usr/bin/env sh\n',
    '.husky/_/pre-commit': '#!/usr/bin/env sh\n. "$(dirname "$0")/h"\n',
};

export const SIMPLE_GIT_HOOKS_PACKAGES = [
    {
        text: '{"simple-git-hooks":{"pre-commit":"echo authored"}}',
        hooks: [{ kind: 'simple-git-hooks', path: 'package.json', files: [] as string[] }],
    },
    { text: '{}', hooks: [] },
] as const;

export const HOOK_FOLDER_FILES = {
    '.githooks/pre-commit': '#!/bin/sh\nexit 0\n',
    '.husky/pre-commit': '#!/bin/sh\nexit 0\n',
    '.git-hooks/pre-commit': '#!/bin/sh\nexit 0\n',
    [`${GSPOT_PATHS.hooks}/pre-commit`]: '#!/bin/sh\nexit 0\n',
    '.mise/tasks/hook/pre-commit': '#!/bin/sh\nexit 0\n',
} as const;

export const LINKED_RUFF_SECTION = {
    tool: 'ruff',
    path: 'pyproject.toml',
    shared: true,
    table: 'tool.ruff',
} as const;

export const CI_JOB_DOCUMENTS = [
    {
        name: 'GitHub run steps',
        path: '.github/workflows/check.yml',
        document: {
            jobs: {
                quality: { steps: [{ uses: 'actions/checkout@v4' }, { run: 'bun run lint' }, null, 12] },
                build: { steps: [{ run: 'bun run build' }] },
            },
        },
        expected: ['quality'],
    },
    {
        name: 'GitLab scalar and array scripts',
        path: '.gitlab-ci.yml',
        document: {
            quality: { script: 'eslint src' },
            analysis: { script: [null, 12, 'npm run lint'] },
            '.lint-template': { script: 'eslint src' },
            build: { script: ['bun run build'] },
        },
        expected: ['quality', 'analysis'],
    },
    {
        name: 'named inherited jobs',
        path: '.gitlab/ci/check.yml',
        document: {
            'code-lint': { extends: '.base' },
            unrelated: { extends: '.base' },
            'lint-settings': { variables: {} },
            'lint-invalid': [],
        },
        expected: ['code-lint'],
    },
    { name: 'null document', path: '.gitlab-ci.yml', document: null, expected: [] },
] as const;

export const GITLAB_COMPONENT =
    'spec:\n  inputs:\n    stage:\n      default: test\n---\n.base:\n  script: echo ready\nquality:\n  script:\n    - !reference [.base, script]\n    - eslint src\n';

export const PRETTIER_SETTINGS_FILES = {
    'src/.prettierrc.json': '{"semi":false}',
    'vendor/.prettierrc.json': '{"semi":true}',
    [`${GSPOT_FOLDER}/.prettierrc.json`]: '{"tabWidth":8}',
    [GSPOT_PATHS.npmProject]: 'unowned malformed output',
    'nested/.gspot/package.json': '{}',
} as const;
