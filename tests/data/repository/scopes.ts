/** Paths keep literal Unicode, punctuation, and empty root or scope prefixes. */
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

/** pyproject.toml files, to tell declared scopes from uv workspace members. */
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

/** The workspace folders of those packages. */
export const TOOL_ONLY_FOLDERS = ['packages/custom', 'packages/hooks', 'packages/next', 'packages/process'] as const;

/** Packages that hold only gspot npm tools or a hook manager. */
export const TOOL_ONLY_PACKAGES = {
    'packages/process/package.json': '{"devDependencies":{"concurrently":"9.0.0"}}',
    'packages/custom/package.json': '{"devDependencies":{"eslint-plugin-custom":"1.0.0"}}',
    'packages/next/package.json': '{"devDependencies":{"@next/eslint-plugin-next":"16.0.0"}}',
    'packages/hooks/package.json': '{"devDependencies":{"husky":"9.0.0"}}',
} as const;

/** The scope of each project folder. */
export const PROJECT_SCOPES: string[][] = [
    ['api', 'project'],
    ['apps/web', 'project'],
    ['ios', 'project'],
    ['services/billing', 'project'],
];

/** Project files in several folders. */
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

/** A workspace beside the private gspot tool package. */
export const PRIVATE_TOOL_PACKAGES = {
    'project/package.json': '{"workspaces":["**"]}',
    'project/packages/app/package.json': '{"name":"application"}',
    'project/.gspot/package.json': '{"name":"private-tools"}',
    'project/.gspot/.venv/bin/.keep': '',
    'outside/python': 'The interpreter belongs outside the repository.\n',
} as const;
