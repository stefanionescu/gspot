import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';

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

export const PROJECT_FILE_FOLDERS = [
    ['api/package.json', 'package.json', 'api'],
    ['package.json', 'package.json', ''],
    ['services/billing/requirements-dev.txt', 'requirements*.txt', 'services/billing'],
    ['ios/App.xcodeproj/project.pbxproj', '*.xcodeproj', 'ios'],
    ['apps/web/supabase/config.toml', 'supabase/config.toml', 'apps/web'],
    ['api/package-lock.json', 'package.json', undefined],
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

export const LINKED_HOOK_FILES = [{ path: '.lefthook.yml', kind: 'lefthook' }] as const;

export const SIMPLE_GIT_HOOKS_PACKAGES = [
    {
        text: '{"simple-git-hooks":{"pre-commit":"echo authored"}}',
        hooks: [{ kind: 'simple-git-hooks' as const, path: 'package.json', files: [] }],
    },
    { text: '{}', hooks: [] },
];

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

export const PRETTIER_SETTINGS_FILES = {
    'src/.prettierrc.json': '{"semi":false}',
    'vendor/.prettierrc.json': '{"semi":true}',
    [`${GSPOT_FOLDER}/.prettierrc.json`]: '{"tabWidth":8}',
    [GSPOT_PATHS.npmProject]: 'unowned malformed output',
    'nested/.gspot/package.json': '{}',
} as const;
